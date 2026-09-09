import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rajify/app_state.dart';
import 'package:rajify/main.dart';
import 'package:rajify/models.dart';
import 'package:rajify/player_state.dart';
import 'package:rajify/services/music_api.dart';
import 'package:rajify/ui/browse.dart';

const song = Track(id: 'abcdefghijk', title: 'A song', channel: 'Artist');
Map<String, dynamic> video(String id, String title) => {
  'id': id,
  'snippet': {'title': title, 'channelTitle': 'Artist - Topic'},
  'contentDetails': {'duration': 'PT3M12S'},
  'status': {'embeddable': true},
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('playlist items use video IDs, decode metadata and parse duration', () {
    final track = Track.youtube({
      'id': 'playlist-item-id',
      'snippet': {
        'resourceId': {'videoId': song.id},
        'title': 'Rock &amp; Roll',
        'videoOwnerChannelTitle': 'Singer',
      },
      'contentDetails': {'duration': 'PT1H2M3S'},
    }, playlistItem: true);
    expect(track.id, song.id);
    expect(track.title, 'Rock & Roll');
    expect(track.channel, 'Singer');
    expect(track.duration, 3723);
    expect(clockTime(track.duration), '1:02:03');
    expect(durationSeconds('invalid'), 0);
    expect(Track.fromJson(track.toJson()).title, track.title);
  });

  test('filter rejects short reactions and keeps official music', () {
    const reaction = Track(
      id: 'reaction',
      title: 'My reaction review',
      channel: 'Gaming reactions',
      duration: 30,
    );
    expect(passesFilter(reaction, 'strict'), false);
    expect(passesFilter(reaction, 'off'), true);
    expect(
      passesFilter(
        const Track(
          id: 'music',
          title: 'Official audio',
          channel: 'Artist - Topic',
          duration: 210,
        ),
        'strict',
      ),
      true,
    );
  });

  test('queue preserves the current track when reordered and removed', () {
    const b = Track(id: 'b', title: 'B', channel: 'Artist');
    const c = Track(id: 'c', title: 'C', channel: 'Artist');
    final queue = PlayQueue()..start(b, [song, b, c]);
    queue.move(0, 2);
    expect(queue.current, b);
    expect(queue.index, 0);
    expect(queue.remove(0), false);
    expect(queue.remove(1), true);
    expect(queue.current, b);
    expect(queue.advance(), true);
    expect(queue.current, song);
    expect(queue.advance(), false);
    expect(queue.advance(repeatAll: true), true);
    expect(queue.current, b);
    for (var i = 0; i < 20; i++) {
      final previous = queue.current;
      queue.advance(shuffle: true);
      expect(queue.current, isNot(previous));
    }
  });

  test(
    'likes, playlists, settings and bounded history survive restart',
    () async {
      final prefs = await SharedPreferences.getInstance();
      final app = AppState(
        prefs,
        MusicApi(client: MockClient((_) async => http.Response('{}', 200))),
      );
      app.toggleFavorite(song);
      final playlist = app.createPlaylist('Favorites');
      app.addToPlaylist(playlist, song);
      app.addToPlaylist(playlist, song);
      expect(playlist.tracks.length, 1);
      app.updateSettings({'language': 'hindi', 'volume': 4});
      expect(app.settings['volume'], 1);
      for (var i = 0; i < 110; i++) {
        app.recordPlay(Track(id: '$i', title: 'Song $i', channel: 'Artist'));
      }
      expect(app.history.length, 100);
      app.updateSettings({'saveHistory': false});
      app.recordPlay(song);
      expect(app.history.first.id, '109');
      await app.saved;
      final restored = AppState(prefs, MusicApi());
      expect(restored.favorites.single.id, song.id);
      expect(restored.playlists.single.tracks.single.id, song.id);
      expect(restored.language, 'hindi');
      expect(restored.history.length, 100);
      restored.clearHistory();
      await restored.saved;
      expect(jsonDecode(prefs.getString('history')!), isEmpty);
      app.dispose();
      restored.dispose();
    },
  );

  test(
    'API caches and deduplicates identical requests, preserving pagination',
    () async {
      var calls = 0;
      final api = MusicApi(
        client: MockClient((request) async {
          calls++;
          expect(request.url.path, '/api/youtube');
          await Future<void>.delayed(const Duration(milliseconds: 5));
          return http.Response(
            jsonEncode({
              'items': [video(song.id, 'Music')],
              'nextPageToken': 'next',
            }),
            200,
          );
        }),
      );
      final results = await Future.wait([
        api.trending('IN'),
        api.trending('IN'),
      ]);
      expect(calls, 1);
      expect(results.first.nextPageToken, 'next');
      await api.trending('IN');
      expect(calls, 1);
      await api.trending('IN', page: 'next');
      expect(calls, 2);
      api.dispose();
    },
  );

  test(
    'session key goes only to Google header and clears back to proxy',
    () async {
      final requests = <http.Request>[];
      final api = MusicApi(
        client: MockClient((request) async {
          requests.add(request);
          return http.Response('{"items":[]}', 200);
        }),
      );
      final key = 'AIza${List.filled(35, 'x').join()}';
      await api.setPersonalKey(key);
      await api.trending('IN');
      expect(api.hasPersonalKey, true);
      for (final request in requests) {
        expect(request.url.host, 'www.googleapis.com');
        expect(request.headers['x-goog-api-key'], key);
        expect(request.url.toString(), isNot(contains(key)));
      }
      api.clearKey();
      await api.trending('IN');
      expect(requests.last.url.host, 'rajaudios.vercel.app');
      expect(requests.last.headers.containsKey('x-goog-api-key'), false);
      api.dispose();
    },
  );

  test(
    'quota and malformed server responses produce actionable errors',
    () async {
      final quota = MusicApi(
        client: MockClient(
          (_) async => http.Response('{"error":"QUOTA_EXCEEDED"}', 429),
        ),
      );
      await expectLater(
        quota.trending('IN'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('quota'),
          ),
        ),
      );
      quota.dispose();
      final invalid = MusicApi(
        client: MockClient(
          (_) async => http.Response('<html>unavailable</html>', 502),
        ),
      );
      await expectLater(
        invalid.trending('IN'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('invalid response'),
          ),
        ),
      );
      invalid.dispose();
    },
  );

  testWidgets(
    'guest can navigate to library and create a persistent playlist',
    (tester) async {
      final app = AppState(
        await SharedPreferences.getInstance(),
        MusicApi(
          client: MockClient((_) async => http.Response('{"items":[]}', 200)),
        ),
      );
      await tester.pumpWidget(RajifyApp(app: app));
      expect(find.text('Explore as a guest'), findsOneWidget);
      await tester.tap(find.text('Explore as a guest'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Library'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create playlist'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Road trip');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(find.text('Road trip'), findsOneWidget);
      await app.saved;
      expect(app.playlists.single.title, 'Road trip');
      await tester.tap(find.byTooltip('Settings'));
      await tester.pumpAndSettle();
      expect(find.text('Your account'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 2));
      app.dispose();
    },
  );

  testWidgets('search ignores results superseded by a newer query', (
    tester,
  ) async {
    final slow = Completer<http.Response>();
    final api = MusicApi(
      client: MockClient((request) async {
        if (request.url.queryParameters['endpoint'] == 'search') {
          if (request.url.queryParameters['q'] == 'old') return slow.future;
          return http.Response(
            jsonEncode({
              'items': [video('newnewnew12', 'New result')],
            }),
            200,
          );
        }
        final id = request.url.queryParameters['id']!;
        return http.Response(
          jsonEncode({
            'items': [video(id, id == song.id ? 'Old result' : 'New result')],
          }),
          200,
        );
      }),
    );
    final app = AppState(await SharedPreferences.getInstance(), api);
    final player = PlayerStateModel(app);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SearchPage(app: app, player: player),
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), 'old');
    await tester.tap(find.byTooltip('Search'));
    await tester.pump();
    await tester.enterText(find.byType(TextField), 'new');
    await tester.tap(find.byTooltip('Search'));
    await tester.pumpAndSettle();
    expect(find.text('New result'), findsOneWidget);
    slow.complete(
      http.Response(
        jsonEncode({
          'items': [video(song.id, 'Old result')],
        }),
        200,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Old result'), findsNothing);
    expect(find.text('New result'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    player.dispose();
    app.dispose();
  });
}
