import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';

import '../models.dart';
import '../player_state.dart';

Future<void> initializeBackgroundAudio(PlayerStateModel player) async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  try {
    final session = await AudioSession.instance;
    final handler = await AudioService.init(
      builder: () => RajifyAudioHandler(player),
      config: const AudioServiceConfig(
        androidNotificationChannelId: 'com.rajaudios.rajify.playback',
        androidNotificationChannelName: 'Music playback',
        androidNotificationIcon: 'drawable/rajify_notification',
        androidStopForegroundOnPause: false,
      ),
    );
    // Chromium owns audio focus for this player and handles interruptions.
    // A second focus request from Dart interrupts our own WebView playback.
    session.becomingNoisyEventStream.listen((_) => unawaited(handler.pause()));
  } catch (_) {
    player.app.message =
        'Background controls could not start. Reopen Rajify to try again.';
  }
}

/// System media controls use the same queue and controller as the Flutter UI.
class RajifyAudioHandler extends BaseAudioHandler {
  RajifyAudioHandler(this.player) {
    player.addListener(_publish);
    player.app.addListener(_publish);
    _publish();
  }
  final PlayerStateModel player;
  String _queueSignature = '';
  String _stateSignature = '';

  MediaItem _item(Track track) => MediaItem(
    id: track.id,
    title: track.title,
    artist: track.channel.replaceFirst(RegExp(r' - Topic$'), ''),
    duration: Duration(
      seconds: track.id == player.current?.id
          ? player.duration
          : track.duration,
    ),
    artUri: track.thumbnail.isEmpty ? null : Uri.tryParse(track.thumbnail),
  );

  void _publish() {
    final track = player.current;
    final signature = player.queue.tracks.map((t) => t.id).join(',');
    if (signature != _queueSignature) {
      _queueSignature = signature;
      queue.add(player.queue.tracks.map(_item).toList());
    }
    if (track?.id != mediaItem.value?.id ||
        player.duration != mediaItem.value?.duration?.inSeconds) {
      mediaItem.add(track == null ? null : _item(track));
    }
    final stateSignature =
        '${track?.id}:${player.playing}:${player.buffering}:${player.error}:${player.queue.index}:${player.app.settings['repeat']}:${player.app.settings['shuffle']}';
    final projected = playbackState.value.position.inSeconds;
    if (_stateSignature == stateSignature &&
        (projected - player.position).abs() < 2) {
      return;
    }
    _stateSignature = stateSignature;
    playbackState.add(
      PlaybackState(
        controls: [
          MediaControl.skipToPrevious,
          player.playing ? MediaControl.pause : MediaControl.play,
          MediaControl.skipToNext,
          MediaControl.stop,
        ],
        systemActions: const {
          MediaAction.seek,
          MediaAction.setRepeatMode,
          MediaAction.setShuffleMode,
        },
        androidCompactActionIndices: const [0, 1, 2],
        processingState: track == null
            ? AudioProcessingState.idle
            : player.error != null
            ? AudioProcessingState.error
            : player.buffering
            ? AudioProcessingState.buffering
            : AudioProcessingState.ready,
        playing: player.playing,
        updatePosition: Duration(seconds: player.position),
        queueIndex: track == null ? null : player.queue.index,
        repeatMode: switch (player.app.settings['repeat']) {
          'one' => AudioServiceRepeatMode.one,
          'all' => AudioServiceRepeatMode.all,
          _ => AudioServiceRepeatMode.none,
        },
        shuffleMode: player.app.settings['shuffle'] == true
            ? AudioServiceShuffleMode.all
            : AudioServiceShuffleMode.none,
      ),
    );
  }

  @override
  Future<void> play() => player.resume();
  @override
  Future<void> pause() => player.pause();
  @override
  Future<void> seek(Duration position) =>
      player.seek(position.inMilliseconds / 1000);
  @override
  Future<void> skipToNext() => player.next();
  @override
  Future<void> skipToPrevious() => player.next(backwards: true);
  @override
  Future<void> skipToQueueItem(int index) async {
    if (index >= 0 && index < player.queue.tracks.length) {
      await player.select(index);
    }
  }

  @override
  Future<void> setRepeatMode(AudioServiceRepeatMode repeatMode) async =>
      player.app.updateSettings({
        'repeat': repeatMode == AudioServiceRepeatMode.one
            ? 'one'
            : repeatMode == AudioServiceRepeatMode.none
            ? 'off'
            : 'all',
      });
  @override
  Future<void> setShuffleMode(AudioServiceShuffleMode shuffleMode) async =>
      player.app.updateSettings({
        'shuffle': shuffleMode != AudioServiceShuffleMode.none,
      });
  @override
  Future<void> stop() async {
    player.stop();
    await super.stop();
  }

  @override
  Future<void> onTaskRemoved() => stop();

  void dispose() {
    player.removeListener(_publish);
    player.app.removeListener(_publish);
  }
}
