/**
 * playerStore.jsx — Player state context
 * 
 * Manages: current track, queue, playback state, shuffle, repeat, volume, progress
 * The YouTube IFrame player instance is stored in a ref (NOT state) to avoid re-renders.
 */

import { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react'
import { shuffleArray } from '../utils/formatters.js'
import { queueStorage } from '../utils/storage.js'
import { useSettings } from './settingsStore.jsx'

const PlayerContext = createContext(null)

// ─── State ─────────────────────────────────────────────────────────────────────
const initialState = {
  currentTrack: null,
  currentIndex: 0,
  // Playlist context (tracks in the current playlist/search result)
  contextTracks: [],
  originalContextTracks: [],
  // Up-next queue (tracks added manually)
  queue: [],
  isPlaying: false,
  shuffle: false,
  repeat: 'off',   // 'off' | 'one' | 'all'
  volume: 0.8,
  progress: 0,     // 0-100
  currentTime: 0,  // seconds
  duration: 0,     // seconds
  isLoading: false,
  error: null,
  mediaMode: 'audio', // 'audio' | 'video'
}

// ─── Reducer ───────────────────────────────────────────────────────────────────
function playerReducer(state, action) {
  switch (action.type) {
    case 'SET_MEDIA_MODE':
      return { ...state, mediaMode: action.value }

    case 'TOGGLE_MEDIA_MODE':
      return { ...state, mediaMode: state.mediaMode === 'video' ? 'audio' : 'video' }
    case 'SET_TRACK':
      return {
        ...state,
        currentTrack: action.track,
        currentIndex: action.index ?? state.currentIndex,
        isLoading: true,
        error: null,
        progress: 0,
        currentTime: 0,
        duration: 0,
      }

    case 'TRACK_LOADED':
      return { ...state, isLoading: false }

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.value }

    case 'SET_PROGRESS':
      return {
        ...state,
        progress: action.progress,
        currentTime: action.currentTime,
        duration: action.duration,
      }

    case 'SET_VOLUME':
      return { ...state, volume: action.value }

    case 'SET_SHUFFLE': {
      if (action.value) {
        const shuffled = shuffleArray(state.originalContextTracks)
        // Move current track to front
        const currentId = state.currentTrack?.id
        if (currentId) {
          const idx = shuffled.findIndex(t => t.id === currentId)
          if (idx > -1) {
            const [current] = shuffled.splice(idx, 1)
            shuffled.unshift(current)
          }
        }
        return {
          ...state,
          shuffle: true,
          contextTracks: shuffled,
          currentIndex: 0,
        }
      } else {
        const currentId = state.currentTrack?.id
        const newIndex = state.originalContextTracks.findIndex(t => t.id === currentId)
        return {
          ...state,
          shuffle: false,
          contextTracks: state.originalContextTracks,
          currentIndex: newIndex !== -1 ? newIndex : state.currentIndex,
        }
      }
    }

    case 'SET_REPEAT':
      return { ...state, repeat: action.value }

    case 'TOGGLE_REPEAT': {
      const modes = ['off', 'all', 'one']
      const next = modes[(modes.indexOf(state.repeat) + 1) % modes.length]
      return { ...state, repeat: next }
    }

    case 'SET_CONTEXT': {
      const tracks = action.tracks || []
      const shuffled = action.keepShuffle && state.shuffle ? shuffleArray(tracks) : tracks
      const index = action.startIndex ?? 0
      return {
        ...state,
        contextTracks: shuffled,
        originalContextTracks: tracks,
        currentIndex: index,
      }
    }

    case 'SET_QUEUE':
      return { ...state, queue: action.queue }

    case 'ADD_TO_QUEUE':
      return { ...state, queue: [...state.queue, action.track] }

    case 'PLAY_NEXT':
      return { ...state, queue: [action.track, ...state.queue] }

    case 'REMOVE_FROM_QUEUE':
      return { ...state, queue: state.queue.filter((_, i) => i !== action.index) }

    case 'CLEAR_QUEUE':
      return { ...state, queue: [] }

    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false, isPlaying: false }

    case 'CLEAR_ERROR':
      return { ...state, error: null }

    default:
      return state
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function PlayerProvider({ children }) {
  const { settings, loaded: settingsLoaded } = useSettings()
  const [state, dispatch] = useReducer(playerReducer, initialState)
  const playerRef = useRef(null)  // YouTube IFrame player instance
  const stateRef = useRef(state)
  const progressIntervalRef = useRef(null)
  const playbackRequestRef = useRef(0)
  const settingsRef = useRef(settings)

  // Keep stateRef in sync for use in callbacks (avoids stale closure issues)
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { settingsRef.current = settings }, [settings])

  // Apply persisted playback preferences once settings have loaded, and keep
  // live Settings-page changes connected to the actual player.
  useEffect(() => {
    if (!settingsLoaded) return
    dispatch({ type: 'SET_VOLUME', value: settings.volume })
    dispatch({ type: 'SET_REPEAT', value: settings.repeat })
    if (stateRef.current.shuffle !== settings.shuffle) {
      dispatch({ type: 'SET_SHUFFLE', value: settings.shuffle })
    }
    if (playerRef.current?.setVolume) {
      try { playerRef.current.setVolume(settings.volume * 100) } catch { /* player may not be ready */ }
    }
  }, [settingsLoaded, settings.volume, settings.repeat, settings.shuffle])

  // Load persisted queue on mount
  useEffect(() => {
    queueStorage.get().then(saved => {
      if (saved?.tracks?.length > 0) {
        dispatch({ type: 'SET_QUEUE', queue: saved.tracks })
      }
    })
  }, [])

  // Persist queue changes
  useEffect(() => {
    queueStorage.save({ tracks: state.queue, currentIndex: state.currentIndex })
  }, [state.queue, state.currentIndex])

  // ── Progress tracking ────────────────────────────────────────────────────────
  useEffect(() => {
    progressIntervalRef.current = setInterval(() => {
      const player = playerRef.current
      if (!player?.getCurrentTime || !player?.getDuration) return
      try {
        const currentTime = player.getCurrentTime()
        const duration = player.getDuration()
        if (currentTime != null && duration && duration > 0) {
          dispatch({
            type: 'SET_PROGRESS',
            progress: (currentTime / duration) * 100,
            currentTime,
            duration,
          })
        }
      } catch { /* player may not be ready */ }
    }, 1000)

    return () => clearInterval(progressIntervalRef.current)
  }, [])

  // Wait briefly for the iframe API, cancel superseded requests, and fail
  // visibly instead of retrying forever when YouTube cannot initialize.
  const startPlayback = useCallback((track) => {
    const requestId = ++playbackRequestRef.current
    let attempts = 0

    if (!track?.id) {
      dispatch({ type: 'SET_ERROR', error: 'This track has no playable video.' })
      return
    }
    if (track.embeddable === false) {
      dispatch({ type: 'SET_ERROR', error: 'This video is not available for playback outside YouTube.' })
      return
    }

    const load = () => {
      if (requestId !== playbackRequestRef.current) return
      const player = playerRef.current
      if (!player?.loadVideoById) {
        attempts += 1
        if (attempts < 50) {
          setTimeout(load, 200)
        } else {
          dispatch({ type: 'SET_ERROR', error: 'The YouTube player could not start. Check your connection and try again.' })
        }
        return
      }

      try {
        player.loadVideoById(track.id)
        player.playVideo?.()
      } catch (error) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to play this track. Please try another one.' })
        console.error('startPlayback error:', error)
      }
    }

    load()
  }, [])

  // ── Core play action ─────────────────────────────────────────────────────────
  const playTrackAtIndex = useCallback((index) => {
    const { contextTracks } = stateRef.current
    if (index < 0 || index >= contextTracks.length) return
    const track = contextTracks[index]
    dispatch({ type: 'SET_TRACK', track, index })
    startPlayback(track)
  }, [startPlayback])

  const playTrack = useCallback((track, contextTracks = [], startIndex = null) => {
    // If context tracks provided, update context first
    if (contextTracks.length > 0) {
      const idx = startIndex ?? contextTracks.findIndex(t => t.id === track.id)
      dispatch({ type: 'SET_CONTEXT', tracks: contextTracks, startIndex: idx >= 0 ? idx : 0, keepShuffle: true })
      dispatch({ type: 'SET_TRACK', track, index: idx >= 0 ? idx : 0 })
    } else {
      dispatch({ type: 'SET_TRACK', track })
    }

    startPlayback(track)
  }, [startPlayback])

  const playNext = useCallback(() => {
    const { queue, currentIndex, contextTracks, repeat } = stateRef.current

    // Queue takes priority
    if (queue.length > 0) {
      const next = queue[0]
      dispatch({ type: 'REMOVE_FROM_QUEUE', index: 0 })
      playTrack(next)
      return
    }

    if (currentIndex < contextTracks.length - 1) {
      playTrackAtIndex(currentIndex + 1)
    } else if (repeat === 'all') {
      playTrackAtIndex(0)
    }
    // else: end of context, no repeat — nothing plays
  }, [playTrack, playTrackAtIndex])

  const playPrevious = useCallback(() => {
    const { currentIndex, contextTracks, repeat, currentTime } = stateRef.current

    // If more than 3 seconds in, restart current track
    if (currentTime > 3) {
      const player = playerRef.current
      if (player?.seekTo) {
        try { player.seekTo(0, true) } catch { /* ignore */ }
      }
      return
    }

    if (currentIndex > 0) {
      playTrackAtIndex(currentIndex - 1)
    } else if (repeat === 'all') {
      playTrackAtIndex(contextTracks.length - 1)
    }
  }, [playTrackAtIndex])

  const togglePlayPause = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    try {
      if (stateRef.current.isPlaying) {
        player.pauseVideo()
      } else {
        player.playVideo()
      }
    } catch (e) {
      console.error('togglePlayPause error:', e)
    }
  }, [])

  const seekTo = useCallback((percent) => {
    const player = playerRef.current
    if (!player?.getDuration) return
    try {
      const duration = player.getDuration()
      if (duration) player.seekTo((percent / 100) * duration, true)
    } catch { /* ignore */ }
  }, [])

  const setVolume = useCallback((vol) => {
    dispatch({ type: 'SET_VOLUME', value: vol })
    const player = playerRef.current
    if (player?.setVolume) {
      try { player.setVolume(vol * 100) } catch { /* ignore */ }
    }
  }, [])

  const toggleShuffle = useCallback(() => {
    const newShuffle = !stateRef.current.shuffle
    dispatch({ type: 'SET_SHUFFLE', value: newShuffle })
  }, [])

  const toggleRepeat = useCallback(() => {
    dispatch({ type: 'TOGGLE_REPEAT' })
  }, [])

  const handleTrackEnd = useCallback(() => {
    const { repeat, queue, currentIndex, contextTracks } = stateRef.current
    if (repeat === 'one') {
      playTrackAtIndex(currentIndex)
      return
    }
    if (queue.length > 0) {
      const next = queue[0]
      dispatch({ type: 'REMOVE_FROM_QUEUE', index: 0 })
      playTrack(next)
      return
    }
    if (settingsRef.current.autoplay === false) return
    if (currentIndex < contextTracks.length - 1) {
      playTrackAtIndex(currentIndex + 1)
    } else if (repeat === 'all') {
      playTrackAtIndex(0)
    }
  }, [playTrack, playTrackAtIndex])

  const value = {
    // State
    ...state,
    // Refs
    playerRef,
    // Actions
    playTrack,
    playNext,
    playPrevious,
    togglePlayPause,
    seekTo,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    handleTrackEnd,
    // Dispatch for specific actions
    addToQueue: (track) => dispatch({ type: 'ADD_TO_QUEUE', track }),
    playNextInQueue: (track) => dispatch({ type: 'PLAY_NEXT', track }),
    removeFromQueue: (index) => dispatch({ type: 'REMOVE_FROM_QUEUE', index }),
    clearQueue: () => dispatch({ type: 'CLEAR_QUEUE' }),
    setRepeat: (value) => dispatch({ type: 'SET_REPEAT', value }),
    setPlaying: (value) => dispatch({ type: 'SET_PLAYING', value }),
    trackLoaded: () => dispatch({ type: 'TRACK_LOADED' }),
    setError: (error) => dispatch({ type: 'SET_ERROR', error }),
    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
    setContext: (tracks, startIndex = 0) => dispatch({ type: 'SET_CONTEXT', tracks, startIndex }),
    setMediaMode: (mode) => dispatch({ type: 'SET_MEDIA_MODE', value: mode }),
    toggleMediaMode: () => dispatch({ type: 'TOGGLE_MEDIA_MODE' }),
  }

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
