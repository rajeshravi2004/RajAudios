import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'models.dart';
import 'services/music_api.dart';

class AppState extends ChangeNotifier {
  AppState(this.storage, this.api, {this.supabase}) {
    settings = _validatedSettings(_readMap('settings'));
    favorites = _readList('favorites').map(Track.fromJson).toList();
    history = _readList('history').map(Track.fromJson).take(100).toList();
    playlists = _readList('playlists').map(MusicPlaylist.fromJson).toList();
    searches = storage.getStringList('recent_searches') ?? [];
    _authSubscription = supabase?.auth.onAuthStateChange.listen((event) {
      notifyListeners();
      // Avoid making Supabase requests inside its auth callback.
      if (event.session?.user.id != _loadedUser) {
        unawaited(Future<void>(() => syncPreferences()));
      }
    });
    if (user != null) unawaited(Future<void>(() => syncPreferences()));
  }
  final SharedPreferences storage;
  final MusicApi api;
  final SupabaseClient? supabase;
  StreamSubscription<AuthState>? _authSubscription;
  String? _loadedUser;
  int _syncGeneration = 0;
  Future<void> _writes = Future.value();
  bool _disposed = false;
  late Map<String, dynamic> settings;
  late List<Track> favorites, history;
  late List<MusicPlaylist> playlists;
  late List<String> searches;
  String cloudStatus = 'Saved on this device';
  String? message;
  User? get user => supabase?.auth.currentUser;
  String get language => settings['language'] as String;
  String get region => settings['region'] as String;
  String get name =>
      user?.userMetadata?['full_name'] as String? ??
      user?.email?.split('@').first ??
      'Listener';
  bool get isAdmin =>
      user?.email?.toLowerCase() ==
      const String.fromEnvironment(
        'ADMIN_EMAIL',
        defaultValue: 'ravirajesh988@gmail.com',
      ).toLowerCase();
  bool get guest => storage.getBool('guest') ?? false;
  bool get needsWelcome => !guest && user == null;

  Map<String, dynamic> _readMap(String key) {
    try {
      return Map<String, dynamic>.from(
        jsonDecode(storage.getString(key) ?? '{}'),
      );
    } catch (_) {
      return {};
    }
  }

