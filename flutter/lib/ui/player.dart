import 'package:flutter/material.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import '../app_state.dart';
import '../models.dart';
import '../player_state.dart';
import 'common.dart';

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
  Widget build(BuildContext context) {
    if (player.current == null || player.controller == null) {
      return const SizedBox.shrink();
    }
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainer,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // This is the only embedded view: all surrounding application UI is Flutter.
          SizedBox(
            height: 200,
            child: Center(
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: YoutubePlayer(
                  key: ObjectKey(player.controller),
                  controller: player.controller!,
                ),
              ),
            ),
          ),
          ListenableBuilder(
            listenable: player,
            builder: (context, _) => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (player.error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            player.error!,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                        TextButton(
                          onPressed: player.retry,
                          child: const Text('Retry'),
                        ),
                        IconButton(
                          tooltip: 'Open in YouTube',
                          onPressed: () => openExternal(
                            context,
                            Uri.https('www.youtube.com', '/watch', {
                              'v': player.current!.id,
                            }),
                          ),
                          icon: const Icon(Icons.open_in_new),
                        ),
                      ],
                    ),
                  ),
                if (player.buffering)
                  const LinearProgressIndicator(minHeight: 2),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 4, 4, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: openQueue,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                player.current?.title ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              Text(
                                player.current?.channel ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: app.isFavorite(player.current!)
                            ? 'Unlike song'
                            : 'Like song',
                        onPressed: () => app.toggleFavorite(player.current!),
                        icon: Icon(
                          app.isFavorite(player.current!)
                              ? Icons.favorite
                              : Icons.favorite_border,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close player',
                        onPressed: player.stop,
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    IconButton(
                      tooltip: 'Previous song',
                      onPressed: () => player.next(backwards: true),
                      icon: const Icon(Icons.skip_previous_rounded),
                    ),
                    IconButton.filled(
                      tooltip: player.playing ? 'Pause' : 'Play',
                      onPressed: player.toggle,
                      icon: Icon(
                        player.playing
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Next song',
                      onPressed: player.next,
                      icon: const Icon(Icons.skip_next_rounded),
                    ),
                    IconButton(
                      tooltip: 'Queue & playback controls',
                      onPressed: openQueue,
                      icon: const Icon(Icons.queue_music),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
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
