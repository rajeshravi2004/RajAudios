/**
 * libraryStore.jsx — Favorites, playlists, history context
 * Persisted to IndexedDB
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { favoritesStorage, playlistStorage, historyStorage } from '../utils/storage.js'
import { enrichTracks } from '../services/youtubeService.js'

const LibraryContext = createContext(null)

export function LibraryProvider({ children }) {
  const [favorites, setFavorites] = useState([]) // Array of track objects
  const [playlists, setPlaylists] = useState([]) // User-created playlists
  const [history, setHistory] = useState([])     // Recently played tracks

  // Load all library data on mount
  useEffect(() => {
    Promise.all([
      favoritesStorage.getAll(),
      playlistStorage.getAll(),
      historyStorage.getAll(),
    ]).then(async ([favs, lists, hist]) => {
      const initialFavs = favs || []
      const initialLists = lists || []
      setFavorites(initialFavs)
      setPlaylists(initialLists)
      setHistory((hist || []).slice(0, 100))

      // Auto-enrich any favorites missing metadata
      if (initialFavs.some(f => !f.title || f.title.startsWith('Track ') || f.channel === 'Unknown Artist')) {
        const enrichedFavs = await enrichTracks(initialFavs)
        setFavorites(enrichedFavs)
        favoritesStorage.save(enrichedFavs).catch(() => {})
      }

      // Auto-enrich any playlist tracks missing metadata
      let listsChanged = false
      const enrichedLists = await Promise.all(
        initialLists.map(async pl => {
          if (pl.tracks?.some(t => !t.title || t.title.startsWith('Track ') || t.channel === 'Unknown Artist')) {
            listsChanged = true
            const enriched = await enrichTracks(pl.tracks)
            return { ...pl, tracks: enriched, thumbnail: pl.thumbnail || enriched[0]?.thumbnail }
          }
          return pl
        })
      )
      if (listsChanged) {
        setPlaylists(enrichedLists)
        playlistStorage.save(enrichedLists).catch(() => {})
      }
    })
  }, [])

  // ── Favorites ───────────────────────────────────────────────────────────────
  const isFavorite = useCallback((trackId) => {
    return favorites.some(f => f.id === trackId)
  }, [favorites])

  const toggleFavorite = useCallback(async (track) => {
    const exists = favorites.some(f => f.id === track.id)
    let next
    if (exists) {
      next = favorites.filter(f => f.id !== track.id)
    } else {
      next = [{ ...track, likedAt: Date.now() }, ...favorites]
    }
    setFavorites(next)
    await favoritesStorage.save(next)
  }, [favorites])

  const getFavorites = useCallback(() => favorites, [favorites])

  // ── Playlists ───────────────────────────────────────────────────────────────
  const createPlaylist = useCallback(async (title, tracks = []) => {
    const newPlaylist = {
      id: `pl_${Date.now()}`,
      title,
      tracks,
      thumbnail: tracks[0]?.thumbnail || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const next = [newPlaylist, ...playlists]
    setPlaylists(next)
    await playlistStorage.save(next)
    return newPlaylist
  }, [playlists])

  const updatePlaylist = useCallback(async (playlistId, updates) => {
    const next = playlists.map(p => 
      p.id === playlistId 
        ? { ...p, ...updates, updatedAt: Date.now() } 
        : p
    )
    setPlaylists(next)
    await playlistStorage.save(next)
  }, [playlists])

  const deletePlaylist = useCallback(async (playlistId) => {
    const next = playlists.filter(p => p.id !== playlistId)
    setPlaylists(next)
    await playlistStorage.save(next)
  }, [playlists])

  const addTrackToPlaylist = useCallback(async (playlistId, track) => {
    const next = playlists.map(p => {
      if (p.id !== playlistId) return p
      const alreadyIn = p.tracks.some(t => t.id === track.id)
      if (alreadyIn) return p
      return {
        ...p,
        tracks: [...p.tracks, track],
        thumbnail: p.thumbnail || track.thumbnail,
        updatedAt: Date.now(),
      }
    })
    setPlaylists(next)
    await playlistStorage.save(next)
  }, [playlists])

  const removeTrackFromPlaylist = useCallback(async (playlistId, trackId) => {
    const next = playlists.map(p => {
      if (p.id !== playlistId) return p
      return { ...p, tracks: p.tracks.filter(t => t.id !== trackId), updatedAt: Date.now() }
    })
    setPlaylists(next)
    await playlistStorage.save(next)
  }, [playlists])

  // ── History ─────────────────────────────────────────────────────────────────
  const addToHistory = useCallback(async (track, completionPct = 0) => {
    await historyStorage.addEntry(track, completionPct)
    // Refresh local state with updated history
    const updated = await historyStorage.getAll()
    setHistory((updated || []).slice(0, 100))
  }, [])

  const clearHistory = useCallback(async () => {
    await historyStorage.clear()
    setHistory([])
  }, [])

  const getRecentlyPlayed = useCallback(() => {
    return history.filter(h => !h.isPlaylist).slice(0, 20)
  }, [history])

  return (
    <LibraryContext.Provider value={{
      // Favorites
      favorites,
      isFavorite,
      toggleFavorite,
      getFavorites,
      // Playlists
      playlists,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      // History
      history,
      addToHistory,
      clearHistory,
      getRecentlyPlayed,
    }}>
      {children}
    </LibraryContext.Provider>
  )
}

export const useLibrary = () => {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider')
  return ctx
}
