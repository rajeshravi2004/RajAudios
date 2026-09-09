import 'dart:convert';

import 'package:audio_service/audio_service.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rajify/ui/library.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rajify/app_state.dart';
import 'package:rajify/models.dart';
import 'package:rajify/player_state.dart';
import 'package:rajify/services/background_audio.dart';
import 'package:rajify/services/music_api.dart';
import 'package:rajify/ui/player.dart';

const first = Track(
  id: 'first',
  title: 'First song',
  channel: 'Artist',
  duration: 180,
);
const second = Track(
  id: 'second',
  title: 'Second song',
  channel: 'Artist',
  duration: 200,
);

class TestPlayer extends PlayerStateModel {
  TestPlayer(super.app) {
    queue.start(first, [first, second]);
    duration = 180;
    position = 42;
  }
  @override
  Future<void> resume() async {
    playing = true;
    notifyListeners();
  }

  @override
  Future<void> pause() async {
    playing = false;
    notifyListeners();
  }

  @override
  Future<void> seek(double seconds) async {
    position = seconds.round();
    notifyListeners();
  }

  @override
  Future<void> select(int index) async {
    queue.index = index;
    notifyListeners();
  }

  @override
  Future<void> next({bool backwards = false}) async {
    queue.advance(backwards: backwards);
    notifyListeners();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late AppState app;
  late TestPlayer player;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    app = AppState(await SharedPreferences.getInstance(), MusicApi());
    player = TestPlayer(app);
  });
  tearDown(() {
    player.dispose();
    app.dispose();
  });

  testWidgets(
    'starts compact in Song mode and switching modes preserves the queue and position',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListenableBuilder(
              listenable: player,
              builder: (context, _) => Align(
                alignment: Alignment.bottomCenter,
                child: SizedBox(
                  height: player.expanded ? 740 : 76,
                  child: PlayerDock(app: app, player: player, openQueue: () {}),
                ),
              ),
            ),
          ),
        ),
      );
      expect(player.mediaMode, MediaMode.song);
      expect(find.byKey(const ValueKey('mini-player')), findsOneWidget);
      expect(
        tester.getSize(find.byKey(const ValueKey('video-slot'))).height,
        1,
      );
      await tester.tap(find.text('First song'));
      await tester.pump();
      expect(find.text('Song'), findsOneWidget);
      await tester.tap(find.text('Video'));
      await tester.pump();
      expect(player.mediaMode, MediaMode.video);
      expect(
        tester.getSize(find.byKey(const ValueKey('video-slot'))).height,
        greaterThan(100),
      );
      expect(player.position, 42);
      expect(player.queue.tracks, [first, second]);
      await tester.tap(find.text('Song'));
      await tester.pump();
      await tester.tap(find.byTooltip('Minimize player'));
      await tester.pump();
      expect(player.expanded, false);
      expect(player.mediaMode, MediaMode.song);
    },
  );

  for (final size in [const Size(320, 568), const Size(844, 390)]) {
    testWidgets('player controls fit $size and large text', (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      player.expand();
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(
              size: size,
              textScaler: const TextScaler.linear(1.3),
            ),
            child: Scaffold(
              body: PlayerDock(app: app, player: player, openQueue: () {}),
            ),
          ),
        ),
      );
      await tester.drag(
        find.byKey(const ValueKey('expanded-player')),
        const Offset(0, -600),
      );
      await tester.pumpAndSettle();
      expect(find.text('Playlist'), findsOneWidget);
    });
  }

  testWidgets('playlist search adds once and visible removal persists', (
    tester,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final playlistApp = AppState(
      prefs,
      MusicApi(
        client: MockClient(
          (request) async => http.Response(
            jsonEncode({
              'items': [
                {
                  'id': request.url.queryParameters['endpoint'] == 'search'
                      ? {'videoId': 'abcdefghijk'}
                      : 'abcdefghijk',
                  'snippet': {
                    'title': 'Playlist test song',
                    'channelTitle': 'Artist - Topic',
                  },
                  'contentDetails': {'duration': 'PT3M10S'},
                  'status': {'embeddable': true},
                },
              ],
            }),
            200,
          ),
        ),
      ),
    );
    final playlistPlayer = TestPlayer(playlistApp);
    final list = playlistApp.createPlaylist('Road Trip');
    await tester.pumpWidget(
      MaterialApp(
        home: PlaylistPage(
          playlist: list,
          app: playlistApp,
          player: playlistPlayer,
        ),
      ),
    );
    await tester.tap(find.text('Add songs'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'test');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Add Playlist test song'));
    await tester.pumpAndSettle();
    expect(list.tracks.length, 1);
    expect(find.byTooltip('Already in playlist'), findsOneWidget);
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byTooltip('Remove from playlist'));
    await tester.tap(find.byTooltip('Remove from playlist'));
    await tester.pumpAndSettle();
    expect(list.tracks, isEmpty);
    await playlistApp.saved;
    final restored = AppState(prefs, MusicApi());
    expect(restored.playlists.single.tracks, isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
    restored.dispose();
    playlistPlayer.dispose();
    playlistApp.dispose();
  });

  test(
    'lock-screen commands update the same playback state and stop clears media',
    () async {
      final handler = RajifyAudioHandler(player);
      addTearDown(handler.dispose);
      expect(handler.mediaItem.value?.id, first.id);
      await handler.play();
      expect(player.playing, true);
      expect(handler.playbackState.value.playing, true);
      await handler.pause();
      expect(player.playing, false);
      await handler.seek(const Duration(seconds: 75));
      expect(player.position, 75);
      await handler.skipToNext();
      expect(player.current, second);
      expect(handler.mediaItem.value?.id, second.id);
      await handler.skipToQueueItem(-1);
      expect(player.current, second);
      await handler.setShuffleMode(AudioServiceShuffleMode.all);
      await handler.setRepeatMode(AudioServiceRepeatMode.one);
      expect(app.settings['shuffle'], true);
      expect(app.settings['repeat'], 'one');
      await handler.stop();
      expect(handler.mediaItem.value, isNull);
      expect(
        handler.playbackState.value.processingState,
        AudioProcessingState.idle,
      );
      expect(player.current, isNull);
    },
  );
}
