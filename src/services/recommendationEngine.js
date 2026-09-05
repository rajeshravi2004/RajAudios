/**
 * recommendationEngine.js — Lightweight personalized recommendation system
 * 
 * Tracks user behavior and generates weighted recommendation scores.
 * No ML required — rule-based scoring with per-signal weights.
 * 
 * Designed so a real ML model can replace generateCandidateScores() later.
 */

// No external imports needed for core functions

// ─── Score weights ─────────────────────────────────────────────────────────────
const WEIGHTS = {
  artistAffinity: 40,       // How often this artist appears in history
  channelAffinity: 20,      // Same channel as liked/played tracks  
  languageAffinity: 15,     // Matches preferred language
  popularity: 10,           // View count normalized
  freshness: 10,            // Newer content slightly preferred
  completionBonus: 15,      // Tracks user listened to > 80%
  skipPenalty: -30,         // Tracks user skipped < 20%
  recentlyPlayedPenalty: -20, // Already played in last 2 hours
  likedBonus: 35,           // User liked this artist's other tracks
}

// ─── Profile building ──────────────────────────────────────────────────────────

/**
 * Build a listening profile from history
 * @param {Array} history - Play history entries
 * @returns {object} profile
 */
export const buildProfile = (history = []) => {
  const artistCounts = {}
  const channelCounts = {}
  const recentIds = new Set()
  const likedArtists = new Set()
  
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  let totalCompletionPct = 0
  let trackCount = 0

  for (const entry of history) {
    const artist = entry.channel || ''
    const channelId = entry.channelId || ''

    // Count artist plays
    if (artist) {
      artistCounts[artist] = (artistCounts[artist] || 0) + 1
    }
    if (channelId) {
      channelCounts[channelId] = (channelCounts[channelId] || 0) + 1
    }

    // Recently played
    if (entry.playedAt > twoHoursAgo) {
      recentIds.add(entry.id)
    }

    // High completion = affinity signal
    if ((entry.completionPct || 0) >= 80 && entry.playedAt > oneWeekAgo) {
      if (artist) likedArtists.add(artist)
    }

    totalCompletionPct += entry.completionPct || 0
    trackCount++
  }

  // Top 10 artists by play count
  const topArtists = Object.entries(artistCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  const avgCompletion = trackCount > 0 ? totalCompletionPct / trackCount : 50

  return {
    topArtists,
    artistCounts,
    channelCounts,
    recentIds,
    likedArtists,
    avgCompletion,
    totalPlays: trackCount,
  }
}

/**
 * Score a candidate track against a listening profile
 * @param {object} track - Normalized track
 * @param {object} profile - From buildProfile()
 * @returns {{ score: number, explanation: string }}
 */
export const scoreCandidate = (track, profile) => {
  let score = 0
  const signals = []

  const artist = track.channel || ''
  const channelId = track.channelId || ''
  const trackId = track.id || ''

  // ── Artist affinity ─────────────────────────────────────────────────────────
  const artistPlayCount = profile.artistCounts[artist] || 0
  if (artistPlayCount > 0) {
    const normalized = Math.min(artistPlayCount / 10, 1) // cap at 10 plays = full affinity
    const contribution = Math.round(WEIGHTS.artistAffinity * normalized)
    score += contribution
    if (contribution >= 20) signals.push(`Because you listen to ${artist}`)
    else if (contribution > 0) signals.push(`You've played ${artist} before`)
  }

  // ── Channel affinity ────────────────────────────────────────────────────────
  if (channelId && profile.channelCounts[channelId] > 2) {
    score += WEIGHTS.channelAffinity * 0.5
  }

  // ── Liked artist ────────────────────────────────────────────────────────────
  if (profile.likedArtists.has(artist)) {
    score += WEIGHTS.likedBonus
    if (!signals.length) signals.push(`Because you like ${artist}`)
  }

  // ── Popularity ──────────────────────────────────────────────────────────────
  const views = parseInt(track.viewCount || '0', 10)
  if (views >= 100_000_000) score += WEIGHTS.popularity
  else if (views >= 10_000_000) score += Math.round(WEIGHTS.popularity * 0.7)
  else if (views >= 1_000_000) score += Math.round(WEIGHTS.popularity * 0.4)

  // ── Freshness ───────────────────────────────────────────────────────────────
  if (track.publishedAt) {
    const publishedMs = new Date(track.publishedAt).getTime()
    const ageMs = Date.now() - publishedMs
    const ageDays = ageMs / 86_400_000
    if (ageDays < 7) {
      score += WEIGHTS.freshness
      signals.push('New release')
    } else if (ageDays < 30) {
      score += Math.round(WEIGHTS.freshness * 0.5)
    }
  }

  // ── Recently played penalty ─────────────────────────────────────────────────
  if (profile.recentIds.has(trackId)) {
    score += WEIGHTS.recentlyPlayedPenalty
  }

  return {
    score,
    explanation: signals[0] || null, // Primary explanation for "Why this song?"
  }
}

/**
 * Generate explanation string for UI
 * @param {object} track
 * @param {object} profile  
 * @param {string} context - 'trending' | 'similar' | 'language' | 'autoplay'
 */
export const generateExplanation = (track, profile, context = 'autoplay') => {
  const artist = track.channel?.replace(/ - Topic$/, '') || ''
  
  if (context === 'trending') {
    return 'Trending now'
  }
  
  if (context === 'language') {
    return 'Popular in your language'
  }

  if (!profile || profile.totalPlays === 0) {
    return 'Recommended for you'
  }

  const { explanation } = scoreCandidate(track, profile)
  
  if (explanation) return explanation

  const topArtist = profile.topArtists[0]?.name
  if (topArtist && artist !== topArtist) {
    return `Similar to ${topArtist}`
  }

  return 'Recommended for you'
}

/**
 * Rank candidate tracks using the profile
 * @param {Array} candidates - Normalized tracks
 * @param {object} profile - From buildProfile()
 * @param {object} options
 * @returns {Array} Sorted tracks with explanations
 */
export const rankCandidates = (candidates, profile, options = {}) => {
  const { maxPerArtist = 2 } = options
  
  if (!candidates?.length) return []

  const scored = candidates.map(track => ({
    track,
    ...scoreCandidate(track, profile),
  }))

  scored.sort((a, b) => b.score - a.score)

  // Artist diversity — avoid too many from same artist
  const artistCount = {}
  const result = []
  
  for (const { track, explanation } of scored) {
    const artist = track.channel || 'unknown'
    const count = artistCount[artist] || 0
    if (count < maxPerArtist) {
      artistCount[artist] = count + 1
      result.push({ ...track, _explanation: explanation })
    }
  }

  return result
}

/**
 * Main function: get next track for autoplay
 * @param {object} currentTrack - Currently playing
 * @param {Array} recentHistory - Recent play history
 * @param {Array} candidates - Available tracks to choose from
 * @param {object} filterOptions - Content filter settings
 */
export const getAutoplayNext = async (currentTrack, recentHistory, candidates, _filterOptions = {}) => {
  if (!candidates?.length) return null

  const profile = buildProfile(recentHistory)
  
  // Exclude recently played
  const notRecent = candidates.filter(t => !profile.recentIds.has(t.id) && t.id !== currentTrack?.id)
  
  if (!notRecent.length) {
    // If everything is recently played, just pick from all candidates
    const ranked = rankCandidates(candidates.filter(t => t.id !== currentTrack?.id), profile)
    return ranked[0] || candidates[0]
  }

  const ranked = rankCandidates(notRecent, profile)
  return ranked[0] || notRecent[0]
}
