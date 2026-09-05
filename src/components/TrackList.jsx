/**
 * TrackList.jsx — Full-width track list (for playlists, liked songs, etc.)
 */

import { useState } from 'react'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { HeartIcon, QueueListIcon, TrashIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { usePlayer } from '../stores/playerStore.jsx'
import { useLibrary } from '../stores/libraryStore.jsx'
import { formatDuration, formatCount } from '../utils/formatters.js'

export function TrackList({ 
  tracks, 
  showIndex = true, 
  showDuration = true,
  showViews = false,
  onPlay,
  onRemove,
}) {
  const { currentTrack, isPlaying, playTrack, addToQueue, togglePlayPause } = usePlayer()
  const { isFavorite, toggleFavorite } = useLibrary()
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const handlePlay = (track, index) => {
    if (onPlay) {
      onPlay(track, index)
    } else {
      playTrack(track, tracks, index)
    }
  }

  const handleTrackClick = (track, index) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause()
    } else {
      handlePlay(track, index)
    }
  }

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="grid items-center px-3 mb-2"
        style={{ 
          gridTemplateColumns: showIndex 
            ? `${showIndex ? '40px ' : ''}1fr${showDuration ? ' 60px' : ''}${onRemove ? ' 40px' : ''}` 
            : `1fr${showDuration ? ' 60px' : ''}`,
          color: 'var(--text-muted)',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {showIndex && <span className="text-center">#</span>}
        <span>Title</span>
        {showDuration && <span className="text-right">Time</span>}
        {onRemove && <span />}
      </div>

      {tracks.map((track, index) => {
        const isActive = currentTrack?.id === track.id
        const isFav = isFavorite(track.id)
        const isHovered = hoveredIndex === index

        return (
          <div
            key={`${track.id}-${index}`}
            className={`track-row group ${isActive ? 'active' : ''}`}
            style={{ 
              gridTemplateColumns: showIndex 
                ? `${showIndex ? '40px ' : ''}1fr auto${showDuration ? ' 60px' : ''}${onRemove ? ' 32px' : ''}`
                : `1fr auto${showDuration ? ' 60px' : ''}`,
              display: 'grid',
              alignItems: 'center',
              gap: '12px',
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Index / Play button */}
            {showIndex && (
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                {isHovered || isActive ? (
                  <button
                    onClick={() => handleTrackClick(track, index)}
                    className="icon-btn p-0.5"
                    aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
                  >
                    {isActive && isPlaying ? (
                      <PauseIcon className="h-4 w-4" style={{ color: 'var(--accent-bright)' }} />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <span style={{ color: isActive ? 'var(--accent-bright)' : 'var(--text-muted)', fontSize: '13px' }}>
                    {isActive ? (
                      <div className="playing-bars scale-75">
                        <div className="playing-bar" />
                        <div className="playing-bar" />
                        <div className="playing-bar" />
                      </div>
                    ) : (
                      index + 1
                    )}
                  </span>
                )}
              </div>
            )}

            {/* Track info */}
            <div className="flex items-center gap-3 min-w-0 flex-1"
              onClick={() => handleTrackClick(track, index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleTrackClick(track, index)
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`${isActive && isPlaying ? 'Pause' : 'Play'} ${track.title}`}
              style={{ cursor: 'pointer' }}
            >
              <img
                src={track.thumbnail || (track.id ? `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg` : '')}
                alt={track.title}
                className="w-10 h-10 rounded-lg flex-shrink-0 object-cover"
                loading="lazy"
                onError={(e) => {
                  if (track.id && !e.target.src.includes('ytimg.com')) {
                    e.target.src = `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`
                  } else {
                    e.target.style.display = 'none'
                  }
                }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate"
                  style={{ color: isActive ? 'var(--text-accent)' : 'var(--text-primary)' }}>
                  {track.title}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {track.channel?.replace(/ - Topic$/, '') || 'Unknown'}
                  {showViews && track.viewCount && ` · ${formatCount(track.viewCount)} views`}
                </p>
              </div>
            </div>

            {/* Action buttons (shown on hover) */}
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavorite(track) }}
                className="icon-btn"
                aria-label={isFav ? 'Unlike' : 'Like'}
              >
                {isFav ? (
                  <HeartSolid className="h-4 w-4 text-pink-500" />
                ) : (
                  <HeartIcon className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); addToQueue(track) }}
                className="icon-btn"
                title="Add to queue"
                aria-label="Add to queue"
              >
                <QueueListIcon className="h-4 w-4" />
              </button>
              {onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(track.id) }}
                  className="icon-btn text-red-400 hover:text-red-300"
                  title="Remove"
                  aria-label="Remove track"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Duration */}
            {showDuration && (
              <span className="text-xs text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                {track.isLive ? 'LIVE' : (track.durationSec > 0 ? formatDuration(track.durationSec) : '—')}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
