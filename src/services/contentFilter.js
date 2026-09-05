/**
 * contentFilter.js — Music content quality scoring
 * 
 * Scores YouTube videos to prioritize genuine music content and de-prioritize
 * non-music, low-quality, or misleading uploads.
 * 
 * IMPORTANT: This filter does NOT make any copyright or legal claims.
 * It ranks by "likelihood of being quality music content" based on available metadata.
 */

// ─── Signals ───────────────────────────────────────────────────────────────────

const POSITIVE_SIGNALS = {
  // Channel type signals
  officialArtistChannel: 30,    // Channel kind includes "artist"
  topicChannel: 25,             // Channel name ends in " - Topic"
  verifiedChannel: 10,          // High view count as proxy

  // Title signals
  officialAudio: 20,            // "official audio" in title
  officialVideo: 15,            // "official video" or "official music video" in title
  officialLyrics: 15,           // "official lyrics" or "lyrics video" in title
  audioOnly: 10,                // "audio" in title (weaker)
  
  // View count signals
  highViews: 10,                // > 10M views
  moderateViews: 5,             // > 1M views

  // Duration signals
  idealDuration: 10,            // 2:30 - 6:00 (typical song length)
  acceptableDuration: 5,        // 1:30 - 9:00
}

const NEGATIVE_SIGNALS = {
  // Content type penalties
  reaction: -25,
  review: -20,
  podcast: -25,
  interview: -20,
  commentary: -20,
  tutorial: -20,
  howto: -15,
  unboxing: -20,
  vlog: -20,
  gaming: -25,
  news: -20,
  
  // Music-adjacent but lower quality
  karaoke: -15,
  instrumental: 0,             // not penalized — user preference
  cover: -5,                   // slight penalty, configurable
  remix: -5,                   // slight penalty
  
  // Quality issues
  short: -30,                  // < 60s (likely a Short/clip)
  veryLong: -15,               // > 15 min (likely not a song)
  
  // Spam/low quality
  compilation: -10,
  top10: -15,                  // "top 10 songs" type content
  mashup: -10,
  
  // Duplicate signals
  bestOf: -5,
  fullAlbum: -10,              // full album is ok but not ideal for track-based player
}

// ─── Title keyword patterns ────────────────────────────────────────────────────

const matchesAny = (text, patterns) => {
  const lower = text.toLowerCase()
  return patterns.some(p => lower.includes(p))
}

const NEGATIVE_TITLE_PATTERNS = [
  'reaction', 'reacts', 'reacting',
  'review', 'reviewed',
  'podcast', 'interview', 'q&a',
  'tutorial', 'how to', 'howto', 'lesson',
  'unboxing', 'vlog', 'gaming', 'gameplay',
  'news', 'commentary', 'discussion',
  'top 10', 'top 5', 'best songs', 'top songs',
  'my reaction', 'i react',
]

const NEGATIVE_CHANNEL_PATTERNS = [
  'react', 'reacts', 'reaction', 'podcast',
  'news', 'reviews', 'gaming', 'vlog',
]

// ─── Score calculator ─────────────────────────────────────────────────────────

/**
 * Score a normalized track (0 = filter out, higher = better quality music)
 * @param {object} track - Normalized track from youtubeService
 * @param {object} options - Filter settings
 * @returns {{ score: number, reasons: string[], pass: boolean }}
 */
