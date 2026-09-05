/**
 * TrackCard.jsx — Compact card for tracks in horizontal scroll sections
 */

import { useState } from 'react'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { HeartIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { usePlayer } from '../stores/playerStore.jsx'
import { useLibrary } from '../stores/libraryStore.jsx'
import { formatDuration } from '../utils/formatters.js'

export function TrackCard({ track, contextTracks, explanation, onPlay, size = 'md' }) {
  const [imgError, setImgError] = useState(false)
  const { currentTrack, isPlaying, playTrack } = usePlayer()
  const { isFavorite, toggleFavorite } = useLibrary()
  
  const isActive = currentTrack?.id === track.id
  const isFav = isFavorite(track.id)
  
  const sizeClasses = {
    sm: 'w-36',
    md: 'w-44',
    lg: 'w-52',
  }
  
  const handlePlay = (e) => {
    e.stopPropagation()
    if (onPlay) {
      onPlay(track)
    } else {
      playTrack(track, contextTracks || [])
    }
  }

  const handleFavorite = (e) => {
    e.stopPropagation()
    toggleFavorite(track)
  }

  return (
    <div
      className={`music-card flex-shrink-0 p-3 cursor-pointer ${sizeClasses[size]} fade-in`}
      onClick={handlePlay}
      role="button"
      tabIndex={0}
      aria-label={`Play ${track.title}`}
      onKeyDown={(e) => e.key === 'Enter' && handlePlay(e)}
    >
      {/* Thumbnail */}
      <div className="relative mb-3 rounded-lg overflow-hidden aspect-square group">
        {!imgError && (track.thumbnail || track.id) ? (
          <img
            src={track.thumbnail || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`}
            alt={track.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              if (track.id && !e.target.src.includes('ytimg.com')) {
                e.target.src = `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`
              } else {
                setImgError(true)
              }
            }}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)' }}>
            <span className="text-4xl">🎵</span>
          </div>
        )}

        {/* Active indicator */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(9, 9, 15, 0.5)' }}>
            {isPlaying ? (
              <div className="playing-bars">
                <div className="playing-bar" />
                <div className="playing-bar" />
                <div className="playing-bar" />
              </div>
            ) : (
              <PlayIcon className="h-8 w-8 text-white" />
            )}
          </div>
        )}

        {/* Hover play button */}
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(9, 9, 15, 0.5)' }}>
            <button
              onClick={handlePlay}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-glow)' }}
              aria-label={`Play ${track.title}`}
            >
              <PlayIcon className="h-5 w-5 text-white ml-0.5" />
            </button>
          </div>
        )}

        {/* Like button */}
        <button
          onClick={handleFavorite}
          className="absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(9,9,15,0.7)' }}
          aria-label={isFav ? 'Unlike' : 'Like'}
        >
          {isFav ? (
            <HeartSolid className="h-4 w-4 text-pink-500" />
          ) : (
            <HeartIcon className="h-4 w-4 text-white" />
          )}
        </button>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate mb-0.5"
          style={{ color: isActive ? 'var(--text-accent)' : 'var(--text-primary)' }}>
          {track.title}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {track.channel?.replace(/ - Topic$/, '') || 'Unknown Artist'}
        </p>
        {explanation && (
          <p className="text-xs mt-1 truncate" style={{ color: 'var(--accent-bright)', opacity: 0.7 }}>
            ✦ {explanation}
          </p>
        )}
        {track.durationSec > 0 && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
            {formatDuration(track.durationSec)}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * PlaylistCard — Card for playlist items
 */
export function PlaylistCard({ playlist, onClick, size = 'md' }) {
  const [imgError, setImgError] = useState(false)
  
  const sizeClasses = {
    sm: 'w-36',
    md: 'w-44',
    lg: 'w-52',
  }

  return (
    <div
      className={`music-card flex-shrink-0 p-3 cursor-pointer ${sizeClasses[size]} fade-in`}
      onClick={() => onClick?.(playlist)}
      role="button"
      tabIndex={0}
      aria-label={`Open playlist: ${playlist.title}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(playlist)}
    >
      <div className="relative mb-3 rounded-lg overflow-hidden aspect-square group">
        {!imgError && playlist.thumbnail ? (
          <img
            src={playlist.thumbnail}
            alt={playlist.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--accent-muted), var(--bg-elevated))' }}>
            <span className="text-4xl">📃</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(9, 9, 15, 0.5)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent)' }}>
            <PlayIcon className="h-5 w-5 text-white ml-0.5" />
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate mb-0.5" style={{ color: 'var(--text-primary)' }}>
          {playlist.title}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {playlist.channel || 'Playlist'}
          {playlist.itemCount > 0 && ` · ${playlist.itemCount} tracks`}
        </p>
      </div>
    </div>
  )
}
