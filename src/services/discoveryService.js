/**
 * discoveryService.js — Builds home/trending page sections
 * 
 * Generates content sections using strategic YouTube API queries.
 * Results are cached to minimize API quota usage.
 */

import { getTrendingMusic } from './youtubeService.js'
import { filterTracks, rankTracks } from './contentFilter.js'
import { historyStorage } from '../utils/storage.js'

const CURRENT_YEAR = new Date().getFullYear()
const REGION_LABELS = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', KR: 'South Korea',
  JP: 'Japan', MX: 'Mexico', FR: 'France', DE: 'Germany', BR: 'Brazil',
}

const LANGUAGE_QUERIES = {
  tamil: {
    label: 'Tamil',
    queries: {
      trending: `trending tamil songs ${CURRENT_YEAR}`,
      new: `new tamil songs ${CURRENT_YEAR} official audio`,
      popular: 'popular tamil songs official',
      playlists: 'best tamil music playlists',
    },
    region: 'IN',
  },
  hindi: {
    label: 'Hindi',
    queries: {
      trending: `trending hindi songs ${CURRENT_YEAR}`,
      new: `new hindi songs ${CURRENT_YEAR} official audio`,
      popular: 'popular bollywood songs',
      playlists: 'bollywood music playlists',
    },
    region: 'IN',
  },
  english: {
    label: 'English',
    queries: {
      trending: `trending english songs ${CURRENT_YEAR}`,
      new: `new english songs ${CURRENT_YEAR} official audio`,
      popular: 'top english songs official music video',
      playlists: `english music playlists ${CURRENT_YEAR}`,
    },
    region: 'US',
  },
  telugu: {
    label: 'Telugu',
    queries: {
      trending: `trending telugu songs ${CURRENT_YEAR}`,
      new: `new telugu songs ${CURRENT_YEAR} official`,
      popular: 'popular telugu songs',
      playlists: 'telugu music playlists',
    },
    region: 'IN',
  },
  malayalam: {
    label: 'Malayalam',
    queries: {
      trending: `trending malayalam songs ${CURRENT_YEAR}`,
      new: `new malayalam songs ${CURRENT_YEAR} official`,
      popular: 'popular malayalam songs',
      playlists: 'malayalam music playlists',
    },
    region: 'IN',
  },
  kannada: {
    label: 'Kannada',
    queries: {
      trending: `trending kannada songs ${CURRENT_YEAR}`,
      new: `new kannada songs ${CURRENT_YEAR}`,
      popular: 'popular kannada songs',
      playlists: 'kannada music playlists',
    },
    region: 'IN',
  },
  korean: {
    label: 'Korean (K-Pop)',
    queries: {
      trending: `trending kpop songs ${CURRENT_YEAR}`,
      new: `new kpop official music video ${CURRENT_YEAR}`,
      popular: 'popular kpop songs',
      playlists: `kpop playlist ${CURRENT_YEAR}`,
    },
    region: 'KR',
  },
  japanese: {
    label: 'Japanese',
    queries: {
      trending: `trending japanese songs ${CURRENT_YEAR}`,
      new: `new japanese music official ${CURRENT_YEAR}`,
      popular: 'popular japanese songs',
      playlists: 'japanese music playlist',
    },
    region: 'JP',
  },
  spanish: {
    label: 'Spanish',
    queries: {
      trending: `trending spanish songs ${CURRENT_YEAR}`,
      new: `nuevas canciones ${CURRENT_YEAR} official audio`,
      popular: 'popular spanish songs',
      playlists: 'musica latina playlist',
    },
    region: 'MX',
  },
  bengali: {
    label: 'Bengali',
    queries: {
      trending: `trending bengali songs ${CURRENT_YEAR}`,
      new: `new bengali songs ${CURRENT_YEAR} official`,
      popular: 'popular bengali songs',
      playlists: 'bengali music playlists',
    },
    region: 'IN',
  },
  marathi: {
    label: 'Marathi',
    queries: {
      trending: `trending marathi songs ${CURRENT_YEAR}`,
      new: `new marathi songs ${CURRENT_YEAR} official`,
      popular: 'popular marathi songs',
      playlists: 'marathi music playlists',
    },
    region: 'IN',
  },
  punjabi: {
    label: 'Punjabi',
    queries: {
      trending: `trending punjabi songs ${CURRENT_YEAR}`,
      new: `new punjabi songs ${CURRENT_YEAR} official`,
      popular: 'popular punjabi songs',
      playlists: 'punjabi music playlists',
    },
    region: 'IN',
  },
}

