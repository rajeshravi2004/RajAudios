/**
 * discoveryService.js — Builds home/trending page sections
 * 
 * Generates content sections using strategic YouTube API queries.
 * Results are cached to minimize API quota usage.
 */

import { searchVideos, searchPlaylists, getTrendingMusic } from './youtubeService.js'
import { filterTracks, rankTracks } from './contentFilter.js'
import { historyStorage } from '../utils/storage.js'

const LANGUAGE_QUERIES = {
  tamil: {
    label: 'Tamil',
    queries: {
      trending: 'trending tamil songs 2025',
      new: 'new tamil songs 2025 official audio',
      popular: 'popular tamil songs official',
      playlists: 'best tamil music playlists',
    },
    region: 'IN',
  },
  hindi: {
    label: 'Hindi',
    queries: {
      trending: 'trending hindi songs 2025',
      new: 'new hindi songs 2025 official audio',
      popular: 'popular bollywood songs',
      playlists: 'bollywood music playlists',
    },
    region: 'IN',
  },
  english: {
    label: 'English',
    queries: {
      trending: 'trending english songs 2025',
      new: 'new english songs 2025 official audio',
      popular: 'top english songs official music video',
      playlists: 'english music playlists 2025',
    },
    region: 'US',
  },
  telugu: {
    label: 'Telugu',
    queries: {
      trending: 'trending telugu songs 2025',
      new: 'new telugu songs 2025 official',
      popular: 'popular telugu songs',
      playlists: 'telugu music playlists',
    },
    region: 'IN',
  },
  malayalam: {
    label: 'Malayalam',
    queries: {
      trending: 'trending malayalam songs 2025',
      new: 'new malayalam songs 2025 official',
      popular: 'popular malayalam songs',
      playlists: 'malayalam music playlists',
    },
    region: 'IN',
  },
  kannada: {
    label: 'Kannada',
    queries: {
      trending: 'trending kannada songs 2025',
      new: 'new kannada songs 2025',
      popular: 'popular kannada songs',
      playlists: 'kannada music playlists',
    },
    region: 'IN',
  },
  korean: {
    label: 'Korean (K-Pop)',
    queries: {
      trending: 'trending kpop songs 2025',
      new: 'new kpop official music video 2025',
      popular: 'popular kpop songs',
      playlists: 'kpop playlist 2025',
    },
    region: 'KR',
  },
  japanese: {
    label: 'Japanese',
    queries: {
      trending: 'trending japanese songs 2025',
      new: 'new japanese music official 2025',
      popular: 'popular japanese songs',
      playlists: 'japanese music playlist',
    },
    region: 'JP',
  },
  spanish: {
    label: 'Spanish',
    queries: {
      trending: 'trending spanish songs 2025',
      new: 'nuevas canciones 2025 official audio',
      popular: 'popular spanish songs',
      playlists: 'musica latina playlist',
    },
    region: 'MX',
  },
  bengali: {
    label: 'Bengali',
    queries: {
      trending: 'trending bengali songs 2025',
      new: 'new bengali songs 2025 official',
      popular: 'popular bengali songs',
      playlists: 'bengali music playlists',
    },
    region: 'IN',
  },
  marathi: {
    label: 'Marathi',
    queries: {
      trending: 'trending marathi songs 2025',
      new: 'new marathi songs 2025 official',
      popular: 'popular marathi songs',
      playlists: 'marathi music playlists',
    },
    region: 'IN',
  },
  punjabi: {
    label: 'Punjabi',
    queries: {
      trending: 'trending punjabi songs 2025',
      new: 'new punjabi songs 2025 official',
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
    trending: `trending ${lang} songs 2025`,
    new: `new ${lang} songs 2025 official`,
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
  const { queries, region } = config

  // Fetch sections in parallel — individual failures don't break the page
  const [trendingResult, newResult, popularResult, playlistResult, globalTrending] = 
    await Promise.allSettled([
      searchVideos({ q: queries.trending, maxResults: 20, regionCode: region }),
      searchVideos({ q: queries.new, maxResults: 20, regionCode: region }),
      searchVideos({ q: queries.popular, maxResults: 20, regionCode: region }),
      searchPlaylists({ q: queries.playlists, maxResults: 12, regionCode: region }),
      getTrendingMusic({ regionCode: region, maxResults: 30 }),
    ])

  const getItems = (result) => result.status === 'fulfilled' && !result.value?.error 
    ? result.value.items || [] 
    : []

  const getTracks = (result) => filterTracks(getItems(result), filterOptions)

  const trendingTracks = getTracks(trendingResult)
  const newTracks = getTracks(newResult)
  const popularTracks = rankTracks(getTracks(popularResult), filterOptions)
  const playlists = getItems(playlistResult)
  const globalTracks = getTracks(globalTrending)

  // Deduplicate across sections by video ID
  const seenIds = new Set()
  const dedup = (tracks) => tracks.filter(t => {
    if (seenIds.has(t.id)) return false
    seenIds.add(t.id)
    return true
  })

  const sections = [
    {
      id: 'trending_lang',
      title: `🔥 Trending ${config.label}`,
      subtitle: `What's hot in ${config.label} music right now`,
      type: 'tracks',
      items: dedup(trendingTracks).slice(0, 20),
    },
    {
      id: 'new_releases',
      title: '🆕 New Releases',
      subtitle: 'Fresh music just dropped',
      type: 'tracks',
      items: dedup(newTracks).slice(0, 20),
    },
    {
      id: 'popular_playlists',
      title: '🎵 Popular Playlists',
      subtitle: `Top ${config.label} playlists`,
      type: 'playlists',
      items: playlists.slice(0, 12),
    },
    {
      id: 'popular_tracks',
      title: '📈 Popular Right Now',
      subtitle: 'High quality picks',
      type: 'tracks',
      items: dedup(popularTracks).slice(0, 20),
    },
  ]

  // Add global trending if language is not English
  if (language !== 'english' && globalTracks.length > 0) {
    const globalDeduped = dedup(globalTracks).slice(0, 15)
    if (globalDeduped.length > 0) {
      sections.push({
        id: 'global_trending',
        title: '🌍 Global Trending',
        subtitle: 'Music charts worldwide',
        type: 'tracks',
        items: globalDeduped,
        context: 'trending',
      })
    }
  }

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

  const [indiaTrending, globalTrending, langTrending] = await Promise.allSettled([
    getTrendingMusic({ regionCode: 'IN', maxResults: 50 }),
    getTrendingMusic({ regionCode: 'US', maxResults: 30 }),
    searchVideos({ q: config.queries.trending, maxResults: 30, regionCode: region }),
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
      id: 'lang_trending',
      title: `🎵 ${config.label} Trending`,
      subtitle: `Hot ${config.label} tracks`,
      type: 'tracks',
      context: 'trending',
      items: getItems(langTrending).slice(0, 20),
    },
  ].filter(s => s.items.length > 0)
}
