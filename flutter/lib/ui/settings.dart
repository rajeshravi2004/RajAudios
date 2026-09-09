import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../app_state.dart';
import '../models.dart';
import '../player_state.dart';
import 'common.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key, required this.app, required this.player});
  final AppState app;
  final PlayerStateModel player;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: app,
    builder: (context, _) => Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _heading(context, 'Your account'),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const CircleAvatar(child: Icon(Icons.person_outline)),
            title: Text(app.user == null ? 'Listening as a guest' : app.name),
            subtitle: Text(
              app.user?.email ?? 'Your library stays on this device.',
            ),
          ),
          if (app.user == null)
            FilledButton.icon(
              onPressed: app.supabase == null ? null : app.signIn,
              icon: const Icon(Icons.login),
              label: const Text('Continue with Google'),
            ),
          if (app.supabase == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Google sign-in is not configured in this build. Music and your local library work in guest mode.',
              ),
            ),
          if (app.user != null) ...[
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(app.cloudStatus),
              trailing: IconButton(
                tooltip: 'Sync preferences',
                onPressed: app.syncPreferences,
                icon: const Icon(Icons.sync),
              ),
            ),
            OutlinedButton(
              onPressed: () async {
                player.stop();
                await app.signOut();
              },
              child: const Text('Sign out'),
            ),
          ],
          if (app.isAdmin)
            ListTile(
              leading: const Icon(Icons.admin_panel_settings_outlined),
              title: const Text('Manage users'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(builder: (_) => AdminPage(app: app)),
              ),
            ),
          _heading(context, 'Make it yours'),
          _dropdown('Music language', 'language', {
            for (final l in languages) l: label(l),
          }),
          _dropdown('Trending region', 'region', regions),
          _dropdown('Appearance', 'theme', const {
            'dark': 'Dark',
            'light': 'Light',
            'system': 'Use device theme',
          }),
          _dropdown('Music content filter', 'contentFilterStrength', const {
            'off': 'Off',
            'light': 'Light',
            'moderate': 'Moderate',
            'strict': 'Strict',
          }),
          const Text(
            'Ranks music using titles, artists, duration, and popularity. It is not an explicit-content filter.',
          ),
          _switch(
            'Personalized recommendations',
            'Suggest music based on your listening history.',
            'personalizedRecommendations',
          ),
          _heading(context, 'Playback'),
          _switch(
            'Autoplay next song',
            'Continue through the queue when a song ends.',
            'autoplay',
          ),
          _switch(
            'Shuffle',
            'Choose the next song randomly from the queue.',
            'shuffle',
          ),
          _dropdown('Repeat', 'repeat', const {
            'off': 'Off',
            'one': 'Current song',
            'all': 'Entire queue',
          }),
          const Text('Player volume'),
          Slider(
            value: (app.settings['volume'] as num).toDouble(),
            onChanged: player.volume,
          ),
          _heading(context, 'Bluetooth & audio output'),
          const Text(
            'Pair your headphones in Android settings. Use your phone’s media output selector to choose the connected speaker or headset. Shared listening depends on your phone’s Dual Audio or LE Audio support.',
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => _openSettings(context, 'bluetooth'),
            icon: const Icon(Icons.bluetooth),
            label: const Text('Connect Bluetooth headphones'),
          ),
          OutlinedButton.icon(
            onPressed: () => _openSettings(context, 'sound'),
            icon: const Icon(Icons.speaker_outlined),
            label: const Text('Open sound settings'),
          ),
          const Text(
            'The Windows app’s independent output volume and delay controls are not available on Android. Music continues when you switch apps or lock your phone. Use the notification or lock-screen controls to play, pause, seek, or skip. Closing the player or dismissing Rajify from recent apps stops playback.',
          ),
          _heading(context, 'YouTube API access'),
          Text(
            app.api.hasPersonalKey
                ? 'Using your personal session key.'
                : 'Using the shared Rajify music service.',
          ),
          const SizedBox(height: 8),
          const Text(
            'If the shared quota runs out, add a personal YouTube Data API key. It stays in memory until you remove it, sign out, or close the app.',
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => showDialog<void>(
              context: context,
              builder: (_) => SessionKeyDialog(app: app),
            ),
            child: const Text('Add session API key'),
          ),
          if (app.api.hasPersonalKey)
            TextButton(
              onPressed: () {
                app.api.clearKey();
                app.report('Session key removed.');
              },
              child: const Text('Remove session key'),
            ),
          _heading(context, 'Privacy & storage'),
          _switch(
            'Save listening history',
            'Store the last 100 songs on this phone.',
            'saveHistory',
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Clear listening history'),
            trailing: const Icon(Icons.delete_outline),
            onTap: () async {
              if (await confirm(
                context,
                'Clear history?',
                'Remove the listening history stored on this device?',
              )) {
                app.clearHistory();
              }
            },
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Clear search history'),
            trailing: const Icon(Icons.clear),
            onTap: app.clearSearches,
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Clear music cache'),
            trailing: const Icon(Icons.refresh),
            onTap: () {
              app.api.clearCache();
              toast(
                context,
                'Music cache cleared. Pull down to refresh discovery.',
              );
            },
          ),
          _heading(context, 'Rajify for Android'),
          const Text(
            'Version 1.1.0 • Built with Flutter\nNative discovery, search, library, settings, and playback controls. Music streams through the YouTube player.',
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Source code & APK releases'),
            trailing: const Icon(Icons.open_in_new),
            onTap: () => openExternal(
              context,
              Uri.parse('https://github.com/rajeshravi2004/RajAudios'),
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Open-source licenses'),
            onTap: () => showLicensePage(
              context: context,
              applicationName: 'Rajify',
              applicationVersion: '1.1.0',
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    ),
  );
  Widget _heading(BuildContext context, String text) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 12),
    child: Text(
      text,
      style: Theme.of(context).textTheme.titleLarge
          ?.copyWith(fontWeight: FontWeight.bold),
    ),
  );
  Widget _dropdown(String title, String key, Map<String, String> options) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: DropdownButtonFormField<String>(
          key: ValueKey('$key:${app.settings[key]}'),
          initialValue: app.settings[key] as String,
          decoration: InputDecoration(labelText: title),
          items: options.entries
              .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
              .toList(),
          onChanged: (value) {
            if (value != null) app.updateSettings({key: value});
          },
        ),
      );
  Widget _switch(String title, String subtitle, String key) =>
      SwitchListTile.adaptive(
        contentPadding: EdgeInsets.zero,
        title: Text(title),
        subtitle: Text(subtitle),
        value: app.settings[key] == true,
        onChanged: (value) => app.updateSettings({key: value}),
      );
  Future<void> _openSettings(BuildContext context, String target) async {
    try {
      await const MethodChannel('com.rajaudios.rajify/device')
          .invokeMethod<void>('openSettings', target);
    } catch (_) {
      if (context.mounted) {
        toast(
          context,
          'Open your phone’s Settings app to manage Bluetooth and sound.',
        );
      }
    }
  }
}

