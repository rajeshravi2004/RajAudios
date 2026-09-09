import 'package:flutter/material.dart';

import '../app_state.dart';
import '../models.dart';
import '../player_state.dart';
import 'common.dart';

class LibraryPage extends StatefulWidget {
  const LibraryPage({super.key, required this.app, required this.player});
  final AppState app;
  final PlayerStateModel player;
  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  int _tab = 0;
  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    final tracks = _tab == 1 ? app.favorites : app.history;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 0, label: Text('Playlists')),
              ButtonSegment(value: 1, label: Text('Liked')),
              ButtonSegment(value: 2, label: Text('History')),
            ],
            selected: {_tab},
            onSelectionChanged: (v) => setState(() => _tab = v.first),
          ),
        ),
        Expanded(
          child: ListView(
            children: [
              if (_tab == 0) ...[
                ListTile(
                  leading: const Icon(Icons.add_circle_outline),
                  title: const Text('Create playlist'),
                  onTap: () async {
                    final title = await editName(context);
                    if (title != null) app.createPlaylist(title);
                  },
                ),
                if (app.playlists.isEmpty)
                  const EmptyMessage(
                    'A home for your favorites',
                    'Create a playlist, then add songs from their options menu.',
                  ),
                for (final p in app.playlists)
                  PlaylistTile(playlist: p, app: app, player: widget.player),
              ] else ...[
                if (tracks.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Wrap(
                      spacing: 12,
                      children: [
                        FilledButton.icon(
                          onPressed: () =>
                              widget.player.play(tracks.first, tracks),
                          icon: const Icon(Icons.play_arrow),
                          label: const Text('Play all'),
                        ),
                        if (_tab == 2)
                          TextButton(
                            onPressed: () async {
                              if (await confirm(
                                context,
                                'Clear listening history?',
                                'This removes the history saved on this phone.',
                              )) {
                                app.clearHistory();
                              }
                            },
                            child: const Text('Clear history'),
                          ),
                      ],
                    ),
                  ),
                if (tracks.isEmpty)
                  EmptyMessage(
                    _tab == 1 ? 'Songs you love' : 'Your listening story',
                    _tab == 1
                        ? 'Like songs from the player or their options menu.'
                        : 'The music you play will appear here.',
                  ),
                for (final track in tracks)
                  TrackTile(
                    track: track,
                    tracks: tracks,
                    app: app,
                    player: widget.player,
                  ),
              ],
              const Padding(
                padding: EdgeInsets.all(20),
                child: Text(
                  'Your library is saved on this device.',
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class PlaylistTile extends StatelessWidget {
  const PlaylistTile({
    super.key,
    required this.playlist,
    required this.app,
    required this.player,
  });
  final MusicPlaylist playlist;
  final AppState app;
  final PlayerStateModel player;
  @override
  Widget build(BuildContext context) => ListTile(
    leading: Artwork(
      playlist.thumbnail.isNotEmpty
          ? playlist.thumbnail
          : playlist.tracks.firstOrNull?.thumbnail ?? '',
    ),
    title: Text(playlist.title, maxLines: 2, overflow: TextOverflow.ellipsis),
    subtitle: Text(
      playlist.remote ? playlist.channel : '${playlist.tracks.length} songs',
    ),
    trailing: const Icon(Icons.chevron_right),
    onTap: () => Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) =>
            PlaylistPage(playlist: playlist, app: app, player: player),
      ),
    ),
  );
}

class PlaylistPage extends StatefulWidget {
  const PlaylistPage({
    super.key,
    required this.playlist,
    required this.app,
    required this.player,
  });
  final MusicPlaylist playlist;
  final AppState app;
  final PlayerStateModel player;
  @override
  State<PlaylistPage> createState() => _PlaylistPageState();
}

class _PlaylistPageState extends State<PlaylistPage> {
  List<Track> _tracks = [];
  String? _next, _error;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    if (widget.playlist.remote) _load();
  }

  Future<void> _load({bool more = false}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await widget.app.api.playlistTracks(
        widget.playlist.id,
        page: more ? _next : null,
      );
      if (!mounted) return;
      setState(() {
        _tracks = [...(more ? _tracks : <Track>[]), ...result.items];
        _next = result.nextPageToken;
      });
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.app,
    builder: (context, _) {
      final playlist = widget.playlist;
      final tracks = playlist.remote ? _tracks : playlist.tracks;
      return Scaffold(
        appBar: AppBar(
          title: Text(playlist.title),
          actions: [
            if (!playlist.remote)
              PopupMenuButton<String>(
                onSelected: (action) async {
                  if (action == 'rename') {
                    final title = await editName(
                      context,
                      title: 'Rename playlist',
                      initial: playlist.title,
                    );
                    if (title != null) {
                      playlist.title = title;
                      widget.app.savePlaylists();
                    }
                  } else if (await confirm(
                    context,
                    'Delete playlist?',
                    'Delete “${playlist.title}” from this phone?',
                  )) {
                    widget.app.deletePlaylist(playlist);
                    if (context.mounted) Navigator.pop(context);
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'rename', child: Text('Rename')),
                  PopupMenuItem(value: 'delete', child: Text('Delete')),
                ],
              ),
          ],
        ),
        body: ListView(
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Artwork(
                    playlist.thumbnail.isNotEmpty
                        ? playlist.thumbnail
                        : tracks.firstOrNull?.thumbnail ?? '',
                    size: 160,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    playlist.title,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${tracks.length} songs${_next != null ? ' loaded' : ''}',
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 12,
                    children: [
                      FilledButton.icon(
                        onPressed: tracks.isEmpty
                            ? null
                            : () => widget.player.play(tracks.first, tracks),
                        icon: const Icon(Icons.play_arrow),
                        label: const Text('Play all'),
                      ),
                      if (playlist.remote)
                        OutlinedButton.icon(
                          onPressed: tracks.isEmpty
                              ? null
                              : () {
                                  widget.app.createPlaylist(
                                    playlist.title,
                                    tracks,
                                  );
                                  toast(
                                    context,
                                    _next == null
                                        ? 'Playlist saved to your library'
                                        : 'Loaded songs saved. Load more first to include more songs.',
                                  );
                                },
                          icon: const Icon(Icons.library_add),
                          label: const Text('Save loaded songs'),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            if (_busy) const LinearProgressIndicator(),
            if (_error != null)
              ErrorMessage(_error!, () => _load(more: _tracks.isNotEmpty)),
            if (!_busy && tracks.isEmpty && _error == null)
              const EmptyMessage(
                'Your playlist starts here',
                'Add songs from the search results or player menu.',
              ),
            for (final track in tracks)
              TrackTile(
                track: track,
                tracks: tracks,
                app: widget.app,
                player: widget.player,
                onRemove: playlist.remote
                    ? null
                    : () {
                        playlist.tracks.removeWhere((t) => t.id == track.id);
                        widget.app.savePlaylists();
                      },
              ),
            if (_next != null)
              Padding(
                padding: const EdgeInsets.all(20),
                child: OutlinedButton(
                  onPressed: _busy ? null : () => _load(more: true),
                  child: const Text('Load more'),
                ),
              ),
          ],
        ),
      );
    },
  );
}
