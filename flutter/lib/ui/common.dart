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
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLength: 100,
        decoration: const InputDecoration(labelText: 'Playlist name'),
        onSubmitted: (value) {
          if (value.trim().isNotEmpty) Navigator.pop(context, value.trim());
        },
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            if (controller.text.trim().isNotEmpty) {
              Navigator.pop(context, controller.text.trim());
            }
          },
          child: const Text('Save'),
        ),
      ],
    ),
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
    leading: Artwork(track.thumbnail),
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
    trailing: PopupMenuButton<String>(
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
        const PopupMenuItem(value: 'playlist', child: Text('Add to playlist')),
        const PopupMenuItem(value: 'youtube', child: Text('Open in YouTube')),
        if (onRemove != null)
          const PopupMenuItem(
            value: 'remove',
            child: Text('Remove from playlist'),
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
    builder: (context) => SafeArea(
      child: ListView(
        shrinkWrap: true,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Add to playlist',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          ListTile(
            leading: const Icon(Icons.add),
            title: const Text('New playlist'),
            onTap: () => Navigator.pop(context, 'new'),
          ),
          for (final list in app.playlists)
            ListTile(
              leading: const Icon(Icons.queue_music),
              title: Text(list.title),
              onTap: () => Navigator.pop(context, list.id),
            ),
        ],
      ),
    ),
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