class SessionKeyDialog extends StatefulWidget {
  const SessionKeyDialog({super.key, required this.app});
  final AppState app;
  @override
  State<SessionKeyDialog> createState() => _SessionKeyDialogState();
}

class _SessionKeyDialogState extends State<SessionKeyDialog> {
  final _key = TextEditingController();
  bool _busy = false;
  String? _error;
  @override
  void dispose() {
    _key.clear();
    _key.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.app.api.setPersonalKey(_key.text);
      if (mounted) {
        widget.app.report(
          'Session key validated. Refresh discovery to use it.',
        );
        Navigator.pop(context);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = '$error';
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Personal session key'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _key,
          obscureText: true,
          enableSuggestions: false,
          autocorrect: false,
          decoration: const InputDecoration(labelText: 'YouTube Data API key'),
          onSubmitted: (_) {
            if (!_busy) _save();
          },
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(_error!),
          ),
        if (_busy)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: LinearProgressIndicator(),
          ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: _busy ? null : () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: _busy ? null : _save,
        child: const Text('Validate & use'),
      ),
    ],
  );
}

class AdminPage extends StatefulWidget {
  const AdminPage({super.key, required this.app});
  final AppState app;
  @override
  State<AdminPage> createState() => _AdminPageState();
}

class _AdminPageState extends State<AdminPage> {
  List<Map<String, dynamic>> _users = [];
  bool _busy = false;
  int _page = 1, _total = 0;
  String? _error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<Map<String, dynamic>> _request({
    Map<String, dynamic>? deletion,
  }) async {
    final session = widget.app.supabase?.auth.currentSession;
    if (session == null || !widget.app.isAdmin) {
      throw Exception('Owner sign-in is required.');
    }
    final url = Uri.parse(widget.app.api.baseUrl)
        .resolve('/api/admin-users')
        .replace(queryParameters: {'page': '$_page', 'perPage': '50'});
    final headers = {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    };
    final response =
        await (deletion == null
                ? http.get(url, headers: headers)
                : http.delete(
                    url,
                    headers: headers,
                    body: jsonEncode(deletion),
                  ))
            .timeout(const Duration(seconds: 30));
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw Exception(data['error'] ?? 'Admin request failed.');
    }
    return data;
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await _request();
      if (mounted) {
        setState(() {
          _users = (data['users'] as List).cast<Map<String, dynamic>>();
          _total = (data['total'] as num?)?.toInt() ?? _users.length;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete(Map<String, dynamic>? user) async {
    if (!await confirm(
      context,
      user == null ? 'Delete all other users?' : 'Delete this user?',
      user == null
          ? 'Permanently delete all non-owner accounts and their cloud preferences. The owner is protected.'
          : 'Permanently delete ${user['email']} and their cloud preferences?',
    )) {
      return;
    }
    if (!mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _request(
        deletion: user == null
            ? {'allExceptOwner': true}
            : {'userId': user['id']},
      );
      if (!mounted) return;
      _page = 1;
      await _load();
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = '$error';
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Manage users')),
    body: ListView(
      children: [
        if (_busy) const LinearProgressIndicator(),
        if (_error != null) ErrorMessage(_error!, _load),
        ListTile(
          title: Text('$_total registered users'),
          subtitle: const Text(
            'Owner access is verified by the server for every request.',
          ),
          trailing: IconButton(
            tooltip: 'Refresh users',
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ),
        for (final user in _users)
          ListTile(
            leading: Icon(
              user['isOwner'] == true
                  ? Icons.shield_outlined
                  : Icons.person_outline,
            ),
            title: Text(user['name'] as String? ?? 'Listener'),
            subtitle: Text(user['email'] as String? ?? ''),
            trailing: user['isOwner'] == true
                ? const Chip(label: Text('Owner'))
                : IconButton(
                    tooltip: 'Delete user',
                    onPressed: _busy ? null : () => _delete(user),
                    icon: const Icon(Icons.delete_outline),
                  ),
          ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              tooltip: 'Previous page',
              onPressed: _busy || _page <= 1
                  ? null
                  : () {
                      _page--;
                      _load();
                    },
              icon: const Icon(Icons.chevron_left),
            ),
            Text('Page $_page'),
            IconButton(
              tooltip: 'Next page',
              onPressed: _busy || _page * 50 >= _total
                  ? null
                  : () {
                      _page++;
                      _load();
                    },
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.all(24),
          child: OutlinedButton(
            onPressed: _busy ? null : () => _delete(null),
            child: const Text('Delete all non-owner accounts'),
          ),
        ),
      ],
    ),
  );
}
