import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_state.dart';
import 'services/background_audio.dart';
import 'player_state.dart';
import 'services/music_api.dart';
import 'ui/browse.dart';
import 'ui/library.dart';
import 'ui/player.dart';
import 'ui/settings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment('SUPABASE_URL');
  const key = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
  SupabaseClient? client;
  String? startupMessage;
  if (url.isNotEmpty && key.isNotEmpty) {
    try {
      await Supabase.initialize(url: url, publishableKey: key);
      client = Supabase.instance.client;
    } catch (_) {
      startupMessage =
          'Cloud sign-in could not initialize. You can listen as a guest.';
    }
  }
  final app = AppState(
    await SharedPreferences.getInstance(),
    MusicApi(),
    supabase: client,
  );
  app.message = startupMessage;
  final player = PlayerStateModel(app);
  await initializeBackgroundAudio(player);
  runApp(RajifyApp(app: app, player: player));
}

class RajifyApp extends StatefulWidget {
  const RajifyApp({super.key, required this.app, this.player});
  final PlayerStateModel? player;
  final AppState app;
  @override
  State<RajifyApp> createState() => _RajifyAppState();
}

class _RajifyAppState extends State<RajifyApp> {
  late final PlayerStateModel _player;
  final _messenger = GlobalKey<ScaffoldMessengerState>();
  @override
  void initState() {
    super.initState();
    _player = widget.player ?? PlayerStateModel(widget.app);
    widget.app.addListener(_message);
    WidgetsBinding.instance.addPostFrameCallback((_) => _message());
  }

  void _message() {
    final text = widget.app.message;
    if (text == null) return;
    widget.app.dismissMessage();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _messenger.currentState?.showSnackBar(SnackBar(content: Text(text)));
      }
    });
  }

  @override
  void dispose() {
    widget.app.removeListener(_message);
    _player.dispose();
    super.dispose();
  }

  ThemeData _theme(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xff8b5cf6),
      brightness: brightness,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: brightness,
      scaffoldBackgroundColor: brightness == Brightness.dark
          ? const Color(0xff09090f)
          : const Color(0xfffaf8ff),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: brightness == Brightness.dark
            ? const Color(0xff09090f)
            : const Color(0xfffaf8ff),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        elevation: 0,
        backgroundColor: brightness == Brightness.dark
            ? const Color(0xff09090f)
            : const Color(0xfffaf8ff),
        indicatorColor: scheme.primary.withValues(alpha: 0.16),
        labelTextStyle: WidgetStateProperty.all(
          const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        ),
      ),
      sliderTheme: const SliderThemeData(trackHeight: 3),
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.app,
    builder: (context, _) => MaterialApp(
      title: 'Rajify',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: _messenger,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      themeMode: switch (widget.app.settings['theme']) {
        'light' => ThemeMode.light,
        'system' => ThemeMode.system,
        _ => ThemeMode.dark,
      },
      home: widget.app.needsWelcome
          ? WelcomePage(app: widget.app)
          : AppShell(app: widget.app, player: _player),
    ),
  );
}