  List<Map<String, dynamic>> _readList(String key) {
    try {
      return (jsonDecode(storage.getString(key) ?? '[]') as List)
          .cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  void report(Object error) {
    message = '$error';
    notifyListeners();
  }

  void dismissMessage() {
    message = null;
  }

  void _persist(String key, Object value) {
    final encoded = jsonEncode(value);
    _writes = _writes
        .then((_) async {
          if (!await storage.setString(key, encoded)) {
            throw Exception('Could not save your changes on this device.');
          }
        })
        .catchError((Object error) {
          if (!_disposed) report(error);
        });
  }

  Future<void> get saved => _writes;
  Future<void> continueAsGuest() async {
    await storage.setBool('guest', true);
    notifyListeners();
  }

  Future<void> signIn() async {
    if (supabase == null) {
      report(
        'Google sign-in is not configured in this build. You can continue as a guest.',
      );
      return;
    }
    try {
      await supabase!.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: 'com.rajaudios.rajify://login-callback/',
        authScreenLaunchMode: LaunchMode.externalApplication,
      );
    } catch (_) {
      report('Could not open Google sign-in. Please try again.');
    }
  }

  Future<void> signOut() async {
    try {
      await supabase?.auth.signOut();
      _syncGeneration++;
      _loadedUser = null;
      api.clearKey();
      cloudStatus = 'Saved on this device';
      await storage.setBool('guest', false);
      notifyListeners();
    } catch (_) {
      report('Sign-out failed. Check your connection and try again.');
    }
  }

  Map<String, dynamic> _validatedSettings(Map<String, dynamic> value) {
    final result = {...defaultSettings, ...value};
    if (!languages.contains(result['language'])) result['language'] = 'tamil';
    if (!regions.containsKey(result['region'])) result['region'] = 'IN';
    if (![
      'off',
      'light',
      'moderate',
      'strict',
    ].contains(result['contentFilterStrength'])) {
      result['contentFilterStrength'] = 'moderate';
    }
    if (!['dark', 'light', 'system'].contains(result['theme'])) {
      result['theme'] = 'dark';
    }
    if (!['off', 'one', 'all'].contains(result['repeat'])) {
      result['repeat'] = 'off';
    }
    result['volume'] = result['volume'] is num
        ? (result['volume'] as num).clamp(0, 1).toDouble()
        : 0.8;
    for (final key in [
      'shuffle',
      'autoplay',
      'saveHistory',
      'personalizedRecommendations',
    ]) {
      if (result[key] is! bool) result[key] = defaultSettings[key];
    }
    return result;
  }

  Future<void> syncPreferences() async {
    final account = user;
    final generation = ++_syncGeneration;
    if (account == null || supabase == null) {
      _loadedUser = null;
      return;
    }
    _loadedUser = account.id;
    cloudStatus = 'Syncing preferences…';
    notifyListeners();
    try {
      final row = await supabase!
          .from('user_preferences')
          .select('settings')
          .eq('user_id', account.id)
          .maybeSingle();
      if (_disposed ||
          user?.id != account.id ||
          generation != _syncGeneration) {
        return;
      }
      if (row != null) {
        settings = _validatedSettings(
          Map<String, dynamic>.from(row['settings'] as Map),
        );
        _persist('settings', settings);
      } else {
        await _pushPreferences(account.id, Map.of(settings));
      }
      if (_disposed ||
          user?.id != account.id ||
          generation != _syncGeneration) {
        return;
      }
      cloudStatus = 'Preferences synced';
    } catch (_) {
      if (_disposed || generation != _syncGeneration) return;
      cloudStatus = 'Sync unavailable • changes saved locally';
    }
    if (!_disposed) notifyListeners();
  }

  Future<void> _pushPreferences(String id, Map<String, dynamic> value) async {
    await supabase!.from('user_preferences').upsert({
      'user_id': id,
      'settings': value,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  Future<void> _cloudWrite(
    String id,
    Map<String, dynamic> value,
    int generation,
  ) async {
    try {
      if (user?.id != id || generation != _syncGeneration) return;
      await _pushPreferences(id, value);
      if (!_disposed && user?.id == id && generation == _syncGeneration) {
        cloudStatus = 'Preferences synced';
        notifyListeners();
      }
    } catch (_) {
      if (!_disposed && generation == _syncGeneration) {
        cloudStatus = 'Sync unavailable • changes saved locally';
        notifyListeners();
      }
    }
  }

  Future<void> _cloudWrites = Future.value();
  void updateSettings(Map<String, dynamic> updates) {
    settings = _validatedSettings({...settings, ...updates});
    _persist('settings', settings);
    final account = user;
    final generation = ++_syncGeneration;
    if (account != null) {
      cloudStatus = 'Syncing preferences…';
      final snapshot = Map<String, dynamic>.of(settings);
      _cloudWrites = _cloudWrites.then(
        (_) => _cloudWrite(account.id, snapshot, generation),
      );
    }
    notifyListeners();
  }

  List<Track> filter(List<Track> tracks) => tracks
      .where(
        (t) => passesFilter(t, settings['contentFilterStrength'] as String),
      )
      .toList();
  bool isFavorite(Track track) => favorites.any((t) => t.id == track.id);
  void toggleFavorite(Track track) {
    if (isFavorite(track)) {
      favorites.removeWhere((t) => t.id == track.id);
    } else {
      favorites.insert(0, track);
    }
    _persist('favorites', favorites.map((t) => t.toJson()).toList());
    notifyListeners();
  }

  void recordPlay(Track track) {
    if (settings['saveHistory'] != true) return;
    history = [
      track,
      ...history.where((t) => t.id != track.id),
    ].take(100).toList();
    _persist('history', history.map((t) => t.toJson()).toList());
    notifyListeners();
  }

  void clearHistory() {
    history.clear();
    _persist('history', []);
    notifyListeners();
  }

  void rememberSearch(String query) {
    searches = [query, ...searches.where((s) => s != query)].take(8).toList();
    unawaited(storage.setStringList('recent_searches', searches));
    notifyListeners();
  }

  void clearSearches() {
    searches.clear();
    unawaited(storage.remove('recent_searches'));
    notifyListeners();
  }

  MusicPlaylist createPlaylist(String title, [List<Track> tracks = const []]) {
    final list = MusicPlaylist(
      id: 'pl_${DateTime.now().microsecondsSinceEpoch}',
      title: title.trim(),
      tracks: List.of(tracks),
    );
    playlists.insert(0, list);
    savePlaylists();
    return list;
  }

  void savePlaylists() {
    _persist('playlists', playlists.map((p) => p.toJson()).toList());
    notifyListeners();
  }

  void deletePlaylist(MusicPlaylist playlist) {
    playlists.removeWhere((p) => p.id == playlist.id);
    savePlaylists();
  }

  void addToPlaylist(MusicPlaylist playlist, Track track) {
    if (playlist.tracks.every((t) => t.id != track.id)) {
      playlist.tracks.add(track);
      savePlaylists();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _authSubscription?.cancel();
    api.dispose();
    super.dispose();
  }
}
