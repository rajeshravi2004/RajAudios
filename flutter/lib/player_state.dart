import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import 'app_state.dart';
import 'models.dart';

class PlayQueue {
  List<Track> tracks = [];
  int index = -1;
  Track? get current =>
      index >= 0 && index < tracks.length ? tracks[index] : null;
  void start(Track track, List<Track> context) {
    tracks = List.of(context);
    index = tracks.indexWhere((t) => t.id == track.id);
    if (index < 0) {
      tracks.insert(0, track);
      index = 0;
    }
  }

  bool advance({
    bool repeatAll = false,
    bool shuffle = false,
    bool backwards = false,
  }) {
    if (tracks.isEmpty) return false;
    if (shuffle && tracks.length > 1 && !backwards) {
      index = (index + 1 + Random().nextInt(tracks.length - 1)) % tracks.length;
      return true;
    }
    final next = index + (backwards ? -1 : 1);
    if (next < 0 || next >= tracks.length) {
      if (!repeatAll) return false;
      index = backwards ? tracks.length - 1 : 0;
    } else {
      index = next;
    }
    return true;
  }

  void move(int oldIndex, int newIndex) {
    final playing = current;
    final track = tracks.removeAt(oldIndex);
    tracks.insert(newIndex, track);
    if (playing != null) index = tracks.indexOf(playing);
  }

  bool remove(int position) {
    if (position == index) return false;
    tracks.removeAt(position);
    if (position < index) index--;
    return true;
  }
}

enum MediaMode { song, video }

class PlayerStateModel extends ChangeNotifier {
  PlayerStateModel(this.app);
  final AppState app;
  final queue = PlayQueue();
  YoutubePlayerController? controller;
  StreamSubscription<YoutubePlayerValue>? _subscription;
  StreamSubscription<YoutubeVideoState>? _positionSubscription;
  bool playing = false, buffering = false, _ended = false, _disposed = false;
  int position = 0, duration = 0;
  String? error, _recorded;
  Track? get current => queue.current;
  MediaMode mediaMode = MediaMode.song;
  bool expanded = false;
  double _volumeBeforeMute = 0.8;

  void expand() {
    expanded = true;
    notifyListeners();
  }

  void minimize() {
    expanded = false;
    mediaMode = MediaMode.song;
    notifyListeners();
  }

  void setMediaMode(MediaMode mode) {
    mediaMode = mode;
    expanded = true;
    notifyListeners();
  }

  Future<void> toggleMute() async {
    final currentVolume = (app.settings['volume'] as num).toDouble();
    if (currentVolume > 0) {
      _volumeBeforeMute = currentVolume;
      await volume(0);
    } else {
      await volume(_volumeBeforeMute);
    }
  }

  void _ensureController() {
    if (controller != null) return;
    controller = YoutubePlayerController(
      params: const YoutubePlayerParams(
        showControls: true,
        showFullscreenButton: true,
        playsInline: true,
      ),
    );
    _subscription = controller!.listen((value) {
      if (_disposed) return;
      playing = value.playerState == PlayerState.playing;
      buffering = value.playerState == PlayerState.buffering;
      if (value.error != YoutubeError.none) {
        error = 'YouTube cannot play this track here. Retry, skip it, or open it in YouTube.';
      }
      if (playing) {
        _ended = false;
        if (current != null && _recorded != current!.id) {
          _recorded = current!.id;
          app.recordPlay(current!);
        }
      }
      duration = value.metaData.duration.inSeconds;
      if (value.playerState == PlayerState.ended && !_ended) {
        _ended = true;
        unawaited(_onEnded());
      }
      notifyListeners();
    });
    _positionSubscription = controller!.videoStateStream.listen((value) {
      if (_disposed) return;
      position = value.position.inSeconds;
      notifyListeners();
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
    } catch (_) {
      if (!_disposed) {
        error = 'Playback could not start. Check your connection and retry.';
        notifyListeners();
      }
    }
  }

  Future<void> play(Track track, [List<Track>? tracks]) async {
    _ensureController();
    queue.start(track, tracks ?? [track]);
    await _load();
  }

  Future<void> _load() async {
    if (current == null) return;
    error = null;
    position = 0;
    duration = current!.duration;
    _recorded = null;
    _ended = false;
    notifyListeners();
    await _run(() async {
      await controller!.loadVideoById(videoId: current!.id);
      await controller!.setVolume(
        ((app.settings['volume'] as num) * 100).round(),
      );
    });
  }

  Future<void> retry() => _load();
  Future<void> toggle() => playing ? pause() : resume();
  Future<void> resume() => _run(() async {
    await controller?.playVideo();
  });
  Future<void> pause() => _run(() async {
    await controller?.pauseVideo();
  });
  Future<void> seek(double seconds) => _run(() async {
    await controller?.seekTo(seconds: seconds, allowSeekAhead: true);
  });
  Future<void> volume(double value) async {
    app.updateSettings({'volume': value});
    await _run(() async {
      await controller?.setVolume((value * 100).round());
    });
  }

  Future<void> _onEnded() async {
    if (app.settings['repeat'] == 'one') {
      await _load();
    } else if (app.settings['autoplay'] == true) {
      await next();
    }
  }

  Future<void> next({bool backwards = false}) async {
    if (backwards && position > 3) {
      await seek(0);
      return;
    }
    if (queue.advance(
      repeatAll: app.settings['repeat'] == 'all',
      shuffle: app.settings['shuffle'] == true,
      backwards: backwards,
    )) {
      await _load();
    }
  }

  void add(Track track, {bool next = false}) {
    queue.tracks.insert(next ? queue.index + 1 : queue.tracks.length, track);
    notifyListeners();
  }

  Future<void> select(int index) async {
    queue.index = index;
    await _load();
  }

  void remove(int index) {
    queue.remove(index);
    notifyListeners();
  }

  void reorder(int from, int to) {
    queue.move(from, to);
    notifyListeners();
  }

  void clearUpcoming() {
    final track = current;
    queue.tracks = track == null ? [] : [track];
    queue.index = track == null ? -1 : 0;
    notifyListeners();
  }

  void stop() {
    unawaited(pause());
    queue.tracks.clear();
    queue.index = -1;
    _subscription?.cancel();
    _positionSubscription?.cancel();
    controller?.close();
    controller = null;
    playing = false;
    expanded = false;
    mediaMode = MediaMode.song;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _subscription?.cancel();
    _positionSubscription?.cancel();
    controller?.close();
    super.dispose();
  }
}
