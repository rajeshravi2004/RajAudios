import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app_state.dart';
import '../models.dart';
import '../player_state.dart';

void toast(BuildContext context, String text) => ScaffoldMessenger.of(context)
  ..hideCurrentSnackBar()
  ..showSnackBar(SnackBar(content: Text(text)));

Future<void> openExternal(BuildContext context, Uri uri) async {
  try {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
        context.mounted) {
      toast(context, 'Could not open this link.');
    }
  } catch (_) {
    if (context.mounted) toast(context, 'Could not open this link.');
  }
}

Future<String?> editName(
  BuildContext context, {
  String title = 'Create playlist',
  String initial = '',
}) async {
  final controller = TextEditingController(text: initial);
  final result = await showDialog<String>(
    context: context,
    builder: (context) {
      final colors = Theme.of(context).colorScheme;
      return AlertDialog(
        icon: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: colors.primaryContainer,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(Icons.queue_music_rounded, color: colors.primary),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        content: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                initial.isEmpty
                    ? 'Give your playlist a name you will recognize.'
                    : 'Choose a new name for this playlist.',
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(color: colors.onSurfaceVariant),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: controller,
                autofocus: true,
                maxLength: 100,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Playlist name',
                  hintText: 'e.g. Late night drives',
                  prefixIcon: Icon(Icons.edit_rounded),
                ),
                onSubmitted: (value) {
                  if (value.trim().isNotEmpty) {
                    Navigator.pop(context, value.trim());
                  }
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                Navigator.pop(context, controller.text.trim());
              }
            },
            icon: const Icon(Icons.check_rounded),
            label: const Text('Save'),
          ),
        ],
      );
    },
  );
  // Dialog transition can still use its text controller after pop.
  Future<void>.delayed(const Duration(seconds: 1), controller.dispose);
  return result;
}

Future<bool> confirm(
  BuildContext context,
  String title,
  String message,
) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    ) ??
    false;

class Artwork extends StatelessWidget {
  const Artwork(this.url, {super.key, this.size = 56});
  final String url;
  final double size;
  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: size,
      height: size,
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Icon(Icons.music_note_rounded, size: size / 2),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: url.isEmpty
          ? fallback
          : Image.network(
              url,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => fallback,
            ),
    );
  }
}

class EmptyMessage extends StatelessWidget {
  const EmptyMessage(
    this.title,
    this.subtitle, {
    super.key,
    this.icon = Icons.library_music_outlined,
    this.action,
  });
  final String title, subtitle;
  final IconData icon;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(28),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 48, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 16),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text(subtitle, textAlign: TextAlign.center),
        if (action != null)
          Padding(padding: const EdgeInsets.only(top: 16), child: action!),
      ],
    ),
  );
}

class ErrorMessage extends StatelessWidget {
  const ErrorMessage(this.error, this.retry, {super.key});
  final Object error;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => EmptyMessage(
    'Music is taking a break',
    '$error',
    icon: Icons.cloud_off_outlined,
    action: FilledButton.tonalIcon(
      onPressed: retry,
      icon: const Icon(Icons.refresh),
      label: const Text('Try again'),
    ),
  );
}

