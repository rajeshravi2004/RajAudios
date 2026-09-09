import 'dart:async';

import 'package:flutter/material.dart';

import '../app_state.dart';
import '../models.dart';
import '../player_state.dart';
import 'common.dart';
import 'library.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.app, required this.player});
  final AppState app;
  final PlayerStateModel player;
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _sections = <String, Future<PageResult<Track>>>{};
  late Future<PageResult<MusicPlaylist>> _playlists;
  String _signature = '';
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(HomePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_signature != _currentSignature) _load();
  }

  String get _currentSignature =>
      '${widget.app.language}:${widget.app.region}:${widget.app.settings['personalizedRecommendations']}';
  void _load() {
    final app = widget.app;
    _signature = _currentSignature;
    final year = DateTime.now().year;
    _sections.clear();
    if (app.settings['personalizedRecommendations'] == true &&
        app.history.isNotEmpty) {
      _sections['Because you listen to ${app.history.first.channel}'] = app.api
          .search('${app.history.first.channel} official music', app.region);
    }
    _sections['Trending in ${label(app.language)}'] = app.api.search(
      'trending ${app.language} songs $year',
      app.region,
    );
    _sections['Fresh releases'] = app.api.search(
      'new ${app.language} songs $year official',
      app.region,
    );
    _sections['On repeat'] = app.api.search(
      'popular ${app.language} songs official music',
      app.region,
    );
    _playlists = app.api.playlists(
      '${app.language} music playlists',
      app.region,
    );
    // Attach error handlers immediately; each section also renders its own error.
    for (final future in _sections.values) {
      future.ignore();
    }
    _playlists.ignore();
  }

  Future<void> _refresh() async {
    widget.app.api.clearCache();
    setState(_load);
    await Future.wait(
      _sections.values.map((f) => f.then<void>((_) {}, onError: (Object _) {})),
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    final hour = DateTime.now().hour;
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: const LinearGradient(
                colors: [Color(0xff5b21b6), Color(0xff23113f)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'YOUR WORLD. YOUR SOUND.',
                  style: TextStyle(
                    color: Color(0xffddd0ff),
                    fontSize: 11,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Good ${hour < 12
                      ? 'morning'
                      : hour < 17
                      ? 'afternoon'
                      : 'evening'}${app.user == null ? '' : ', ${app.name.split(' ').first}'}',
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Find your next favorite song.',
                  style: TextStyle(color: Color(0xffddd0ff)),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: app.language,
                  key: ValueKey(app.language),
                  decoration: const InputDecoration(
                    labelText: 'Music language',
                    filled: true,
                  ),
                  items: languages
                      .map(
                        (l) =>
                            DropdownMenuItem(value: l, child: Text(label(l))),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value != null) app.updateSettings({'language': value});
                  },
                ),
              ],
            ),
          ),
          if (app.history.isNotEmpty)
            _shelf('Continue listening', app.history.take(10).toList()),
          for (final section in _sections.entries)
            FutureBuilder<PageResult<Track>>(
              future: section.value,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _heading(section.key),
                      ErrorMessage(snapshot.error!, () => setState(_load)),
                    ],
                  );
                }
                if (!snapshot.hasData) {
                  return const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                return _shelf(section.key, app.filter(snapshot.data!.items));
              },
            ),
          _heading('Playlists to get lost in'),
          FutureBuilder<PageResult<MusicPlaylist>>(
            future: _playlists,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return ErrorMessage(snapshot.error!, () => setState(_load));
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              return Column(
                children: snapshot.data!.items
                    .take(6)
                    .map(
                      (p) => PlaylistTile(
                        playlist: p,
                        app: app,
                        player: widget.player,
                      ),
                    )
                    .toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _heading(String title) => Padding(
    padding: const EdgeInsets.only(top: 28, bottom: 16),
    child: Text(
      title,
      style: Theme.of(context).textTheme.titleLarge
          ?.copyWith(fontWeight: FontWeight.bold),
    ),
  );
  Widget _shelf(String title, List<Track> tracks) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(title),
      if (tracks.isEmpty)
        const Text(
          'No matching tracks. Try a lighter content filter in Settings.',
        ),
      if (tracks.isNotEmpty)
        SizedBox(
          height: 228,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: tracks.length,
            separatorBuilder: (_, _) => const SizedBox(width: 16),
            itemBuilder: (context, index) {
              final track = tracks[index];
              return SizedBox(
                width: 154,
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => widget.player.play(track, tracks),
                  onLongPress: () => addTrackDialog(context, widget.app, track),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Stack(
                        children: [
                          Artwork(track.thumbnail, size: 154),
                          Positioned(
                            right: 6,
                            bottom: 6,
                            child: CircleAvatar(
                              backgroundColor: Theme.of(context)
                                  .colorScheme
                                  .primary,
                              child: Icon(
                                Icons.play_arrow_rounded,
                                color: Theme.of(context).colorScheme.onPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        track.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        track.channel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
    ],
  );
}

class SearchPage extends StatefulWidget {
  const SearchPage({
    super.key,
    required this.app,
    required this.player,
    this.trending = false,
  });
  final AppState app;
  final PlayerStateModel player;
  final bool trending;
  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _query = TextEditingController();
  Timer? _debounce;
  int _generation = 0;
  bool _busy = false, _playlistTab = false, _searched = false;
  String? _error, _next;
  String _region = '';
  List<Track> _tracks = [];
  List<MusicPlaylist> _playlists = [];
  @override
  void initState() {
    super.initState();
    _region = widget.app.region;
    if (widget.trending) _search();
  }

  @override
  void didUpdateWidget(SearchPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_region != widget.app.region) {
      _region = widget.app.region;
      if (_searched || widget.trending) _search();
    }
  }

  void _changed(String query) {
    _debounce?.cancel();
    _generation++;
    setState(() {
      _busy = query.trim().isNotEmpty;
      _tracks = [];
      _playlists = [];
      _error = null;
      _next = null;
      _searched = false;
    });
    if (query.trim().isEmpty) return;
    _debounce = Timer(const Duration(milliseconds: 450), _search);
  }

  Future<void> _search({bool more = false}) async {
    _debounce?.cancel();
    final query = _query.text.trim();
    if (!widget.trending && query.isEmpty) return;
    final generation = ++_generation;
    setState(() {
      _busy = true;
      _error = null;
      _searched = true;
      if (!more) {
        _tracks = [];
        _playlists = [];
        _next = null;
      }
    });
    try {
      final page = more ? _next : null;
      if (_playlistTab && !widget.trending) {
        final result = await widget.app.api.playlists(
          query,
          widget.app.region,
          page: page,
        );
        if (!mounted || generation != _generation) return;
        setState(() {
          _playlists = [
            ..._playlists,
            ...result.items.where(
              (p) => _playlists.every((old) => old.id != p.id),
            ),
          ];
          _next = result.nextPageToken;
        });
      } else {
        final result = widget.trending
            ? await widget.app.api.trending(widget.app.region, page: page)
            : await widget.app.api.search(query, widget.app.region, page: page);
        if (!mounted || generation != _generation) return;
        setState(() {
          _tracks = [
            ..._tracks,
            ...result.items.where(
              (t) => _tracks.every((old) => old.id != t.id),
            ),
          ];
          _next = result.nextPageToken;
        });
      }
      if (!widget.trending) widget.app.rememberSearch(query);
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
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final visible = widget.app.filter(_tracks);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: widget.trending
              ? DropdownButtonFormField<String>(
                  initialValue: widget.app.region,
                  key: ValueKey(widget.app.region),
                  decoration: const InputDecoration(
                    labelText: 'Trending music in',
                  ),
                  items: regions.entries
                      .map(
                        (r) => DropdownMenuItem(
                          value: r.key,
                          child: Text(r.value),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value != null) {
                      widget.app.updateSettings({'region': value});
                    }
                  },
                )
              : TextField(
                  controller: _query,
                  onChanged: _changed,
                  onSubmitted: (_) => _search(),
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Songs, artists, playlists',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: IconButton(
                      tooltip: 'Clear search',
                      onPressed: () {
                        _query.clear();
                        _changed('');
                      },
                      icon: const Icon(Icons.close),
                    ),
                  ),
                ),
        ),
        if (!widget.trending)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                  value: false,
                  label: Text('Songs'),
                  icon: Icon(Icons.music_note),
                ),
                ButtonSegment(
                  value: true,
                  label: Text('Playlists'),
                  icon: Icon(Icons.queue_music),
                ),
              ],
              selected: {_playlistTab},
              onSelectionChanged: (value) {
                setState(() => _playlistTab = value.first);
                _search();
              },
            ),
          ),
        if (_busy) const LinearProgressIndicator(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => _search(),
            child: ListView(
              children: [
                if (!_searched && !widget.trending && !_busy) ...[
                  ListTile(
                    title: const Text('Recent searches'),
                    trailing: TextButton(
                      onPressed: widget.app.clearSearches,
                      child: const Text('Clear'),
                    ),
                  ),
                  for (final query in widget.app.searches)
                    ListTile(
                      leading: const Icon(Icons.history),
                      title: Text(query),
                      onTap: () {
                        _query.text = query;
                        _search();
                      },
                    ),
                  if (widget.app.searches.isEmpty)
                    const EmptyMessage(
                      'Find your sound',
                      'Search for a song, artist, album, or playlist.',
                      icon: Icons.search,
                    ),
                ],
                if (_error != null)
                  ErrorMessage(
                    _error!,
                    () => _search(
                      more: _tracks.isNotEmpty || _playlists.isNotEmpty,
                    ),
                  ),
                if (_playlistTab && !widget.trending)
                  for (final p in _playlists)
                    PlaylistTile(
                      playlist: p,
                      app: widget.app,
                      player: widget.player,
                    ),
                if (!_playlistTab || widget.trending)
                  for (final track in visible)
                    TrackTile(
                      track: track,
                      tracks: visible,
                      app: widget.app,
                      player: widget.player,
                    ),
                if (_searched &&
                    !_busy &&
                    _error == null &&
                    visible.isEmpty &&
                    _playlists.isEmpty)
                  const EmptyMessage(
                    'No matches yet',
                    'Try another search or reduce the content filter in Settings.',
                  ),
                if (_next != null)
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => _search(more: true),
                      child: const Text('Load more'),
                    ),
                  ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
