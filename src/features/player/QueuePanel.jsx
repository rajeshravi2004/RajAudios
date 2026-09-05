/**
 * QueuePanel.jsx — Slide-in queue panel
 */

import { useState } from 'react'
import { XMarkIcon, QueueListIcon } from '@heroicons/react/24/solid'
import { usePlayer } from '../../stores/playerStore.jsx'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { formatDuration } from '../../utils/formatters.js'
import { useDialog } from '../../components/ui/Dialog.jsx'

export function QueuePanel({ onClose }) {
  const {
    currentTrack,
    contextTracks,
    currentIndex,
    queue,
    playTrack,
    removeFromQueue,
    clearQueue,
  } = usePlayer()
  const { createPlaylist } = useLibrary()
  const { prompt: showPrompt } = useDialog()
  const [saving, setSaving] = useState(false)

  const upNext = contextTracks.slice(currentIndex + 1)

  const handleSaveQueueAsPlaylist = async () => {
    const allTracks = [...queue, ...upNext]
    if (allTracks.length === 0) return
    const name = await showPrompt({
      title: 'Save queue as playlist',
      message: `${allTracks.length} track${allTracks.length === 1 ? '' : 's'} will be saved in their current order.`,
      inputLabel: 'Playlist name',
      defaultValue: 'My Queue',
      confirmLabel: 'Save playlist',
      required: true,
    })
    if (!name) return
    setSaving(true)
    try {
      await createPlaylist(name, allTracks)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: '320px',
        background: 'var(--bg-elevated)',
        borderLeft: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <QueueListIcon className="h-5 w-5" style={{ color: 'var(--accent-bright)' }} />
          <h3 className="text-base font-bold">Queue</h3>
        </div>
        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <button
              onClick={clearQueue}
              className="icon-btn text-xs px-2 py-1 rounded-md"
              style={{ color: 'var(--text-muted)' }}
              title="Clear queue"
            >
              Clear
            </button>
          )}
          <button onClick={onClose} className="icon-btn" aria-label="Close queue">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Now Playing */}
        {currentTrack && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-muted)' }}>
              Now Playing
            </p>
            <QueueTrackRow track={currentTrack} isActive />
          </div>
        )}

        {/* Up Next (manual queue) */}
        {queue.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-muted)' }}>
              Up Next — Queue ({queue.length})
            </p>
            <div className="space-y-1">
              {queue.map((track, i) => (
                <QueueTrackRow
                  key={`q-${track.id}-${i}`}
                  track={track}
                  onRemove={() => removeFromQueue(i)}
                  onPlay={() => {
                    removeFromQueue(i)
                    playTrack(track)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Up Next (context playlist) */}
        {upNext.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-muted)' }}>
              Next from Playlist ({upNext.length})
            </p>
            <div className="space-y-1">
              {upNext.slice(0, 30).map((track, i) => (
                <QueueTrackRow
                  key={`ctx-${track.id}-${i}`}
                  track={track}
                  onPlay={() => playTrack(track, contextTracks, currentIndex + 1 + i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {queue.length === 0 && upNext.length === 0 && !currentTrack && (
          <div className="empty-state" style={{ padding: '40px 16px' }}>
            <QueueListIcon className="h-10 w-10" />
            <p className="text-sm">Queue is empty</p>
            <p className="text-xs">Add tracks to listen next</p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {(queue.length > 0 || upNext.length > 0) && (
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handleSaveQueueAsPlaylist}
            disabled={saving}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'var(--accent-subtle)',
              color: 'var(--text-accent)',
              border: '1px solid var(--border-accent)',
            }}
          >
            {saving ? 'Saving...' : 'Save as Playlist'}
          </button>
        </div>
      )}
    </div>
  )
}

function QueueTrackRow({ track, isActive, onRemove, onPlay }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg group transition-colors ${onPlay ? 'cursor-pointer' : ''} ${
        isActive ? '' : 'hover:bg-white/5'
      }`}
      style={{ background: isActive ? 'var(--accent-subtle)' : '' }}
      onClick={onPlay}
      onKeyDown={event => {
        if (event.target === event.currentTarget && onPlay && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onPlay()
        }
      }}
      role={onPlay ? 'button' : undefined}
      tabIndex={onPlay ? 0 : undefined}
      aria-label={onPlay ? `Play ${track.title}` : undefined}
    >
      <div className="relative flex-shrink-0">
        {!imgError ? (
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-10 h-10 rounded-lg object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-card)' }}>
            <span>🎵</span>
          </div>
        )}
        {isActive && (
          <div className="absolute inset-0 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(9,9,15,0.5)' }}>
            <div className="playing-bars scale-75">
              <div className="playing-bar" />
              <div className="playing-bar" />
              <div className="playing-bar" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate"
          style={{ color: isActive ? 'var(--text-accent)' : 'var(--text-primary)' }}>
          {track.title}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {track.channel?.replace(/ - Topic$/, '')}
        </p>
      </div>

      {track.durationSec > 0 && (
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {formatDuration(track.durationSec)}
        </span>
      )}

      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="icon-btn opacity-0 group-hover:opacity-100 flex-shrink-0"
          aria-label="Remove from queue"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
