/**
 * youtubeService.js — Central YouTube API service
 * 
 * All API calls go through the Electron IPC bridge (window.electronAPI.youtube)
 * The API key lives ONLY in the Electron main process.
 * 
 * In non-Electron environments (browser dev mode), calls fall back to direct
 * fetch with VITE_YOUTUBE_API_KEY — clearly isolated here.
 */

import { cacheStorage } from '../utils/storage.js'
import { getBestThumbnail, parseISO8601Duration, decodeHtml } from '../utils/formatters.js'

// ─── IPC bridge / fallback ─────────────────────────────────────────────────────
const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI?.youtube

const ytapi = {
  search: (params) => {
    const fullParams = { part: 'snippet', ...params }
    if (isElectron()) return window.electronAPI.youtube.search(fullParams)
    return browserFetch('search', fullParams)
  },
  getVideos: (params) => {
    const idVal = Array.isArray(params?.ids) ? params.ids.join(',') : (params?.id || params?.ids || '')
    const fullParams = { part: 'snippet,contentDetails,statistics', ...params, id: idVal }
    delete fullParams.ids
    if (isElectron()) return window.electronAPI.youtube.getVideos(fullParams)
    return browserFetch('videos', fullParams)
  },
  getPlaylistItems: (params) => {
    const fullParams = { part: 'snippet,contentDetails', ...params }
    if (isElectron()) return window.electronAPI.youtube.getPlaylistItems(fullParams)
    return browserFetch('playlistItems', fullParams)
  },
  getPlaylists: (params) => {
    const idVal = Array.isArray(params?.ids) ? params.ids.join(',') : (params?.id || params?.ids || '')
    const fullParams = { part: 'snippet,contentDetails', ...params, id: idVal }
    delete fullParams.ids
    if (isElectron()) return window.electronAPI.youtube.getPlaylists(fullParams)
    return browserFetch('playlists', fullParams)
  },
  searchPlaylists: (params) => {
    const fullParams = { part: 'snippet', type: 'playlist', ...params }
    if (isElectron()) return window.electronAPI.youtube.searchPlaylists(fullParams)
    return browserFetch('search', fullParams)
  },
  getChannels: (params) => {
    const idVal = Array.isArray(params?.ids) ? params.ids.join(',') : (params?.id || params?.ids || '')
    const fullParams = { part: 'snippet,statistics', ...params, id: idVal }
    delete fullParams.ids
    if (isElectron()) return window.electronAPI.youtube.getChannels(fullParams)
    return browserFetch('channels', fullParams)
  },
  getTrending: (params) => {
    const fullParams = { part: 'snippet,contentDetails,statistics', chart: 'mostPopular', ...params }
    if (isElectron()) return window.electronAPI.youtube.getTrending(fullParams)
    return browserFetch('videos', fullParams)
  },
}

// ─── Multi-Key Pool with Automatic Failover ──────────────────────────────────
const getBrowserKeys = () => {
  const metaEnv = typeof import.meta !== 'undefined' ? import.meta.env : {}

  const raw = metaEnv?.VITE_YOUTUBE_API_KEYS 
    || metaEnv?.VITE_YOUTUBE_API_KEY
    || ''

  const parsed = raw
    .split(',')
    .map(k => k.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)

  return parsed
}

let browserActiveKeyIdx = 0
const browserExhaustedKeys = new Map()

const getNextBrowserKey = () => {
  const keys = getBrowserKeys()
  if (keys.length === 0) return null
  const now = Date.now()
  for (const [k, time] of browserExhaustedKeys.entries()) {
    if (now - time > 6 * 60 * 60 * 1000) browserExhaustedKeys.delete(k)
  }
  for (let i = 0; i < keys.length; i++) {
    const idx = (browserActiveKeyIdx + i) % keys.length
    const key = keys[idx]
    if (!browserExhaustedKeys.has(key)) {
      browserActiveKeyIdx = idx
      return key
    }
  }
  return keys[0]
}

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

const browserFetch = async (endpoint, params) => {
  const keys = getBrowserKeys()
  if (keys.length === 0) {
    return { error: 'NO_API_KEY', message: 'No API key configured. Add VITE_YOUTUBE_API_KEYS to .env' }
  }

  const maxAttempts = keys.length
  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const key = getNextBrowserKey()
    if (!key) break

    const url = new URL(`${YT_BASE}/${endpoint}`)
    url.searchParams.set('key', key)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }

    try {
      const res = await fetch(url.toString())
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const reason = err?.error?.errors?.[0]?.reason
        if (res.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded')) {
          console.warn(`[Rajify] YouTube API key quota reached for ${key.slice(0, 10)}... Switching to next key.`)
          browserExhaustedKeys.set(key, Date.now())
          browserActiveKeyIdx = (browserActiveKeyIdx + 1) % keys.length
          lastError = { error: 'QUOTA_EXCEEDED', message: 'API quota reached. Trying next key...' }
          continue
        }
        return { error: 'API_ERROR', message: err?.error?.message || `HTTP ${res.status}` }
      }
      return await res.json()
    } catch (e) {
      return { error: 'NETWORK_ERROR', message: e.message }
    }
  }

  return lastError || { error: 'QUOTA_EXCEEDED', message: 'All configured YouTube API keys have reached their quota limits.' }
}

