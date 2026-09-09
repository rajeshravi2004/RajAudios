import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import '../app_state.dart';
import '../models.dart';
import '../player_state.dart';
import 'common.dart';

/// One mounted player survives navigation, expansion and Song/Video changes.
class PlayerDock extends StatelessWidget {
  const PlayerDock({
    super.key,
    required this.app,
    required this.player,
    required this.openQueue,
  });
  final AppState app;
  final PlayerStateModel player;
  final VoidCallback openQueue;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([app, player]),
    builder: (context, _) {
      final track = player.current;
      if (track == null) return const SizedBox.shrink();
      final scheme = Theme.of(context).colorScheme;
      return LayoutBuilder(
        builder: (context, constraints) {
          final expanded = player.expanded;
          final video = expanded && player.mediaMode == MediaMode.video;
          final wide = constraints.maxWidth >= 650;
          final mediaWidth = math.min(constraints.maxWidth - 40, 560.0);
          final videoHeight = math.min(
            mediaWidth * 9 / 16,
            constraints.maxHeight * (wide ? 0.45 : 0.36),
          );
          return Material(
            key: const ValueKey('player-surface'),
            color: expanded ? scheme.surface : scheme.surfaceContainerHigh,
            borderRadius: BorderRadius.circular(expanded ? 0 : 18),
            clipBehavior: Clip.antiAlias,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: expanded
                    ? LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          scheme.primary.withValues(alpha: 0.18),
                          scheme.surface,
                        ],
                      )
                    : null,
              ),
              child: Column(
                children: [
                  if (expanded)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
                      child: Row(
                        children: [
                          IconButton(
                            tooltip: 'Minimize player',
                            onPressed: player.minimize,
                            icon: const Icon(Icons.keyboard_arrow_down_rounded),
                          ),
                          Expanded(
                            child: Text(
                              'NOW PLAYING',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.labelMedium
                                  ?.copyWith(letterSpacing: 2),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Close player',
                            onPressed: player.stop,
                            icon: const Icon(Icons.close_rounded),
                          ),
                        ],
                      ),
                    ),
                  // Keep the platform player mounted in Song mode so changing
                  // presentation does not recreate it or restart the track.
                  SizedBox(
                    key: const ValueKey('video-slot'),
                    height: video ? videoHeight : 1,
                    width: video ? mediaWidth : 1,
                    child: player.controller == null
                        ? const SizedBox.shrink()
                        : Transform.translate(
                            offset: video
                                ? Offset.zero
                                : const Offset(-10000, 0),
                            child: YoutubePlayer(
                              key: ObjectKey(player.controller),
                              controller: player.controller!,
                              autoFullScreen: false,
                              enableFullScreenOnVerticalDrag: false,
                            ),
                          ),
                  ),
                  Expanded(
                    child: expanded
                        ? SingleChildScrollView(
                            key: const ValueKey('expanded-player'),
                            padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                            child: Center(
                              child: ConstrainedBox(
                                constraints: const BoxConstraints(
                                  maxWidth: 480,
                                ),
                                child: Column(
                                  children: [
                                    SegmentedButton<MediaMode>(
                                      showSelectedIcon: false,
                                      segments: const [
                                        ButtonSegment(
                                          value: MediaMode.song,
                                          icon: Icon(Icons.music_note_rounded),
                                          label: Text('Song'),
                                        ),
                                        ButtonSegment(
                                          value: MediaMode.video,
                                          icon: Icon(Icons.videocam_outlined),
                                          label: Text('Video'),
                                        ),
                                      ],
                                      selected: {player.mediaMode},
                                      onSelectionChanged: (selection) =>
                                          player.setMediaMode(selection.first),
                                    ),
                                    if (!video)
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 24,
                                        ),
                                        child: Container(
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(
                                              24,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: scheme.primary
                                                    .withValues(alpha: 0.18),
                                                blurRadius: 40,
                                                offset: const Offset(0, 12),
                                              ),
                                            ],
                                          ),
                                          child: Artwork(
                                            track.thumbnail,
                                            size: math.min(
                                              mediaWidth - 16,
                                              math.max(
                                                140,
                                                constraints.maxHeight * 0.34,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    const SizedBox(height: 16),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                track.title,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .titleLarge
                                                    ?.copyWith(
                                                      fontWeight:
                                                          FontWeight.w800,
                                                    ),
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                track.channel.replaceFirst(
                                                  RegExp(r' - Topic$'),
                                                  '',
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  color:
                                                      scheme.onSurfaceVariant,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        IconButton(
                                          tooltip: app.isFavorite(track)
                                              ? 'Unlike song'
                                              : 'Like song',
                                          onPressed: () =>
                                              app.toggleFavorite(track),
                                          color: app.isFavorite(track)
                                              ? scheme.primary
                                              : null,
                                          icon: Icon(
                                            app.isFavorite(track)
                                                ? Icons.favorite_rounded
                                                : Icons.favorite_border_rounded,
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (player.error != null) _error(context),
                                    SeekControls(player: player),
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        IconButton(
                                          tooltip: 'Toggle shuffle',
                                          isSelected:
                                              app.settings['shuffle'] == true,
                                          onPressed: () => app.updateSettings({
                                            'shuffle':
                                                app.settings['shuffle'] != true,
                                          }),
                                          icon: const Icon(
                                            Icons.shuffle_rounded,
                                          ),
                                        ),
                                        IconButton(
                                          tooltip: 'Previous song',
                                          iconSize: 36,
                                          onPressed: () =>
                                              player.next(backwards: true),
                                          icon: const Icon(
                                            Icons.skip_previous_rounded,
                                          ),
                                        ),
                                        SizedBox(
                                          width: 72,
                                          height: 72,
                                          child: IconButton.filled(
                                            tooltip: player.playing
                                                ? 'Pause'
                                                : 'Play',
                                            onPressed: player.toggle,
                                            iconSize: 42,
                                            icon: Icon(
                                              player.playing
                                                  ? Icons.pause_rounded
                                                  : Icons.play_arrow_rounded,
                                            ),
                                          ),
                                        ),
                                        IconButton(
                                          tooltip: 'Next song',
                                          iconSize: 36,
                                          onPressed: player.next,
                                          icon: const Icon(
                                            Icons.skip_next_rounded,
                                          ),
                                        ),
                                        RepeatButton(app: app),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      children: [
                                        IconButton(
                                          tooltip: app.settings['volume'] == 0
                                              ? 'Unmute'
                                              : 'Mute',
                                          onPressed: player.toggleMute,
                                          icon: Icon(
                                            app.settings['volume'] == 0
                                                ? Icons.volume_off_outlined
                                                : Icons.volume_down_rounded,
                                          ),
                                        ),
                                        Expanded(
                                          child: Slider(
                                            value:
                                                (app.settings['volume'] as num)
                                                    .toDouble(),
                                            label:
                                                'Volume ${((app.settings['volume'] as num) * 100).round()}%',
                                            onChanged: player.volume,
                                          ),
                                        ),
                                        const Icon(
                                          Icons.volume_up_rounded,
                                          size: 20,
                                        ),
                                      ],
                                    ),
                                    Wrap(
                                      alignment: WrapAlignment.center,
                                      spacing: 12,
                                      children: [
                                        TextButton.icon(
                                          onPressed: () => addTrackDialog(
                                            context,
                                            app,
                                            track,
                                          ),
                                          icon: const Icon(
                                            Icons.playlist_add_rounded,
                                          ),
                                          label: const Text('Playlist'),
                                        ),
                                        TextButton.icon(
                                          onPressed: openQueue,
                                          icon: const Icon(
                                            Icons.queue_music_rounded,
                                          ),
                                          label: Text(
                                            'Queue (${player.queue.tracks.length})',
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          )
                        : InkWell(
                            key: const ValueKey('mini-player'),
                            onTap: player.expand,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 8,
                              ),
                              child: Row(
                                children: [
                                  Artwork(track.thumbnail, size: 48),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          track.title,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 3),
                                        Text(
                                          player.error != null
                                              ? 'Playback issue - Tap to retry'
                                              : track.channel.replaceFirst(
                                                  RegExp(r' - Topic$'),
                                                  '',
                                                ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: player.playing ? 'Pause' : 'Play',
                                    onPressed: player.toggle,
                                    icon: Icon(
                                      player.playing
                                          ? Icons.pause_rounded
                                          : Icons.play_arrow_rounded,
                                    ),
                                    iconSize: 30,
                                  ),
                                  IconButton(
                                    tooltip: 'Next song',
                                    onPressed: player.next,
                                    icon: const Icon(Icons.skip_next_rounded),
                                  ),
                                ],
                              ),
                            ),
                          ),
                  ),
                  LinearProgressIndicator(
                    minHeight: 2,
                    value: player.buffering
                        ? null
                        : player.duration > 0
                        ? (player.position / player.duration).clamp(0, 1)
                        : 0,
                    backgroundColor: Colors.transparent,
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );

  Widget _error(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Column(
      children: [
        Text(
          player.error!,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
        Wrap(
          spacing: 8,
          children: [
            TextButton(onPressed: player.retry, child: const Text('Retry')),
            TextButton(
              onPressed: () => openExternal(
                context,
                Uri.https('www.youtube.com', '/watch', {
                  'v': player.current!.id,
                }),
              ),
              child: const Text('Open in YouTube'),
            ),
          ],
        ),
      ],
    ),
  );
}

class RepeatButton extends StatelessWidget {
  const RepeatButton({super.key, required this.app});
  final AppState app;
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: 'Repeat: ${app.settings['repeat']}',
    isSelected: app.settings['repeat'] != 'off',
    onPressed: () {
      const modes = ['off', 'all', 'one'];
      app.updateSettings({
        'repeat':
            modes[(modes.indexOf(app.settings['repeat'] as String) + 1) % 3],
      });
    },
    icon: Icon(
      app.settings['repeat'] == 'one'
          ? Icons.repeat_one_rounded
          : Icons.repeat_rounded,
    ),
  );
}

/// Commit a seek once on release; dragging does not flood the iframe with seeks.
class SeekControls extends StatefulWidget {
  const SeekControls({super.key, required this.player});
  final PlayerStateModel player;
  @override
  State<SeekControls> createState() => _SeekControlsState();
}

class _SeekControlsState extends State<SeekControls> {
  double? _drag;
  String? _trackId;
  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    if (_trackId != player.current?.id) {
      _trackId = player.current?.id;
      _drag = null;
    }
    final maximum = math.max(1, player.duration).toDouble();
    final position = (_drag ?? player.position.toDouble()).clamp(0.0, maximum);
    return Column(
      children: [
        Slider(
          value: position,
          max: maximum,
          label: clockTime(position.round()),
          onChanged: player.duration > 0
              ? (value) => setState(() => _drag = value)
              : null,
          onChangeEnd: (value) {
            player.seek(value);
            setState(() => _drag = null);
          },
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              clockTime(position.round()),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              clockTime(player.duration),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        const SizedBox(height: 12),
      ],
    );
  }
}

class QueuePage extends StatelessWidget {
  const QueuePage({super.key, required this.app, required this.player});
  final AppState app;
  final PlayerStateModel player;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([app, player]),
    builder: (context, _) {
      final track = player.current;
      return Scaffold(
        appBar: AppBar(
          title: const Text('Now playing & queue'),
          actions: [
            IconButton(
              tooltip: 'Clear upcoming songs',
              onPressed: player.clearUpcoming,
              icon: const Icon(Icons.playlist_remove),
            ),
          ],
        ),
        body: track == null
            ? const EmptyMessage(
                'Nothing playing yet',
                'Choose a song to start your queue.',
              )
            : Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      children: [
                        Slider(
                          value: player.position
                              .clamp(0, player.duration)
                              .toDouble(),
                          max: player.duration > 0
                              ? player.duration.toDouble()
                              : 1,
                          onChanged: player.duration > 0 ? player.seek : null,
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(clockTime(player.position)),
                            Text(clockTime(player.duration)),
                          ],
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            IconButton(
                              isSelected: app.settings['shuffle'] == true,
                              tooltip: 'Toggle shuffle',
                              onPressed: () => app.updateSettings({
                                'shuffle': app.settings['shuffle'] != true,
                              }),
                              icon: const Icon(Icons.shuffle),
                            ),
                            IconButton(
                              isSelected: app.settings['repeat'] != 'off',
                              tooltip: 'Repeat: ${app.settings['repeat']}',
                              onPressed: () {
                                final modes = ['off', 'all', 'one'];
                                app.updateSettings({
                                  'repeat':
                                      modes[(modes.indexOf(
                                                app.settings['repeat']
                                                    as String,
                                              ) +
                                              1) %
                                          3],
                                });
                              },
                              icon: Icon(
                                app.settings['repeat'] == 'one'
                                    ? Icons.repeat_one
                                    : Icons.repeat,
                              ),
                            ),
                            IconButton(
                              tooltip: 'Add song to playlist',
                              onPressed: () =>
                                  addTrackDialog(context, app, track),
                              icon: const Icon(Icons.playlist_add),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: ReorderableListView.builder(
                      itemCount: player.queue.tracks.length,
                      onReorderItem: player.reorder,
                      itemBuilder: (context, index) {
                        final item = player.queue.tracks[index];
                        return ListTile(
                          key: ValueKey('$index:${item.id}'),
                          leading: Icon(
                            index == player.queue.index
                                ? Icons.graphic_eq
                                : Icons.drag_handle,
                          ),
                          title: Text(
                            item.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            item.channel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          selected: index == player.queue.index,
                          onTap: () => player.select(index),
                          trailing: index == player.queue.index
                              ? null
                              : IconButton(
                                  tooltip: 'Remove from queue',
                                  onPressed: () => player.remove(index),
                                  icon: const Icon(Icons.close),
                                ),
                        );
                      },
                    ),
                  ),
                ],
              ),
      );
    },
  );
}