class TrackTile extends StatelessWidget {
  const TrackTile({
    super.key,
    required this.track,
    required this.app,
    required this.player,
    this.tracks,
    this.onRemove,
  });
  final Track track;
  final AppState app;
  final PlayerStateModel player;
  final List<Track>? tracks;
  final VoidCallback? onRemove;
  @override
  Widget build(BuildContext context) => ListTile(
    leading: Artwork(track.thumbnail, size: 48),
    title: Text(
      track.title,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: player.current?.id == track.id
          ? TextStyle(color: Theme.of(context).colorScheme.primary)
          : null,
    ),
    subtitle: Text(
      '${track.channel}${track.duration > 0 ? ' • ${clockTime(track.duration)}' : ''}',
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    ),
    onTap: () => player.play(track, tracks),
    trailing: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: onRemove != null
              ? 'Remove from playlist'
              : 'Add to playlist',
          onPressed: onRemove ?? () => addTrackDialog(context, app, track),
          icon: Icon(
            onRemove != null
                ? Icons.remove_circle_outline_rounded
                : Icons.playlist_add_rounded,
          ),
        ),
        PopupMenuButton<String>(
          tooltip: 'Track options',
          onSelected: (action) async {
            switch (action) {
              case 'like':
                app.toggleFavorite(track);
              case 'next':
                player.add(track, next: true);
                toast(context, 'Added to play next');
              case 'queue':
                player.add(track);
                toast(context, 'Added to queue');
              case 'playlist':
                await addTrackDialog(context, app, track);
              case 'youtube':
                await openExternal(
                  context,
                  Uri.https('www.youtube.com', '/watch', {'v': track.id}),
                );
              case 'remove':
                onRemove?.call();
            }
          },
          itemBuilder: (_) => [
            PopupMenuItem(
              value: 'like',
              child: Text(app.isFavorite(track) ? 'Unlike song' : 'Like song'),
            ),
            const PopupMenuItem(value: 'next', child: Text('Play next')),
            const PopupMenuItem(value: 'queue', child: Text('Add to queue')),
            const PopupMenuItem(
              value: 'playlist',
              child: Text('Add to playlist'),
            ),
            const PopupMenuItem(
              value: 'youtube',
              child: Text('Open in YouTube'),
            ),
            if (onRemove != null)
              const PopupMenuItem(
                value: 'remove',
                child: Text('Remove from playlist'),
              ),
          ],
        ),
      ],
    ),
  );
}

Future<void> addTrackDialog(
  BuildContext context,
  AppState app,
  Track track,
) async {
  final selection = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useSafeArea: true,
    constraints: const BoxConstraints(maxWidth: 640),
    builder: (context) {
      final colors = Theme.of(context).colorScheme;
      return SizedBox(
        height: MediaQuery.sizeOf(context).height * .72,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: colors.primaryContainer,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      Icons.playlist_add_rounded,
                      color: colors.primary,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Add to playlist',
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Choose where this song belongs',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: colors.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: colors.surfaceContainerHighest.withValues(alpha: .45),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Artwork(track.thumbnail, size: 52),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            track.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            track.channel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: colors.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 22, 20, 8),
              child: Text(
                'YOUR PLAYLISTS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Card(
                margin: EdgeInsets.zero,
                elevation: 0,
                color: colors.primaryContainer.withValues(alpha: .52),
                child: ListTile(
                  leading: Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: colors.primary,
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: Icon(Icons.add_rounded, color: colors.onPrimary),
                  ),
                  title: const Text(
                    'New playlist',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: const Text('Create one and add this song'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.pop(context, 'new'),
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: Divider(height: 1),
            ),
            Expanded(
              child: app.playlists.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(28),
                        child: Text(
                          'No playlists yet. Start with the button above.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: colors.onSurfaceVariant),
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                      itemCount: app.playlists.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 4),
                      itemBuilder: (context, index) {
                        final list = app.playlists[index];
                        final alreadyAdded = list.tracks.any(
                          (item) => item.id == track.id,
                        );
                        return ListTile(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          leading: Artwork(
                            list.thumbnail.isNotEmpty
                                ? list.thumbnail
                                : list.tracks.firstOrNull?.thumbnail ?? '',
                            size: 48,
                          ),
                          title: Text(
                            list.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            '${list.tracks.length} ${list.tracks.length == 1 ? 'song' : 'songs'}',
                          ),
                          trailing: alreadyAdded
                              ? Icon(
                                  Icons.check_circle_rounded,
                                  color: colors.primary,
                                )
                              : const Icon(Icons.add_circle_outline_rounded),
                          enabled: !alreadyAdded,
                          onTap: alreadyAdded
                              ? null
                              : () => Navigator.pop(context, list.id),
                        );
                      },
                    ),
            ),
          ],
        ),
      );
    },
  );
  if (!context.mounted || selection == null) return;
  if (selection == 'new') {
    final title = await editName(context);
    if (title != null) app.createPlaylist(title, [track]);
  } else {
    final list = app.playlists.where((p) => p.id == selection).firstOrNull;
    if (list != null) app.addToPlaylist(list, track);
  }
}
