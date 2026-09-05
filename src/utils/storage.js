/**
 * storage.js — IndexedDB-backed persistent storage for Rajify
 * 
 * Replaces js-cookie which has a 4KB size limit.
 * Falls back to localStorage if IndexedDB is unavailable.
 * 
 * Namespaces:
 *   favorites     — Set of liked track IDs + track metadata
 *   playlists     — User-created/saved playlists
 *   history       — Recently played tracks with stats
 *   queue         — Current playback queue
 *   settings      — App settings (language, volume, etc.)
 *   cache         — YouTube API response cache with TTL
 */

const DB_NAME = 'rajify'
const DB_VERSION = 2

const STORES = {
  favorites: 'favorites',
  playlists: 'playlists', 
  history: 'history',
  queue: 'queue',
  settings: 'settings',
  cache: 'cache',
}

let db = null
const memoryStore = new Map()

const openDB = () => {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }
  if (db) return Promise.resolve(db)
  
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      
      req.onupgradeneeded = (e) => {
        const database = e.target.result
        Object.values(STORES).forEach(storeName => {
          if (!database.objectStoreNames.contains(storeName)) {
            database.createObjectStore(storeName)
          }
        })
        // Clear old cache on upgrade if store exists
        if (e.oldVersion < 2 && database.objectStoreNames.contains('cache')) {
          try {
            const tx = req.transaction
            if (tx) tx.objectStore('cache').clear()
          } catch { /* ignore */ }
        }
      }
      
      req.onsuccess = (e) => {
        db = e.target.result
        resolve(db)
      }
      
      req.onerror = (e) => {
        console.error('IndexedDB open error:', e.target.error)
        resolve(null)
      }
    } catch {
      resolve(null)
    }
  })
}

const withStore = async (storeName, mode, operation) => {
  try {
    const database = await openDB()
    if (!database) {
      // Memory store fallback
      if (!memoryStore.has(storeName)) memoryStore.set(storeName, new Map())
      const mem = memoryStore.get(storeName)
      const mockStore = {
        get: (key) => ({ result: mem.get(key) }),
        put: (val, key) => { mem.set(key, val); return { result: true } },
        delete: (key) => { mem.delete(key); return { result: true } },
        getAll: () => ({ result: Array.from(mem.values()) }),
        getAllKeys: () => ({ result: Array.from(mem.keys()) }),
        clear: () => { mem.clear(); return { result: true } }
      }
      const res = operation(mockStore)
      return res?.result !== undefined ? res.result : null
    }
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, mode)
      const store = tx.objectStore(storeName)
      const req = operation(store)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.error(`Storage error [${storeName}]:`, e)
    return null
  }
}

const idb = {
  get: (storeName, key) => withStore(storeName, 'readonly', s => s.get(key)),
  set: (storeName, key, value) => withStore(storeName, 'readwrite', s => s.put(value, key)),
  delete: (storeName, key) => withStore(storeName, 'readwrite', s => s.delete(key)),
  getAll: (storeName) => withStore(storeName, 'readonly', s => s.getAll()),
  getAllKeys: (storeName) => withStore(storeName, 'readonly', s => s.getAllKeys()),
  clear: (storeName) => withStore(storeName, 'readwrite', s => s.clear()),
}

// ─── Settings ─────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  language: 'tamil',
  region: 'IN',
  volume: 0.8,
  shuffle: false,
  repeat: 'off',
  autoplay: true,
  contentFilterStrength: 'moderate', // 'off' | 'light' | 'moderate' | 'strict'
  theme: 'dark',
  accentColor: 'violet',
  showExplicit: false,
  saveHistory: true,
  personalizedRecommendations: true,
}

export const settingsStorage = {
  get: async () => {
    try {
      const data = await idb.get(STORES.settings, 'app_settings')
      return { ...DEFAULT_SETTINGS, ...data }
    } catch {
      return DEFAULT_SETTINGS
    }
  },
  set: async (settings) => {
    try {
      const current = await settingsStorage.get()
      await idb.set(STORES.settings, 'app_settings', { ...current, ...settings })
    } catch (e) {
      console.error('settingsStorage.set error:', e)
    }
  },
}

// ─── Favorites ────────────────────────────────────────────────────────────────
export const favoritesStorage = {
  getAll: async () => {
    try {
      const data = await idb.get(STORES.favorites, 'tracks')
      return data || []
    } catch {
      return []
    }
  },
  save: async (tracks) => {
    try {
      await idb.set(STORES.favorites, 'tracks', tracks)
    } catch (e) {
      console.error('favoritesStorage.save error:', e)
    }
  },
}

// ─── Playlists ────────────────────────────────────────────────────────────────
export const playlistStorage = {
  getAll: async () => {
    try {
      const data = await idb.get(STORES.playlists, 'user_playlists')
      return data || []
    } catch {
      return []
    }
  },
  save: async (playlists) => {
    try {
      await idb.set(STORES.playlists, 'user_playlists', playlists)
    } catch (e) {
      console.error('playlistStorage.save error:', e)
    }
  },
}

