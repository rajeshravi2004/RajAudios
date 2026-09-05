/**
 * LibraryPage.jsx — Library hub: Liked Songs, Playlists, History tabs
 */

import { useState } from 'react'
import { HeartIcon, QueueListIcon, ClockIcon, PlayIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/solid'
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline'
import { TrackList } from '../../components/TrackList.jsx'
import { EmptyState } from '../../components/ui/ErrorState.jsx'
import { usePlayer } from '../../stores/playerStore.jsx'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { formatRelativeTime } from '../../utils/formatters.js'

const TABS = [
  { id: 'liked', label: 'Liked Songs', icon: HeartIcon },
  { id: 'playlists', label: 'Playlists', icon: QueueListIcon },
  { id: 'history', label: 'Recently Played', icon: ClockIcon },
]

export function LibraryPage({ onOpenPlaylist, onOpenUserPlaylist, initialTab = 'liked' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const { playTrack } = usePlayer()
  const {
    favorites,
    playlists,
    history,
    toggleFavorite,
    createPlaylist,
    deletePlaylist,
    clearHistory,
  } = useLibrary()

  const recentTracks = history.filter(h => !h.isPlaylist).slice(0, 50)

  return (
    <div className="page-scroll fade-in">
      <div className="page-content">
        <h1 className="text-3xl font-bold mb-6">Your Library</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: 'var(--border-subtle)', paddingBottom: '0' }}>
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium relative transition-colors"
                style={{
                  color: isActive ? 'var(--text-accent)' : 'var(--text-muted)',
                  borderBottom: isActive ? `2px solid var(--accent-bright)` : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.id === 'liked' && favorites.length > 0 && (
                  <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--text-accent)' }}>
                    {favorites.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Liked Songs */}
        {activeTab === 'liked' && (
          <LikedSongsTab
            tracks={favorites}
            onPlay={(t, i) => playTrack(t, favorites, i)}
            onUnlike={toggleFavorite}
          />
        )}

        {/* Playlists */}
        {activeTab === 'playlists' && (
          <PlaylistsTab
            playlists={playlists}
            onOpenPlaylist={onOpenUserPlaylist}
            onDelete={deletePlaylist}
            onCreatePlaylist={createPlaylist}
          />
        )}

        {/* History */}
        {activeTab === 'history' && (
          <HistoryTab
            tracks={recentTracks}
            onPlay={(t, i) => playTrack(t, recentTracks, i)}
            onClear={clearHistory}
          />
        )}
      </div>
    </div>
  )
}

function LikedSongsTab({ tracks, onPlay, onUnlike }) {
  if (tracks.length === 0) {
    return (
      <EmptyState
        icon={<HeartOutline className="h-12 w-12" />}
        title="No liked songs yet"
        subtitle="Heart a song while it's playing to save it here"
      />
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>
          <HeartIcon className="h-10 w-10 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Liked Songs</h2>
          <p style={{ color: 'var(--text-muted)' }}>{tracks.length} tracks</p>
        </div>
        <button
          onClick={() => onPlay(tracks[0], 0)}
          disabled={tracks.length === 0}
          className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <PlayIcon className="h-4 w-4" />
          Play All
        </button>
      </div>
      <TrackList
        tracks={tracks}
        showIndex={true}
        showDuration={true}
        onPlay={onPlay}
        onRemove={(id) => {
          const t = tracks.find(tr => tr.id === id)
          if (t) onUnlike(t)
        }}
      />
    </div>
  )
}

function PlaylistsTab({ playlists, onOpenPlaylist, onDelete, onCreatePlaylist }) {
  const handleCreate = async () => {
    const name = prompt('Playlist name:')
    if (name?.trim()) await onCreatePlaylist(name.trim())
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Your Playlists</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
          style={{
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-accent)',
            color: 'var(--text-accent)',
          }}
        >
          <PlusIcon className="h-4 w-4" />
          New Playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <EmptyState
          icon={<QueueListIcon className="h-12 w-12" />}
          title="No playlists yet"
          subtitle="Create a playlist to organize your favorite music"
          action={
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Create Playlist
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {playlists.map(playlist => (
            <div
              key={playlist.id}
              className="flex items-center gap-4 p-3 rounded-xl cursor-pointer group transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}
              onClick={() => onOpenPlaylist?.(playlist)}
            >
              {playlist.thumbnail ? (
                <img src={playlist.thumbnail} alt={playlist.title}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center"
                  style={{ background: 'var(--accent-subtle)' }}>
                  <QueueListIcon className="h-6 w-6" style={{ color: 'var(--accent-bright)' }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{playlist.title}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {playlist.tracks?.length || 0} tracks · {formatRelativeTime(playlist.updatedAt || playlist.createdAt)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(playlist.id) }}
                className="icon-btn opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                aria-label="Delete playlist"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryTab({ tracks, onPlay, onClear }) {
  if (tracks.length === 0) {
    return (
      <EmptyState
        icon={<ClockIcon className="h-12 w-12" />}
        title="No listening history"
        subtitle="Your recently played tracks will appear here"
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Recently Played</h2>
        <button
          onClick={onClear}
          className="text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          Clear History
        </button>
      </div>
      <TrackList
        tracks={tracks}
        showIndex={false}
        showDuration={true}
        onPlay={onPlay}
      />
    </div>
  )
}