class WelcomePage extends StatelessWidget {
  const WelcomePage({super.key, required this.app});
  final AppState app;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: Image.asset(
                    'assets/logo.jpg',
                    width: 100,
                    height: 100,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  'Rajify',
                  style: Theme.of(context).textTheme.displayMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                Text(
                  'Your world. Your sound.',
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Discover music in your language. Build playlists, save the songs you love, and keep the good ones on repeat.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: app.supabase == null ? null : app.signIn,
                    icon: const Icon(Icons.login),
                    label: const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text('Continue with Google'),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: app.continueAsGuest,
                    child: const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text('Explore as a guest'),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  app.supabase == null
                      ? 'Guest mode is ready. Google sign-in is not configured in this build.'
                      : 'Sign in to sync your preferences across Rajify apps.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.app, required this.player});
  final AppState app;
  final PlayerStateModel player;
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final _navigator = GlobalKey<NavigatorState>();
  final _dockKey = GlobalKey();
  final _tabState = ValueNotifier<int>(0);
  final Set<int> _visited = {0};
  void _open(Widget page) {
    widget.player.minimize();
    _navigator.currentState!.push(
      MaterialPageRoute<void>(builder: (_) => page),
    );
  }

  void _select(int tab) {
    widget.player.minimize();
    _navigator.currentState?.popUntil((route) => route.isFirst);
    _visited.add(tab);
    _tabState.value = tab;
    setState(() {});
  }

  @override
  void dispose() {
    _tabState.dispose();
    super.dispose();
  }

  Widget _pages() => ListenableBuilder(
    listenable: Listenable.merge([widget.app, _tabState]),
    builder: (context, _) => Material(
      child: IndexedStack(
        index: _tabState.value,
        children: [
          HomePage(app: widget.app, player: widget.player),
          _visited.contains(1)
              ? SearchPage(
                  key: const ValueKey('search'),
                  app: widget.app,
                  player: widget.player,
                )
              : const SizedBox.shrink(),
          _visited.contains(2)
              ? SearchPage(
                  key: const ValueKey('trending'),
                  app: widget.app,
                  player: widget.player,
                  trending: true,
                )
              : const SizedBox.shrink(),
          _visited.contains(3)
              ? LibraryPage(app: widget.app, player: widget.player)
              : const SizedBox.shrink(),
        ],
      ),
    ),
  );
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.player,
    builder: (context, _) => PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (widget.player.expanded) {
          widget.player.minimize();
          return;
        }
        if (await _navigator.currentState!.maybePop()) return;
        if (_tabState.value != 0) {
          _select(0);
          return;
        }
        await const MethodChannel('com.rajaudios.rajify/device')
            .invokeMethod<void>('moveToBackground');
      },
      child: Scaffold(
        appBar: widget.player.expanded
            ? null
            : AppBar(
                title: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.asset(
                        'assets/logo.jpg',
                        width: 30,
                        height: 30,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Rajify',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                actions: [
                  IconButton(
                    tooltip: 'Settings',
                    onPressed: () => _open(
                      SettingsPage(app: widget.app, player: widget.player),
                    ),
                    icon: const Icon(Icons.settings_outlined),
                  ),
                ],
              ),
        body: SafeArea(
          top: widget.player.expanded,
          bottom: widget.player.expanded,
          child: ListenableBuilder(
            listenable: widget.player,
            builder: (context, _) => LayoutBuilder(
              builder: (context, constraints) {
                final showPlayer = widget.player.current != null;
                final expanded = showPlayer && widget.player.expanded;
                return Stack(
                  children: [
                    Positioned.fill(
                      bottom: showPlayer ? 86 : 0,
                      child: ExcludeFocus(
                        excluding: expanded,
                        child: Offstage(
                          offstage: expanded,
                          child: Navigator(
                            key: _navigator,
                            onGenerateRoute: (_) => MaterialPageRoute<void>(
                              builder: (_) => _pages(),
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (showPlayer)
                      Positioned(
                        left: expanded ? 0 : 10,
                        right: expanded ? 0 : 10,
                        bottom: expanded ? 0 : 6,
                        height: expanded ? constraints.maxHeight : 76,
                        child: PlayerDock(
                          key: _dockKey,
                          app: widget.app,
                          player: widget.player,
                          openQueue: () {
                            widget.player.minimize();
                            _open(
                              QueuePage(app: widget.app, player: widget.player),
                            );
                          },
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ),
        bottomNavigationBar: widget.player.expanded
            ? null
            : NavigationBar(
                selectedIndex: _tabState.value,
                onDestinationSelected: _select,
                destinations: const [
                  NavigationDestination(
                    icon: Icon(Icons.home_outlined),
                    selectedIcon: Icon(Icons.home),
                    label: 'Home',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.search),
                    label: 'Search',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.trending_up),
                    label: 'Trending',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.library_music_outlined),
                    selectedIcon: Icon(Icons.library_music),
                    label: 'Library',
                  ),
                ],
              ),
      ),
    ),
  );
}
