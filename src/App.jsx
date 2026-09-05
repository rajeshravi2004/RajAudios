/**
 * App.jsx — Root layout and view router
 * 
 * This component is intentionally thin — it:
 *  1. Wraps all context providers
 *  2. Renders the main layout (sidebar + content area + player bar)
 *  3. Routes between pages based on `currentView` state
 *  4. Manages Audio Mode vs Video Mode display
 *  5. Initializes the YouTube player hook & keyboard shortcuts
 */

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './components/Sidebar.jsx'
import { PlayerBar } from './features/player/PlayerBar.jsx'
import { QueuePanel } from './features/player/QueuePanel.jsx'
import { NowPlayingVideo } from './features/player/NowPlayingVideo.jsx'
import { HomePage } from './features/discovery/HomePage.jsx'
import { TrendingPage } from './features/discovery/TrendingPage.jsx'
import { SearchPage } from './features/search/SearchPage.jsx'
import { LibraryPage } from './features/library/LibraryPage.jsx'
import { PlaylistDetail, UserPlaylistDetail } from './features/library/PlaylistDetail.jsx'
import { SettingsPage } from './features/settings/SettingsPage.jsx'
import { AuthGate } from './features/auth/AuthGate.jsx'
import { AdminPage } from './features/admin/AdminPage.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { DialogProvider } from './components/ui/Dialog.jsx'
import { PlayerProvider, usePlayer } from './stores/playerStore.jsx'
import { LibraryProvider, useLibrary } from './stores/libraryStore.jsx'
import { SettingsProvider, useSettings } from './stores/settingsStore.jsx'
import { AuthProvider } from './stores/authStore.jsx'
import { useYouTubePlayer } from './hooks/useYouTubePlayer.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { migrateCookieData } from './utils/storage.js'

// ─── App Shell (inside providers) ─────────────────────────────────────────────
function AppShell() {
  const [currentView, setCurrentView] = useState('home')
  const [showQueue, setShowQueue] = useState(false)
  const [currentPlaylist, setCurrentPlaylist] = useState(null) // YouTube playlist
  const [currentUserPlaylist, setCurrentUserPlaylist] = useState(null)
  
  const { playlists, addToHistory } = useLibrary()
  const { mediaMode, setMediaMode, currentTrack } = usePlayer()
  const { settings } = useSettings()

  // Initialize YouTube player and keyboard shortcuts
  useYouTubePlayer()
  useKeyboardShortcuts()

  // Migrate old cookie data on first run
  useEffect(() => {
    migrateCookieData()
  }, [])

  // Record a track as soon as the user starts it so Recently Played updates live.
  useEffect(() => {
    if (currentTrack && settings.saveHistory) {
      addToHistory(currentTrack)
    }
  }, [currentTrack, settings.saveHistory, addToHistory])

  const navigate = useCallback((view) => {
    setCurrentView(view)
    // Clear sub-pages when navigating to top-level
    if (!view.startsWith('playlist:')) {
      setCurrentPlaylist(null)
      setCurrentUserPlaylist(null)
    }
  }, [])

  // Handle opening a YouTube playlist from the discovery service
  const handleOpenPlaylist = useCallback((playlist) => {
    setCurrentPlaylist(playlist)
    setCurrentUserPlaylist(null)
  }, [])

  // Handle opening a user-created playlist
  const handleOpenUserPlaylist = useCallback((playlist) => {
    setCurrentUserPlaylist(playlist)
    setCurrentPlaylist(null)
  }, [])

  // Sidebar navigation can include playlist:id format for user playlists
  const handleSidebarNavigate = useCallback((view) => {
    if (view.startsWith('playlist:')) {
      const playlistId = view.replace('playlist:', '')
      const playlist = playlists.find(p => p.id === playlistId)
      if (playlist) {
        handleOpenUserPlaylist(playlist)
        return
      }
    }
    navigate(view)
    setCurrentPlaylist(null)
    setCurrentUserPlaylist(null)
  }, [navigate, playlists, handleOpenUserPlaylist])

  // Render the active view
  const renderContent = () => {
    // If in Video Mode and a track is active, show the Video Cinema Stage
    if (mediaMode === 'video' && currentTrack) {
      return (
        <NowPlayingVideo onClose={() => setMediaMode('audio')} />
      )
    }

    // Sub-page: YouTube playlist detail
    if (currentPlaylist) {
      return (
        <PlaylistDetail
          playlist={currentPlaylist}
          onBack={() => setCurrentPlaylist(null)}
        />
      )
    }

    // Sub-page: User playlist detail
    if (currentUserPlaylist) {
      return (
        <UserPlaylistDetail
          playlist={currentUserPlaylist}
          onBack={() => setCurrentUserPlaylist(null)}
        />
      )
    }

    // Library sub-views via sidebar
    const sidebarView = currentView
    if (sidebarView === 'liked') {
        return (
          <LibraryPage
            initialTab="liked"
            onOpenUserPlaylist={handleOpenUserPlaylist}
        />
      )
    }
    if (sidebarView === 'playlists') {
      return (
          <LibraryPage
            initialTab="playlists"
            onOpenUserPlaylist={handleOpenUserPlaylist}
        />
      )
    }
    if (sidebarView === 'history') {
      return (
          <LibraryPage
            initialTab="history"
            onOpenUserPlaylist={handleOpenUserPlaylist}
        />
      )
    }

    switch (currentView) {
      case 'home':
        return <HomePage onOpenPlaylist={handleOpenPlaylist} />
      case 'search':
        return <SearchPage onOpenPlaylist={handleOpenPlaylist} />
      case 'trending':
        return <TrendingPage />
      case 'library':
        return (
          <LibraryPage
            onOpenUserPlaylist={handleOpenUserPlaylist}
          />
        )
      case 'settings':
        return <SettingsPage />
      case 'admin':
        return <AdminPage />
      default:
        return <HomePage onOpenPlaylist={handleOpenPlaylist} />
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      {/* Main content area (sidebar + page) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sidebar
          currentView={currentPlaylist || currentUserPlaylist ? '' : currentView}
          onNavigate={handleSidebarNavigate}
        />

        {/* Page content */}
        <main
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            position: 'relative',
          }}
        >
          {/* Scrollable page */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {renderContent()}
          </div>

          {/* Queue panel (slides in from right) */}
          {showQueue && (
            <QueuePanel onClose={() => setShowQueue(false)} />
          )}
        </main>
      </div>

      {/* Bottom player bar */}
      <PlayerBar
        onToggleQueue={() => setShowQueue(v => !v)}
        showQueue={showQueue}
      />

      {/* Persistent YouTube Player Container */}
      <div
        id="yt-player-container"
        style={
          mediaMode === 'video' && currentTrack
            ? {
                position: 'fixed',
                top: '50%',
                left: 'calc(var(--sidebar-width) + (100vw - var(--sidebar-width)) / 2)',
                transform: 'translate(-50%, -55%)',
                width: 'min(900px, 80vw)',
                aspectRatio: '16/9',
                zIndex: 40,
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                background: '#000',
              }
            : {
                position: 'fixed',
                bottom: -9999,
                left: -9999,
                width: '1px',
                height: '1px',
                opacity: 0,
                pointerEvents: 'none',
              }
        }
      >
        <div id="yt-player" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

// ─── Root App with Providers ───────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <SettingsProvider>
          <LibraryProvider>
            <PlayerProvider>
              <ToastProvider>
                <DialogProvider>
                  <AppShell />
                </DialogProvider>
              </ToastProvider>
            </PlayerProvider>
          </LibraryProvider>
        </SettingsProvider>
      </AuthGate>
    </AuthProvider>
  )
}
