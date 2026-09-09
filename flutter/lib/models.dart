import 'package:html_unescape/html_unescape_small.dart';

final _html = HtmlUnescape();

int durationSeconds(String value) {
  final match = RegExp(r'^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$')
      .firstMatch(value);
  if (match == null) return 0;
  return (int.tryParse(match[1] ?? '') ?? 0) * 3600 +
      (int.tryParse(match[2] ?? '') ?? 0) * 60 +
      (int.tryParse(match[3] ?? '') ?? 0);
}

String clockTime(int seconds) {
  final minutes = seconds ~/ 60;
  return '${minutes ~/ 60 > 0 ? '${minutes ~/ 60}:' : ''}'
      '${minutes >= 60 ? (minutes % 60).toString().padLeft(2, '0') : minutes}:'
      '${(seconds % 60).toString().padLeft(2, '0')}';
}

class Track {
  const Track({
    required this.id,
    required this.title,
    required this.channel,
    this.thumbnail = '',
    this.duration = 0,
    this.views = 0,
  });
  final String id, title, channel, thumbnail;
  final int duration, views;

  factory Track.fromJson(Map<String, dynamic> json) => Track(
    id: json['id'] as String,
    title: json['title'] as String? ?? 'Unknown track',
    channel: json['channel'] as String? ?? 'Unknown artist',
    thumbnail: json['thumbnail'] as String? ?? '',
    duration: (json['durationSec'] as num?)?.toInt() ?? 0,
    views: int.tryParse('${json['viewCount']}') ?? 0,
  );

  factory Track.youtube(
    Map<String, dynamic> json, {
    bool playlistItem = false,
  }) {
    final snippet = json['snippet'] as Map<String, dynamic>? ?? {};
    final details = json['contentDetails'] as Map<String, dynamic>? ?? {};
    final rawId = playlistItem
        ? (snippet['resourceId']?['videoId'] ?? details['videoId'])
        : json['id'];
    final id = (rawId is Map ? rawId['videoId'] : rawId) as String? ?? '';
    return Track(
      id: id,
      title: _html.convert(snippet['title'] as String? ?? 'Unknown track'),
      channel: _html.convert(
        (snippet['videoOwnerChannelTitle'] ?? snippet['channelTitle'])
                as String? ??
            'Unknown artist',
      ),
      thumbnail:
          (snippet['thumbnails']?['high']?['url'] ??
                  snippet['thumbnails']?['medium']?['url'])
              as String? ??
          'https://i.ytimg.com/vi/$id/hqdefault.jpg',
      duration: durationSeconds(details['duration'] as String? ?? ''),
      views: int.tryParse('${json['statistics']?['viewCount']}') ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'channel': channel,
    'thumbnail': thumbnail,
    'durationSec': duration,
    'viewCount': views,
  };
}

class MusicPlaylist {
  MusicPlaylist({
    required this.id,
    required this.title,
    this.channel = '',
    this.thumbnail = '',
    List<Track>? tracks,
    this.remote = false,
  }) : tracks = tracks ?? [];
  final String id, channel, thumbnail;
  String title;
  final List<Track> tracks;
  final bool remote;
  factory MusicPlaylist.fromJson(Map<String, dynamic> json) => MusicPlaylist(
    id: json['id'] as String,
    title: json['title'] as String,
    tracks: (json['tracks'] as List? ?? [])
        .map((e) => Track.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
  );
  factory MusicPlaylist.youtube(Map<String, dynamic> json) {
    final s = json['snippet'] as Map<String, dynamic>? ?? {};
    final rawId = json['id'];
    return MusicPlaylist(
      id: (rawId is Map ? rawId['playlistId'] : rawId) as String,
      title: _html.convert(s['title'] as String? ?? 'Playlist'),
      channel: _html.convert(s['channelTitle'] as String? ?? ''),
      thumbnail: s['thumbnails']?['medium']?['url'] as String? ?? '',
      remote: true,
    );
  }
  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'tracks': tracks.map((t) => t.toJson()).toList(),
  };
}

class PageResult<T> {
  const PageResult(this.items, this.nextPageToken);
  final List<T> items;
  final String? nextPageToken;
}

const languages = [
  'tamil',
  'hindi',
  'english',
  'telugu',
  'malayalam',
  'kannada',
  'bengali',
  'marathi',
  'punjabi',
  'gujarati',
  'urdu',
  'korean',
  'japanese',
  'spanish',
  'french',
  'arabic',
  'portuguese',
  'german',
  'italian',
  'chinese',
];
const regions = {
  'IN': 'India',
  'US': 'United States',
  'GB': 'United Kingdom',
  'KR': 'South Korea',
  'JP': 'Japan',
  'MX': 'Mexico',
  'FR': 'France',
  'DE': 'Germany',
  'BR': 'Brazil',
  'PK': 'Pakistan',
  'CA': 'Canada',
  'AU': 'Australia',
  'AE': 'United Arab Emirates',
  'IT': 'Italy',
  'TW': 'Taiwan',
};
String label(String value) =>
    value.isEmpty ? value : '${value[0].toUpperCase()}${value.substring(1)}';

const defaultSettings = <String, dynamic>{
  'language': 'tamil',
  'region': 'IN',
  'volume': 0.8,
  'shuffle': false,
  'repeat': 'off',
  'autoplay': true,
  'contentFilterStrength': 'moderate',
  'theme': 'dark',
  'saveHistory': true,
  'personalizedRecommendations': true,
};

bool passesFilter(Track track, String strength) {
  if (strength == 'off') return true;
  final title = track.title.toLowerCase(),
      channel = track.channel.toLowerCase();
  var score = 50;
  if (channel.endsWith(' - topic')) score += 25;
  if (title.contains('official audio')) {
    score += 20;
  } else if (RegExp(r'official (music video|video|mv|lyrics)|lyric[s]? video')
      .hasMatch(title)) {
    score += 15;
  } else if (title.contains('(audio)') || title.contains('[audio]')) {
    score += 10;
  }
  if (RegExp(
    r'reaction|reacts|reacting|review|podcast|interview|q&a|tutorial|how to|howto|lesson|unboxing|vlog|gaming|gameplay|news|commentary|discussion|top 10|top 5|best songs|top songs',
  ).hasMatch(title)) {
    score -= strength == 'strict' ? 35 : 20;
  }
  if (RegExp(r'react|podcast|news|reviews|gaming|vlog').hasMatch(channel)) {
    score -= strength == 'strict' ? 25 : 10;
  }
  if (title.contains('karaoke') || title.contains('sing along')) score -= 15;
  if (RegExp(r'compilation|top 10|best of').hasMatch(title)) score -= 10;
  if (title.contains('full album')) score -= 10;
  if (track.duration > 0 && track.duration < 60) score -= 30;
  if (track.duration > 900) score -= 15;
  if (track.duration >= 150 && track.duration <= 360) {
    score += 10;
  } else if (track.duration >= 90 && track.duration <= 540) {
    score += 5;
  }
  if (track.views >= 10000000) {
    score += 10;
  } else if (track.views >= 1000000) {
    score += 5;
  }
  return score >= ({'light': 20, 'moderate': 35, 'strict': 50}[strength] ?? 35);
}