// ─── Error checking ────────────────────────────────────────────────────────────
export const isAPIError = (data) => !!(data?.error)

export const getErrorMessage = (data) => {
  if (!data?.error) return null
  switch (data.error) {
    case 'NO_API_KEY': return 'YouTube API key not configured.'
    case 'QUOTA_EXCEEDED': return 'YouTube API quota exceeded on all keys. Please try again tomorrow.'
    case 'NETWORK_ERROR': return 'No internet connection. Check your network.'
    case 'BAD_REQUEST': return `API error: ${data.message}`
    default: return data.message || 'An unexpected error occurred.'
  }
}

// ─── Track normalizer ──────────────────────────────────────────────────────────
// Converts raw YouTube API items into a consistent track shape

export const normalizeVideoItem = (item, sourcePlaylistId = null) => {
  if (!item) return null

  const snippet = item.snippet || {}
  const stats = item.statistics || {}
  const contentDetails = item.contentDetails || {}

  // Handle different item shapes (search result vs video vs playlistItem)
  const rawId = item.id || item.videoId || snippet.resourceId?.videoId || item.contentDetails?.videoId
  const videoId = typeof rawId === 'string' ? rawId : (rawId?.videoId || rawId?.playlistId || '')

  const rawTitle = snippet.title || item.title || ''
  const rawChannel = snippet.channelTitle || snippet.videoOwnerChannelTitle || item.channel || item.channelTitle || ''

  const resolvedTitle = decodeHtml(rawTitle) || (videoId ? `Track ${videoId}` : 'Unknown Title')
  const resolvedChannel = decodeHtml(rawChannel) || 'Unknown Artist'

  // Guarantee thumbnail: snippet -> custom -> fallback to YouTube CDN url
  const ytFallbackThumb = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : ''
  const ytFallbackThumbHigh = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''

  const resolvedThumbnail = getBestThumbnail(snippet.thumbnails, 'medium') 
    || item.thumbnail 
    || item.thumbnailHigh 
    || ytFallbackThumb

  const resolvedThumbnailHigh = getBestThumbnail(snippet.thumbnails, 'high') 
    || item.thumbnailHigh 
    || item.thumbnail 
    || ytFallbackThumbHigh

  const durationSec = item.durationSec 
    || (contentDetails.duration ? parseISO8601Duration(contentDetails.duration) : 0)
    || item.duration 
    || 0

  return {
    id: videoId,
    title: resolvedTitle,
    channel: resolvedChannel,
    channelId: snippet.channelId || snippet.videoOwnerChannelId || item.channelId || '',
    thumbnail: resolvedThumbnail,
    thumbnailHigh: resolvedThumbnailHigh,
    publishedAt: snippet.publishedAt || item.publishedAt || '',
    description: snippet.description || item.description || '',
    viewCount: stats.viewCount || item.viewCount || '0',
    likeCount: stats.likeCount || item.likeCount || '0',
    durationSec,
    duration: durationSec, // alias
    playlistId: sourcePlaylistId || item.playlistId || null,
    isLive: snippet.liveBroadcastContent === 'live' || item.isLive || false,
  }
}

export const normalizePlaylistItem = (item) => {
  if (!item) return null
  const snippet = item.snippet || {}
  const contentDetails = item.contentDetails || {}
  const videoId = snippet.resourceId?.videoId || contentDetails.videoId || (typeof item.id === 'string' && item.id.length === 11 ? item.id : (item.id?.videoId || item.id))

  return normalizeVideoItem({
    ...item,
    id: videoId,
  }, snippet.playlistId)
}