export const scoreTrack = (track, options = {}) => {
  const {
    strength = 'moderate',  // 'off' | 'light' | 'moderate' | 'strict'
    penalizeCovers = false,
    penalizeRemixes = false,
  } = options

  if (strength === 'off') {
    return { score: 50, reasons: [], pass: true }
  }

  let score = 50 // neutral baseline
  const reasons = []

  const title = (track.title || '').toLowerCase()
  const channel = (track.channel || '').toLowerCase()

  // ── Channel type ────────────────────────────────────────────────────────────
  if (channel.endsWith(' - topic')) {
    score += POSITIVE_SIGNALS.topicChannel
    reasons.push('Official artist topic channel')
  }

  // ── Title signals ───────────────────────────────────────────────────────────
  if (title.includes('official audio')) {
    score += POSITIVE_SIGNALS.officialAudio
    reasons.push('Official audio')
  } else if (title.includes('official video') || title.includes('official music video') || title.includes('official mv')) {
    score += POSITIVE_SIGNALS.officialVideo
    reasons.push('Official music video')
  } else if (title.includes('official lyrics') || title.includes('lyric video') || title.includes('lyrics video')) {
    score += POSITIVE_SIGNALS.officialLyrics
    reasons.push('Official lyrics video')
  } else if (title.includes('(audio)') || title.includes('[audio]')) {
    score += POSITIVE_SIGNALS.audioOnly
  }

  // ── Negative title patterns ─────────────────────────────────────────────────
  if (matchesAny(title, NEGATIVE_TITLE_PATTERNS)) {
    const penalty = strength === 'strict' ? -35 : -20
    score += penalty
    reasons.push('Non-music content detected in title')
  }

  if (matchesAny(channel, NEGATIVE_CHANNEL_PATTERNS)) {
    const penalty = strength === 'strict' ? -25 : -10
    score += penalty
    reasons.push('Reaction/non-music channel')
  }

  // ── Karaoke / instrumental ──────────────────────────────────────────────────
  if (title.includes('karaoke') || title.includes('sing along')) {
    score += NEGATIVE_SIGNALS.karaoke
    reasons.push('Karaoke')
  }

  if (penalizeCovers && (title.includes(' cover') || title.includes('(cover'))) {
    score += NEGATIVE_SIGNALS.cover
  }

  if (penalizeRemixes && title.includes('remix')) {
    score += NEGATIVE_SIGNALS.remix
  }

  // ── Compilation signals ─────────────────────────────────────────────────────
  if (title.includes('compilation') || title.includes('top 10') || title.includes('best of')) {
    score += NEGATIVE_SIGNALS.compilation
  }

  if (title.includes('full album')) {
    score += NEGATIVE_SIGNALS.fullAlbum
  }

  // ── Duration ────────────────────────────────────────────────────────────────
  const dur = track.durationSec || track.duration || 0
  if (dur > 0) {
    if (dur < 60) {
      score += NEGATIVE_SIGNALS.short
      reasons.push('Too short (likely a clip/Short)')
    } else if (dur > 900) {  // > 15 min
      score += NEGATIVE_SIGNALS.veryLong
    } else if (dur >= 150 && dur <= 360) {  // 2:30–6:00
      score += POSITIVE_SIGNALS.idealDuration
    } else if (dur >= 90 && dur <= 540) {  // 1:30–9:00
      score += POSITIVE_SIGNALS.acceptableDuration
    }
  }

  // ── View count ──────────────────────────────────────────────────────────────
  const views = parseInt(track.viewCount || '0', 10)
  if (views >= 10_000_000) {
    score += POSITIVE_SIGNALS.highViews
  } else if (views >= 1_000_000) {
    score += POSITIVE_SIGNALS.moderateViews
  }

  // ── Pass threshold by strength ──────────────────────────────────────────────
  const thresholds = { light: 20, moderate: 35, strict: 50 }
  const threshold = thresholds[strength] || thresholds.moderate

  return {
    score,
    reasons,
    pass: score >= threshold,
  }
}

/**
 * Filter a list of tracks
 */
export const filterTracks = (tracks, options = {}) => {
  if (!tracks?.length) return []
  return tracks.filter(track => {
    const { pass } = scoreTrack(track, options)
    return pass
  })
}

/**
 * Sort tracks by quality score (best first)
 */
export const rankTracks = (tracks, options = {}) => {
  if (!tracks?.length) return []
  return [...tracks]
    .map(track => ({ track, ...scoreTrack(track, options) }))
    .sort((a, b) => b.score - a.score)
    .map(({ track }) => track)
}
