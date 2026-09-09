import 'package:flutter/material.dart';

import '../app_state.dart';
import '../models.dart';
import '../player_state.dart';
import 'common.dart';

class LibraryPage extends StatefulWidget {
  const LibraryPage({
    super.key,
    required this.app,
    required this.player,
    this.initialTab = 0,
  });
  final int initialTab;
  final AppState app;
  final PlayerStateModel player;
  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  late int _tab = widget.initialTab;
  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    final tracks = _tab == 1 ? app.favorites : app.history;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your library',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${app.playlists.length} playlists / ${app.favorites.length} liked songs',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              FilledButton.tonalIcon(
                onPressed: () async {
                  final title = await editName(context);
                  if (title != null) app.createPlaylist(title);
                },
                icon: const Icon(Icons.add_rounded),
                label: const Text('New'),
              ),
            ],
          ),
        ),
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
            padding: const EdgeInsets.only(bottom: 8),
            children: [
              if (_tab == 0) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Card(
                    color: Theme.of(context).colorScheme.primaryContainer
                        .withValues(alpha: .5),
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(12),
                      leading: Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primary,
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Icon(
                          Icons.add_rounded,
                          color: Theme.of(context).colorScheme.onPrimary,
                        ),
                      ),
                      title: const Text(
                        'Create playlist',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: const Text('Start a new collection of songs'),
                      trailing: const Icon(Icons.arrow_forward_rounded),
                      onTap: () async {
                        final title = await editName(context);
                        if (title != null) app.createPlaylist(title);
                      },
                    ),
                  ),
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
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
    child: Card(
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        minTileHeight: 76,
        leading: Artwork(
          playlist.thumbnail.isNotEmpty
              ? playlist.thumbnail
              : playlist.tracks.firstOrNull?.thumbnail ?? '',
          size: 54,
        ),
        title: Text(
          playlist.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            playlist.remote
                ? playlist.channel
                : '${playlist.tracks.length} ${playlist.tracks.length == 1 ? 'song' : 'songs'}',
          ),
        ),
        trailing: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.chevron_right_rounded, size: 20),
        ),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute<void>(
            builder: (_) =>
                PlaylistPage(playlist: playlist, app: app, player: player),
          ),
        ),
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
                      if (!playlist.remote)
                        OutlinedButton.icon(
                          onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => PlaylistSongPickerPage(
                                playlist: playlist,
                                app: widget.app,
                              ),
                            ),
                          ),
                          icon: const Icon(Icons.playlist_add_rounded),
                          label: const Text('Add songs'),
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

class PlaylistSongPickerPage extends StatefulWidget {
  const PlaylistSongPickerPage({
    super.key,
    required this.playlist,
    required this.app,
  });
  final MusicPlaylist playlist;
  final AppState app;
  @override
  State<PlaylistSongPickerPage> createState() => _PlaylistSongPickerPageState();
}

class _PlaylistSongPickerPageState extends State<PlaylistSongPickerPage> {
  final _query = TextEditingController();
  List<Track>? _results;
  bool _busy = false;
  String? _error, _next;
  int _generation = 0;
  Future<void> _search({bool more = false}) async {
    if (_query.text.trim().isEmpty) return;
    final generation = ++_generation;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final page = await widget.app.api.search(
        _query.text.trim(),
        widget.app.region,
        page: more ? _next : null,
      );
      if (!mounted || generation != _generation) return;
      setState(() {
        _results = [...(more ? _results ?? [] : <Track>[]), ...page.items];
        _next = page.nextPageToken;
      });
    } catch (error) {
      if (mounted && generation == _generation) {
        setState(() => _error = '$error');
      }
    } finally {
      if (mounted && generation == _generation) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _generation++;
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.app,
    builder: (context, _) {
      final suggestions = {
        for (final track in [...widget.app.favorites, ...widget.app.history])
          track.id: track,
      }.values.toList();
      final tracks = widget.app.filter(_results ?? suggestions);
      return Scaffold(
        appBar: AppBar(
          title: const Text('Add songs'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Done'),
            ),
          ],
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.playlist.title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _query,
                    textInputAction: TextInputAction.search,
                    onChanged: (_) {
                      _generation++;
                      setState(() {
                        _results = null;
                        _busy = false;
                        _error = null;
                        _next = null;
                      });
                    },
                    onSubmitted: (_) => _search(),
                    decoration: InputDecoration(
                      labelText: 'Search songs',
                      hintText: 'Song or artist',
                      suffixIcon: IconButton(
                        tooltip: 'Search songs',
                        onPressed: _search,
                        icon: const Icon(Icons.search_rounded),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_busy) const LinearProgressIndicator(),
            Expanded(
              child: ListView(
                children: [
                  if (_error != null) ErrorMessage(_error!, _search),
                  if (_results == null)
                    const Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 8,
                      ),
                      child: Text('From your likes and listening history'),
                    ),
                  if (tracks.isEmpty && !_busy)
                    const EmptyMessage(
                      'Find songs for your playlist',
                      'Search above for a song or artist.',
                    ),
                  for (final track in tracks)
                    ListTile(
                      leading: Artwork(track.thumbnail, size: 48),
                      title: Text(
                        track.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        track.channel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing:
                          widget.playlist.tracks.any(
                            (item) => item.id == track.id,
                          )
                          ? const Tooltip(
                              message: 'Already in playlist',
                              child: Icon(Icons.check_circle_rounded),
                            )
                          : IconButton(
                              tooltip: 'Add ${track.title}',
                              icon: const Icon(
                                Icons.add_circle_outline_rounded,
                              ),
                              onPressed: () => widget.app.addToPlaylist(
                                widget.playlist,
                                track,
                              ),
                            ),
                    ),
                  if (_next != null)
                    TextButton(
                      onPressed: _busy ? null : () => _search(more: true),
                      child: const Text('Load more'),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    },
  );
}