export const normalizePlaylist = (item) => {
  if (!item) return null

  const snippet = item.snippet || {}
  const contentDetails = item.contentDetails || {}
  const rawId = item.id || item.playlistId
  const id = typeof rawId === 'string' ? rawId : (rawId?.playlistId || rawId?.id || '')

  const rawTitle = snippet.title || item.title || ''
  const rawChannel = snippet.channelTitle || item.channel || ''

  return {
    id,
    title: decodeHtml(rawTitle) || 'Untitled Playlist',
    channel: decodeHtml(rawChannel) || '',
    channelId: snippet.channelId || item.channelId || '',
    thumbnail: getBestThumbnail(snippet.thumbnails, 'medium') || item.thumbnail || item.thumbnailHigh || '',
    thumbnailHigh: getBestThumbnail(snippet.thumbnails, 'high') || item.thumbnailHigh || item.thumbnail || '',
    itemCount: contentDetails.itemCount || item.itemCount || 0,
    publishedAt: snippet.publishedAt || item.publishedAt || '',
    description: snippet.description || item.description || '',
  }
}

// ─── In-flight request deduplication ──────────────────────────────────────────
const pendingRequests = new Map()

const deduplicatedRequest = async (cacheKey, cacheType, fetcher) => {
  // Check cache first
  const cached = await cacheStorage.get(cacheKey, cacheType)
  if (cached && !isAPIError(cached) && Array.isArray(cached.items) && cached.items.length > 0) {
    return { data: cached, fromCache: true }
  }

  // Deduplicate concurrent identical requests
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)
  }

  const promise = fetcher().then(async (result) => {
    pendingRequests.delete(cacheKey)
    if (!isAPIError(result) && Array.isArray(result?.items) && result.items.length > 0) {
      await cacheStorage.set(cacheKey, result)
    }
    return { data: result, fromCache: false }
  }).catch((e) => {
    pendingRequests.delete(cacheKey)
    throw e
  })

  pendingRequests.set(cacheKey, promise)
  return promise
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Search for videos (music-optimized)
 */
export const searchVideos = async ({ q, maxResults = 20, pageToken, regionCode }) => {
  const cacheKey = `search_v:${q}:${maxResults}:${pageToken || ''}:${regionCode || ''}`
  const { data } = await deduplicatedRequest(cacheKey, 'search', () =>
    ytapi.search({ q, type: 'video', maxResults, pageToken, videoCategoryId: '10', regionCode })
  )
  if (isAPIError(data)) return { error: getErrorMessage(data), items: [], nextPageToken: null }
  
  return {
    items: (data.items || []).map(item => normalizeVideoItem(item)),
    nextPageToken: data.nextPageToken || null,
    totalResults: data.pageInfo?.totalResults || 0,
  }
}

/**
 * Get full video details (with duration, stats, titles) for given IDs
 */
export const getVideoDetails = async (ids) => {
  if (!ids || ids.length === 0) return []
  const idList = Array.isArray(ids) ? ids.slice(0, 50) : [ids]
  const cacheKey = `videos:${idList.sort().join(',')}`
  
  const { data } = await deduplicatedRequest(cacheKey, 'video', () =>
    ytapi.getVideos({ id: idList.join(','), part: 'snippet,contentDetails,statistics' })
  )
  if (isAPIError(data)) return []
  return (data.items || []).map(normalizeVideoItem)
}

/**
 * Enrich tracks that are missing metadata with real titles and artists
 */
export const enrichTracks = async (tracks) => {
  if (!tracks || !Array.isArray(tracks) || tracks.length === 0) return []
  
  const normalized = tracks.map(t => {
    if (typeof t === 'string') return { id: t }
    return normalizeVideoItem(t) || { id: t?.id }
  }).filter(t => t?.id)

  const missingIds = normalized
    .filter(t => !t.title || t.title.startsWith('Track ') || t.channel === 'Unknown Artist' || !t.thumbnail)
    .map(t => t.id)

  if (missingIds.length === 0) return normalized

  try {
    const details = await getVideoDetails(missingIds)
    const detailMap = new Map(details.map(d => [d.id, d]))

    return normalized.map(t => {
      const detail = detailMap.get(t.id)
      if (detail) {
        return {
          ...t,
          title: detail.title || t.title,
          channel: detail.channel || t.channel,
          thumbnail: detail.thumbnail || t.thumbnail,
          thumbnailHigh: detail.thumbnailHigh || t.thumbnailHigh,
          durationSec: detail.durationSec || t.durationSec || 0,
          duration: detail.durationSec || t.duration || 0,
          viewCount: detail.viewCount || t.viewCount || '0',
          likeCount: detail.likeCount || t.likeCount || '0',
        }
      }
      return t
    })
  } catch (e) {
    console.warn('enrichTracks error:', e)
    return normalized
  }
}

/**
 * Search for playlists
 */
export const searchPlaylists = async ({ q, maxResults = 20, pageToken, regionCode }) => {
  const cacheKey = `search_p:${q}:${maxResults}:${pageToken || ''}:${regionCode || ''}`
  const { data } = await deduplicatedRequest(cacheKey, 'search', () =>
    ytapi.searchPlaylists({ q, maxResults, pageToken, regionCode })
  )
  if (isAPIError(data)) return { error: getErrorMessage(data), items: [], nextPageToken: null }
  
  return {
    items: (data.items || []).map(normalizePlaylist),
    nextPageToken: data.nextPageToken || null,
  }
}