// Default fallback for unlisted languages
const DEFAULT_QUERIES = (lang) => ({
  label: lang.charAt(0).toUpperCase() + lang.slice(1),
  queries: {
    trending: `trending ${lang} songs ${CURRENT_YEAR}`,
    new: `new ${lang} songs ${CURRENT_YEAR} official`,
    popular: `popular ${lang} songs official`,
    playlists: `${lang} music playlists`,
  },
  region: 'US',
})

export const getLanguageConfig = (lang) => {
  return LANGUAGE_QUERIES[lang] || DEFAULT_QUERIES(lang)
}

// ─── Home page sections ────────────────────────────────────────────────────────

/**
 * Get all home page sections for a given language/settings
 */
export const getHomeSections = async (language = 'tamil', filterOptions = {}) => {
  const config = getLanguageConfig(language)
  const { region } = config
  const regionLabel = REGION_LABELS[region] || region

  // videos.list(chart=mostPopular) uses the general quota bucket. One response
  // powers every shelf instead of spending four scarce search.list calls.
  const chart = await getTrendingMusic({ regionCode: region, maxResults: 50 })
  if (chart.error) return []
  const chartTracks = filterTracks(chart.items || [], filterOptions)
  const freshTracks = [...chartTracks].sort((a, b) =>
    String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))
  )
  const popularTracks = rankTracks(chartTracks, filterOptions)

  // Deduplicate across sections by video ID
  const seenIds = new Set()
  const takeUnique = (tracks, limit) => {
    const selected = []
    for (const track of tracks) {
      if (seenIds.has(track.id)) continue
      seenIds.add(track.id)
      selected.push(track)
      if (selected.length === limit) break
    }
    return selected
  }

  const sections = [
    {
      id: 'trending_lang',
      title: `🔥 Trending in ${regionLabel}`,
      subtitle: 'Official YouTube music chart',
      type: 'tracks',
      items: takeUnique(chartTracks, 18),
    },
    {
      id: 'new_releases',
      title: '🆕 Fresh Chart Picks',
      subtitle: `Recent music charting in ${regionLabel}`,
      type: 'tracks',
      items: takeUnique(freshTracks, 16),
    },
    {
      id: 'popular_tracks',
      title: '📈 More Popular Music',
      subtitle: 'More from the regional chart',
      type: 'tracks',
      items: takeUnique(popularTracks, 16),
    },
  ]

  return sections.filter(s => s.items.length > 0)
}

/**
 * Get continue listening section from history
 */
export const getContinueListening = async () => {
  try {
    const history = await historyStorage.getAll()
    // Last 20 unique tracks
    const seen = new Set()
    const recent = []
    for (const entry of history) {
      if (!entry.isPlaylist && entry.id && !seen.has(entry.id) && entry.title && entry.title !== 'Unknown Title') {
        seen.add(entry.id)
        recent.push(entry)
        if (recent.length >= 20) break
      }
    }
    return recent
  } catch {
    return []
  }
}

/**
 * Get trending sections for the Trending page
 */
export const getTrendingSections = async (language = 'tamil') => {
  const config = getLanguageConfig(language)
  const { region } = config

  const [indiaTrending, globalTrending, regionalTrending] = await Promise.allSettled([
    getTrendingMusic({ regionCode: 'IN', maxResults: 50 }),
    getTrendingMusic({ regionCode: 'US', maxResults: 30 }),
    getTrendingMusic({ regionCode: region, maxResults: 30 }),
  ])

  const getItems = (result) => result.status === 'fulfilled' && !result.value?.error
    ? result.value.items || []
    : []

  return [
    {
      id: 'india_trending',
      title: '🇮🇳 Trending in India',
      subtitle: 'Music chart toppers in India',
      type: 'tracks',
      context: 'trending',
      items: getItems(indiaTrending).slice(0, 30),
    },
    {
      id: 'global_trending',
      title: '🌍 Global Trending',
      subtitle: 'Top music worldwide',
      type: 'tracks',
      context: 'trending',
      items: getItems(globalTrending).slice(0, 20),
    },
    {
      id: 'regional_trending',
      title: `🎵 Trending in ${REGION_LABELS[region] || region}`,
      subtitle: 'Official regional music chart',
      type: 'tracks',
      context: 'trending',
      items: getItems(regionalTrending).slice(0, 20),
    },
  ].filter(s => s.items.length > 0)
}