// ─── History ──────────────────────────────────────────────────────────────────
const MAX_HISTORY = 500

export const historyStorage = {
  getAll: async () => {
    try {
      const data = await idb.get(STORES.history, 'play_history')
      return data || []
    } catch {
      return []
    }
  },
  addEntry: async (track, completionPct = 0) => {
    try {
      const history = await historyStorage.getAll()
      // Remove duplicate of same track
      const filtered = history.filter(h => h.id !== track.id)
      filtered.unshift({
        ...track,
        playedAt: Date.now(),
        completionPct: Math.round(completionPct),
      })
      const limited = filtered.slice(0, MAX_HISTORY)
      await idb.set(STORES.history, 'play_history', limited)
    } catch (e) {
      console.error('historyStorage.addEntry error:', e)
    }
  },
  clear: async () => {
    try {
      await idb.set(STORES.history, 'play_history', [])
    } catch (e) {
      console.error('historyStorage.clear error:', e)
    }
  },
}

// ─── Queue ────────────────────────────────────────────────────────────────────
export const queueStorage = {
  get: async () => {
    try {
      const data = await idb.get(STORES.queue, 'current_queue')
      return data || { tracks: [], currentIndex: 0 }
    } catch {
      return { tracks: [], currentIndex: 0 }
    }
  },
  save: async (queueData) => {
    try {
      await idb.set(STORES.queue, 'current_queue', queueData)
    } catch (e) {
      console.error('queueStorage.save error:', e)
    }
  },
}

// ─── API Cache ────────────────────────────────────────────────────────────────
const CACHE_TTLS = {
  trending: 30 * 60 * 1000,       // 30 min
  search: 15 * 60 * 1000,         // 15 min
  playlist: 60 * 60 * 1000,       // 1 hour
  video: 24 * 60 * 60 * 1000,     // 24 hours
  channel: 24 * 60 * 60 * 1000,   // 24 hours
}

export const cacheStorage = {
  get: async (key, type = 'search') => {
    try {
      const entry = await idb.get(STORES.cache, key)
      if (!entry) return null
      const ttl = CACHE_TTLS[type] || CACHE_TTLS.search
      if (Date.now() - entry.timestamp > ttl) {
        await idb.delete(STORES.cache, key)
        return null
      }
      return entry.data
    } catch {
      return null
    }
  },
  set: async (key, data) => {
    try {
      await idb.set(STORES.cache, key, { data, timestamp: Date.now() })
    } catch (e) {
      console.error('cacheStorage.set error:', e)
    }
  },
  clear: async () => {
    try {
      await idb.clear(STORES.cache)
    } catch (e) {
      console.error('cacheStorage.clear error:', e)
    }
  },
}

// ─── Migration from cookies ───────────────────────────────────────────────────
export const migrateCookieData = async () => {
  if (typeof document === 'undefined') return
  
  const migrated = await idb.get(STORES.settings, 'cookie_migrated')
  if (migrated) return

  try {
    const getCookie = (name) => {
      const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
      return match ? decodeURIComponent(match[2]) : null
    }

    const favCookie = getCookie('rajify_favorites')
    if (favCookie) {
      const favIds = JSON.parse(favCookie)
      if (Array.isArray(favIds) && favIds.length > 0) {
        // Migrate just IDs — no full metadata available from old cookies
        await favoritesStorage.save(favIds.map(id => ({ id })))
      }
    }

    const playlistsCookie = getCookie('rajify_playlists')
    if (playlistsCookie) {
      const playlists = JSON.parse(playlistsCookie)
      if (Array.isArray(playlists)) {
        await playlistStorage.save(playlists)
      }
    }

    const recentCookie = getCookie('rajify_recent')
    if (recentCookie) {
      const recent = JSON.parse(recentCookie)
      if (Array.isArray(recent)) {
        const historyEntries = recent.map(p => ({
          id: p.id,
          title: p.title,
          thumbnail: p.thumbnail,
          channel: p.channelTitle,
          isPlaylist: true,
          playedAt: Date.now(),
        }))
        await idb.set(STORES.history, 'play_history', historyEntries)
      }
    }

    const settingsCookie = getCookie('rajify_settings')
    if (settingsCookie) {
      const settings = JSON.parse(settingsCookie)
      await settingsStorage.set(settings)
    }

    const queueCookie = getCookie('rajify_queue')
    if (queueCookie) {
      const queue = JSON.parse(queueCookie)
      if (Array.isArray(queue)) {
        await queueStorage.save({ tracks: queue, currentIndex: 0 })
      }
    }

    await idb.set(STORES.settings, 'cookie_migrated', true)
    console.log('[Rajify] Cookie data migrated to IndexedDB')
  } catch (e) {
    console.error('Cookie migration error (non-fatal):', e)
  }
}