/**
 * Get playlist details by IDs
 */
export const getPlaylists = async (ids) => {
  if (!ids?.length) return []
  const idList = Array.isArray(ids) ? ids : [ids]
  const cacheKey = `playlists:${idList.sort().join(',')}`
  
  const { data } = await deduplicatedRequest(cacheKey, 'playlist', () =>
    ytapi.getPlaylists({ id: idList.join(',') })
  )
  if (isAPIError(data)) return []
  return (data.items || []).map(normalizePlaylist)
}

/**
 * Get tracks in a playlist (with full video details for duration)
 */
export const getPlaylistTracks = async (playlistId, maxResults = 50, pageToken) => {
  const cacheKey = `playlist_items:${playlistId}:${maxResults}:${pageToken || ''}`
  const { data } = await deduplicatedRequest(cacheKey, 'playlist', () =>
    ytapi.getPlaylistItems({ playlistId, maxResults, pageToken })
  )
  if (isAPIError(data)) return { error: getErrorMessage(data), tracks: [], nextPageToken: null }
  
  const basicTracks = (data.items || [])
    .map(normalizePlaylistItem)
    .filter(Boolean)
    .filter(t => t.id && t.title !== 'Deleted video' && t.title !== 'Private video')

  // Enrich with duration/stats by fetching full video details
  if (basicTracks.length > 0) {
    const ids = basicTracks.map(t => t.id).filter(Boolean)
    try {
      const details = await getVideoDetails(ids)
      const detailMap = new Map(details.map(d => [d.id, d]))
      basicTracks.forEach(track => {
        const detail = detailMap.get(track.id)
        if (detail) {
          if (detail.title && (!track.title || track.title.startsWith('Track '))) track.title = detail.title
          if (detail.channel && (!track.channel || track.channel === 'Unknown Artist')) track.channel = detail.channel
          if (detail.thumbnail) track.thumbnail = detail.thumbnail
          track.durationSec = detail.durationSec
          track.duration = detail.durationSec
          track.viewCount = detail.viewCount
          track.likeCount = detail.likeCount
        }
      })
    } catch { /* non-fatal — continue without duration */ }
  }

  return {
    tracks: basicTracks,
    nextPageToken: data.nextPageToken || null,
  }
}

/**
 * Get trending music videos
 */
export const getTrendingMusic = async ({ regionCode = 'IN', maxResults = 50, pageToken } = {}) => {
  const cacheKey = `trending:${regionCode}:${maxResults}:${pageToken || ''}`
  const { data } = await deduplicatedRequest(cacheKey, 'trending', () =>
    ytapi.getTrending({ regionCode, videoCategoryId: '10', maxResults, pageToken })
  )
  if (isAPIError(data)) return { error: getErrorMessage(data), items: [], nextPageToken: null }
  
  return {
    items: (data.items || []).map(normalizeVideoItem),
    nextPageToken: data.nextPageToken || null,
  }
}

/**
 * Search for content matching a query — returns videos AND playlists
 */
export const universalSearch = async ({ q, maxResults = 10, regionCode }) => {
  const [videoResults, playlistResults] = await Promise.allSettled([
    searchVideos({ q: `${q} music`, maxResults, regionCode }),
    searchPlaylists({ q: `${q} music`, maxResults: 5, regionCode }),
  ])

  return {
    videos: videoResults.status === 'fulfilled' ? videoResults.value.items : [],
    playlists: playlistResults.status === 'fulfilled' ? playlistResults.value.items : [],
    videoError: videoResults.status === 'rejected' ? videoResults.reason : 
                (videoResults.value?.error || null),
    playlistError: playlistResults.status === 'rejected' ? playlistResults.reason :
                   (playlistResults.value?.error || null),
  }
}

/**
 * Get channel info
 */
export const getChannelInfo = async (channelIds) => {
  const ids = Array.isArray(channelIds) ? channelIds : [channelIds]
  const cacheKey = `channels:${ids.sort().join(',')}`
  
  const { data } = await deduplicatedRequest(cacheKey, 'channel', () =>
    ytapi.getChannels({ ids })
  )
  if (isAPIError(data)) return []
  return data.items || []
}

/**
 * Find related content for a track (by artist/channel name)
 */
export const getRelatedContent = async (track, maxResults = 20) => {
  const artistName = track.channel?.replace(/ - Topic$/, '') || ''
  if (!artistName) return { items: [] }
  return searchVideos({ q: `${artistName} official audio`, maxResults })
}
