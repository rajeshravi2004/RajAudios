import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models.dart';

class ApiException implements Exception {
  const ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class MusicApi {
  MusicApi({
    http.Client? client,
    this.baseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'https://rajaudios.vercel.app',
    ),
  }) : _client = client ?? http.Client();
  final http.Client _client;
  final String baseUrl;
  String? _personalKey;
  final _cache = <String, ({DateTime expires, Map<String, dynamic> data})>{};
  final _pending = <String, Future<Map<String, dynamic>>>{};
  bool get hasPersonalKey => _personalKey != null;

  void clearKey() {
    _personalKey = null;
    clearCache();
  }

  void clearCache() => _cache.clear();

  Future<void> setPersonalKey(String key) async {
    final candidate = key.trim();
    if (!RegExp(r'^AIza[\w-]{35}$').hasMatch(candidate)) {
      throw const ApiException('Enter a valid YouTube Data API key.');
    }
    await _fetch(
      Uri.https('www.googleapis.com', '/youtube/v3/videos', {
        'part': 'id',
        'id': 'dQw4w9WgXcQ',
      }),
      headers: {'x-goog-api-key': candidate},
    );
    _personalKey = candidate;
    clearCache();
  }

  Future<Map<String, dynamic>> _fetch(
    Uri url, {
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _client
          .get(url, headers: headers)
          .timeout(const Duration(seconds: 20));
      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {
        throw const ApiException(
          'The music service returned an invalid response. Try again shortly.',
        );
      }
      if (response.statusCode >= 400 || data['error'] != null) {
        final error = data['error'];
        final reason = error is Map
            ? ((error['errors'] as List?)?.firstOrNull?['reason'])
            : error;
        if (response.statusCode == 429 ||
            [
              'quotaExceeded',
              'dailyLimitExceeded',
              'QUOTA_EXCEEDED',
            ].contains(reason)) {
          throw const ApiException(
            'YouTube quota reached. Try later or use a personal session key in Settings.',
          );
        }
        throw ApiException(
          error is Map
              ? error['message'] as String? ?? 'YouTube request failed.'
              : data['message'] as String? ??
                    'Music request failed (${response.statusCode}).',
        );
      }
      return data;
    } on TimeoutException {
      throw const ApiException('The connection timed out. Please try again.');
    } on http.ClientException {
      throw const ApiException(
        'Unable to connect. Check your internet connection.',
      );
    }
  }

  Future<Map<String, dynamic>> request(
    String endpoint,
    Map<String, String> params,
  ) async {
    // The key stays in memory, is sent only to Google, and is never part of a URL/cache key.
    final personal = _personalKey;
    final url = personal == null
        ? Uri.parse(baseUrl)
              .resolve('/api/youtube')
              .replace(queryParameters: {'endpoint': endpoint, ...params})
        : Uri.https('www.googleapis.com', '/youtube/v3/$endpoint', params);
    final key = '${personal == null ? 'shared' : 'personal'}:$url';
    final cached = _cache[key];
    if (cached != null && cached.expires.isAfter(DateTime.now())) {
      return cached.data;
    }
    if (_pending.containsKey(key)) return _pending[key]!;
    final future = _fetch(
      url,
      headers: personal == null ? null : {'x-goog-api-key': personal},
    );
    _pending[key] = future;
    try {
      final data = await future;
      if (_personalKey == personal) {
        if (_cache.length >= 80) _cache.remove(_cache.keys.first);
        _cache[key] = (
          expires: DateTime.now().add(const Duration(minutes: 10)),
          data: data,
        );
      }
      return data;
    } finally {
      _pending.remove(key);
    }
  }

  Future<List<Track>> _tracks(
    Map<String, dynamic> data, {
    bool enrich = false,
    bool playlist = false,
  }) async {
    var items = (data['items'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((j) => j['status']?['embeddable'] != false)
        .map((j) => Track.youtube(j, playlistItem: playlist))
        .where(
          (t) =>
              t.id.isNotEmpty &&
              t.title != 'Deleted video' &&
              t.title != 'Private video',
        )
        .toList();
    if (enrich && items.isNotEmpty) {
      final details = await request('videos', {
        'part': 'snippet,contentDetails,statistics,status',
        'id': items.map((t) => t.id).join(','),
      });
      final enriched = await _tracks(details);
      final byId = {for (final t in enriched) t.id: t};
      items = items
          .where((t) => byId.containsKey(t.id))
          .map((t) => byId[t.id]!)
          .toList();
    }
    return items;
  }

  Future<PageResult<Track>> search(
    String query,
    String region, {
    String? page,
  }) async {
    final data = await request('search', {
      'part': 'snippet',
      'type': 'video',
      'q': query,
      'videoCategoryId': '10',
      'videoEmbeddable': 'true',
      'maxResults': '20',
      'regionCode': region,
      'pageToken': ?page,
    });
    return PageResult(
      await _tracks(data, enrich: true),
      data['nextPageToken'] as String?,
    );
  }

  Future<PageResult<Track>> trending(String region, {String? page}) async {
    final data = await request('videos', {
      'part': 'snippet,contentDetails,statistics,status',
      'chart': 'mostPopular',
      'videoCategoryId': '10',
      'maxResults': '30',
      'regionCode': region,
      'pageToken': ?page,
    });
    return PageResult(await _tracks(data), data['nextPageToken'] as String?);
  }

  Future<PageResult<MusicPlaylist>> playlists(
    String query,
    String region, {
    String? page,
  }) async {
    final data = await request('search', {
      'part': 'snippet',
      'type': 'playlist',
      'q': query,
      'maxResults': '20',
      'regionCode': region,
      'pageToken': ?page,
    });
    return PageResult(
      (data['items'] as List? ?? [])
          .map((j) => MusicPlaylist.youtube(j))
          .toList(),
      data['nextPageToken'] as String?,
    );
  }

  Future<PageResult<Track>> playlistTracks(String id, {String? page}) async {
    final data = await request('playlistItems', {
      'part': 'snippet,contentDetails',
      'playlistId': id,
      'maxResults': '50',
      'pageToken': ?page,
    });
    return PageResult(
      await _tracks(data, playlist: true, enrich: true),
      data['nextPageToken'] as String?,
    );
  }

  void dispose() {
    clearKey();
    _client.close();
  }
}
