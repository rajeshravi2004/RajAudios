/**
 * Sidebar.jsx — Navigation sidebar
 */

import { useState } from 'react'
import {
  HomeIcon,
  MagnifyingGlassIcon,
  FireIcon,
  MusicalNoteIcon,
  HeartIcon,
  QueueListIcon,
  ClockIcon,
  Cog6ToothIcon,
  PlusIcon,
  ChevronDownIcon,
  BookmarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid,
  MagnifyingGlassIcon as SearchSolid,
  FireIcon as FireSolid,
  HeartIcon as HeartSolid,
  QueueListIcon as QueueSolid,
  ClockIcon as ClockSolid,
  Cog6ToothIcon as SettingsSolid,
  ShieldCheckIcon as ShieldSolid,
} from '@heroicons/react/24/solid'
import { useLibrary } from '../stores/libraryStore.jsx'
import { usePlayer } from '../stores/playerStore.jsx'
import { useAuth } from '../stores/authStore.jsx'
import { useDialog } from './ui/Dialog.jsx'

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: HomeIcon, activeIcon: HomeSolid },
  { id: 'search', label: 'Search', icon: MagnifyingGlassIcon, activeIcon: SearchSolid },
  { id: 'trending', label: 'Trending', icon: FireIcon, activeIcon: FireSolid },
]

const LIBRARY_ITEMS = [
  { id: 'liked', label: 'Liked Songs', icon: HeartIcon, activeIcon: HeartSolid },
  { id: 'playlists', label: 'My Playlists', icon: QueueListIcon, activeIcon: QueueSolid },
  { id: 'history', label: 'Recently Played', icon: ClockIcon, activeIcon: ClockSolid },
]

export function Sidebar({ currentView, onNavigate }) {
  const { playlists, favorites, createPlaylist } = useLibrary()
  const { currentTrack } = usePlayer()
  const { user, profile, isAdmin } = useAuth()
  const { prompt: showPrompt } = useDialog()
  const [libraryExpanded, setLibraryExpanded] = useState(true)

  const NavButton = ({ item }) => {
    const isActive = currentView === item.id
    const Icon = isActive ? item.activeIcon : item.icon

    return (
      <button
        className={`nav-item ${isActive ? 'active' : ''}`}
        onClick={() => onNavigate(item.id)}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span>{item.label}</span>
        {item.id === 'liked' && favorites.length > 0 && (
          <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
            {favorites.length}
          </span>
        )}
      </button>
    )
  }

  const handleCreatePlaylist = async () => {
    const name = await showPrompt({
      title: 'Create a playlist',
      message: 'Give your new playlist a name. You can add songs to it afterward.',
      inputLabel: 'Playlist name',
      placeholder: 'My playlist',
      confirmLabel: 'Create playlist',
      required: true,
    })
    if (name) {
      await createPlaylist(name)
    }
  }

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-glow)' }}>
            <MusicalNoteIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Rajify
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1 }}>
              Music Discovery
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 16px' }} />

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5 mb-5">
          {NAV_ITEMS.map(item => <NavButton key={item.id} item={item} />)}
        </div>

        {/* Library section */}
        <div className="mb-2">
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setLibraryExpanded(v => !v)}
            aria-expanded={libraryExpanded}
          >
            <span>Your Library</span>
            <ChevronDownIcon 
              className="h-3 w-3 ml-auto transition-transform" 
              style={{ transform: libraryExpanded ? '' : 'rotate(-90deg)' }}
            />
          </button>
          
          {libraryExpanded && (
            <div className="space-y-0.5 mt-1">
              {LIBRARY_ITEMS.map(item => <NavButton key={item.id} item={item} />)}
            </div>
          )}
        </div>

        {/* User playlists */}
        {libraryExpanded && (
          <div className="mt-3">
            <div className="flex items-center gap-2 px-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Playlists
              </span>
              <button
                onClick={handleCreatePlaylist}
                className="ml-auto icon-btn h-5 w-5"
                title="Create playlist"
                aria-label="Create new playlist"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-0.5">
              {playlists.length === 0 ? (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  No playlists yet
                </p>
              ) : (
                playlists.map(playlist => (
                  <button
                    key={playlist.id}
                    className={`nav-item text-sm ${currentView === `playlist:${playlist.id}` ? 'active' : ''}`}
                    onClick={() => onNavigate(`playlist:${playlist.id}`)}
                    title={playlist.title}
                  >
                    {playlist.thumbnail ? (
                      <img
                        src={playlist.thumbnail}
                        alt={playlist.title}
                        className="w-6 h-6 rounded flex-shrink-0 object-cover"
                      />
                    ) : (
                      <BookmarkIcon className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    )}
                    <span className="truncate text-xs">{playlist.title}</span>
                    <span className="ml-auto text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {playlist.tracks?.length || 0}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Settings + Now Playing footer */}
      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {/* Now playing mini info */}
        {currentTrack && (
          <div className="px-3 py-2 flex items-center gap-2">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-8 h-8 rounded object-cover flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-accent)' }}>
                {currentTrack.title}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {currentTrack.channel?.replace(/ - Topic$/, '')}
              </p>
            </div>
            <div className="playing-bars flex-shrink-0">
              <div className="playing-bar" />
              <div className="playing-bar" />
              <div className="playing-bar" />
            </div>
          </div>
        )}
        
        <div className="p-3 pt-0">
          <button className="sidebar-account" onClick={() => onNavigate('settings')}>
            {user && profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="sidebar-account-avatar">{user ? profile.name.slice(0, 1).toUpperCase() : 'G'}</span>
            )}
            <span className="sidebar-account-copy">
              <strong>{user ? profile.name : 'Guest session'}</strong>
              <span>{user ? profile.email : 'Sign in to sync'}</span>
            </span>
          </button>

          {isAdmin && (
            <button
              className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
              onClick={() => onNavigate('admin')}
            >
              {currentView === 'admin'
                ? <ShieldSolid className="h-5 w-5 flex-shrink-0" />
                : <ShieldCheckIcon className="h-5 w-5 flex-shrink-0" />
              }
              <span>User Admin</span>
            </button>
          )}

          <button
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => onNavigate('settings')}
          >
            {currentView === 'settings' 
              ? <SettingsSolid className="h-5 w-5 flex-shrink-0" />
              : <Cog6ToothIcon className="h-5 w-5 flex-shrink-0" />
            }
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}
