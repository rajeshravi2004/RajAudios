/**
 * PlayerBar.jsx — Bottom player bar
 * 
 * Three columns:
 *  Left: track info + like
 *  Center: controls + progress
 *  Right: volume + queue toggle
 */

import { useState, useCallback } from 'react'
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  QueueListIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
} from '@heroicons/react/24/solid'
import { HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { usePlayer } from '../../stores/playerStore.jsx'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { formatDuration } from '../../utils/formatters.js'

export function PlayerBar({ onToggleQueue, showQueue }) {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    shuffle,
    repeat,
    volume,
    progress,
    currentTime,
    duration,
    error,
    mediaMode,
    toggleMediaMode,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    clearError,
  } = usePlayer()

  const { isFavorite, toggleFavorite } = useLibrary()
  const [prevVolume, setPrevVolume] = useState(0.8)
  const [imgError, setImgError] = useState(false)

  const isFav = currentTrack ? isFavorite(currentTrack.id) : false

  const handleProgressClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = ((e.clientX - rect.left) / rect.width) * 100
    seekTo(Math.max(0, Math.min(100, percent)))
  }, [seekTo])

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume)
      setVolume(0)
    } else {
      setVolume(prevVolume || 0.8)
    }
  }

  const repeatIcon = () => {
    if (repeat === 'one') {
      return (
        <div className="relative">
          <ArrowPathIcon className="h-4 w-4" />
          <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold leading-none"
            style={{ color: 'var(--accent-bright)' }}>1</span>
        </div>
      )
    }
    return <ArrowPathIcon className="h-4 w-4" />
  }

  if (!currentTrack) {
    return (
      <div className="player-bar">
        <div className="flex-1" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Select a track to start listening
        </p>
        <div className="flex-1" />
      </div>
    )
  }

  return (
    <div className="player-bar">
      {/* ── Left: Track Info ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 w-[280px] flex-shrink-0 min-w-0">
        <div className="relative flex-shrink-0">
          {!imgError ? (
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-14 h-14 rounded-lg object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-14 h-14 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--bg-card)' }}>
              <span className="text-2xl">🎵</span>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(9,9,15,0.6)' }}>
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--accent-bright)', borderTopColor: 'transparent' }} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {currentTrack.title}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {currentTrack.channel?.replace(/ - Topic$/, '') || 'Unknown Artist'}
          </p>
        </div>

        <button
          onClick={() => toggleFavorite(currentTrack)}
          className="icon-btn flex-shrink-0"
          aria-label={isFav ? 'Unlike' : 'Like'}
          data-player-toggle
        >
          {isFav 
            ? <HeartSolid className="h-5 w-5 text-pink-500" />
            : <HeartIcon className="h-5 w-5" />
          }
        </button>
      </div>

      {/* ── Center: Controls + Progress ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center max-w-xl gap-2">
        {/* Error display */}
        {error && (
          <div className="text-xs px-3 py-1 rounded-full flex items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
            <span>{error}</span>
            <button onClick={clearError} className="hover:opacity-70">×</button>
          </div>
        )}

        {/* Playback controls */}
        <div className="flex items-center gap-2">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`icon-btn ${shuffle ? 'active' : ''}`}
            aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
            title="Shuffle"
          >
            <ArrowsRightLeftIcon className="h-4 w-4" />
          </button>

          {/* Previous */}
          <button
            onClick={playPrevious}
            className="icon-btn"
            aria-label="Previous track"
            title="Previous (P)"
          >
            <BackwardIcon className="h-5 w-5" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlayPause}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--text-primary)' }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title="Play/Pause (Space)"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: '#111', borderTopColor: 'transparent' }} />
            ) : isPlaying ? (
              <PauseIcon className="h-5 w-5 text-black" />
            ) : (
              <PlayIcon className="h-5 w-5 text-black ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={playNext}
            className="icon-btn"
            aria-label="Next track"
            title="Next (N)"
          >
            <ForwardIcon className="h-5 w-5" />
          </button>

          {/* Repeat */}
          <button
            onClick={toggleRepeat}
            className={`icon-btn ${repeat !== 'off' ? 'active' : ''}`}
            aria-label={`Repeat: ${repeat}`}
            title={`Repeat ${repeat} (R)`}
          >
            {repeatIcon()}
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full flex items-center gap-2">
          <span className="text-xs w-10 text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {formatDuration(currentTime)}
          </span>
          <div
            className="progress-bar flex-1"
            onClick={handleProgressClick}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label="Track progress"
          >
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            >
              <div className="progress-thumb" />
            </div>
          </div>
          <span className="text-xs w-10 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* ── Right: Mode Switcher + Volume + Queue ─────────────────────── */}
      <div className="flex items-center gap-2.5 w-[260px] flex-shrink-0 justify-end">
        {/* Song / Video mode toggle */}
        <button
          onClick={toggleMediaMode}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
            mediaMode === 'video'
              ? 'bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-600/40'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          title={mediaMode === 'video' ? 'Switch to Audio Mode' : 'Switch to Video Mode'}
          aria-label="Toggle Video Mode"
        >
          {mediaMode === 'video' ? (
            <>
              <VideoCameraIcon className="h-3.5 w-3.5" />
              <span>Video</span>
            </>
          ) : (
            <>
              <MusicalNoteIcon className="h-3.5 w-3.5" />
              <span>Song</span>
            </>
          )}
        </button>

        <button
          onClick={onToggleQueue}
          className={`icon-btn relative ${showQueue ? 'active' : ''}`}
          aria-label="Toggle queue"
          title="Queue (Q)"
        >
          <QueueListIcon className="h-5 w-5" />
        </button>

        <button
          onClick={handleMuteToggle}
          className="icon-btn flex-shrink-0"
          aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          title="Mute (M)"
        >
          {volume === 0 
            ? <SpeakerXMarkIcon className="h-4 w-4" />
            : <SpeakerWaveIcon className="h-4 w-4" />
          }
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.02"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 flex-shrink-0"
          aria-label="Volume"
          style={{
            background: `linear-gradient(to right, var(--accent-bright) ${volume * 100}%, rgba(255,255,255,0.15) ${volume * 100}%)`,
          }}
        />
      </div>
    </div>
  )
}
