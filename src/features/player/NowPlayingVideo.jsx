/**
 * NowPlayingVideo.jsx — Full Video Stage for Video Mode
 * 
 * Displays the video player in a theater/cinema environment with glowing backdrop,
 * track info, and seamless toggle between Song and Video modes.
 */

import { useEffect, useState } from 'react'
import {
  MusicalNoteIcon,
  VideoCameraIcon,
  XMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  HeartIcon,
} from '@heroicons/react/24/solid'
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline'
import { usePlayer } from '../../stores/playerStore.jsx'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { formatCount } from '../../utils/formatters.js'

export function NowPlayingVideo({ onClose }) {
  const {
    currentTrack,
    mediaMode,
    setMediaMode,
  } = usePlayer()

  const { isFavorite, toggleFavorite } = useLibrary()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isFav = currentTrack ? isFavorite(currentTrack.id) : false

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement?.id === 'yt-player-container')
    }
    document.addEventListener('fullscreenchange', syncFullscreenState)
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [])

  const toggleFullscreen = async () => {
    const playerContainer = document.getElementById('yt-player-container')
    if (!playerContainer) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        // Fullscreen the real iframe container. The stage is its sibling, so
        // targeting the stage previously displayed only an empty placeholder.
        await playerContainer.requestFullscreen()
      }
    } catch (error) {
      console.warn('Fullscreen request failed:', error)
    }
  }

  if (!currentTrack) return null

  return (
    <div
      id="video-stage-container"
      className="fade-in relative flex flex-col h-full w-full overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center top, rgba(124, 58, 237, 0.22) 0%, var(--bg-base) 75%)',
      }}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 z-20 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        
        {/* Mode Switcher Pill */}
        <div className="flex items-center p-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 shadow-lg">
          <button
            onClick={() => setMediaMode('audio')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              mediaMode === 'audio'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MusicalNoteIcon className="h-3.5 w-3.5" />
            Song Mode
          </button>

          <button
            onClick={() => setMediaMode('video')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              mediaMode === 'video'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <VideoCameraIcon className="h-3.5 w-3.5" />
            Video Mode
          </button>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleFavorite(currentTrack)}
            className="icon-btn"
            aria-label={isFav ? 'Unlike' : 'Like'}
          >
            {isFav ? <HeartIcon className="h-5 w-5 text-pink-500" /> : <HeartOutline className="h-5 w-5" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="icon-btn"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen video' : 'Fullscreen video'}
          >
            {isFullscreen ? <ArrowsPointingInIcon className="h-5 w-5" /> : <ArrowsPointingOutIcon className="h-5 w-5" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="icon-btn"
              title="Close video view"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Video Cinema Arena */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden relative">
        {/* Ambient Glow behind player */}
        <div
          className="absolute w-[720px] h-[400px] rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ background: 'var(--accent)' }}
        />

        {/* 16:9 Video Canvas Frame */}
        <div
          id="video-frame-container"
          className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-10 bg-black flex items-center justify-center"
        >
          {/* YouTube iframe mounts over this container in video mode */}
        </div>

        {/* Track Title & Artist Info Below Video */}
        <div className="mt-4 text-center max-w-2xl px-4 z-10">
          <h2 className="text-xl font-bold truncate text-white mb-1">
            {currentTrack.title}
          </h2>
          <p className="text-sm font-medium text-violet-300 truncate">
            {currentTrack.channel?.replace(/ - Topic$/, '') || 'Unknown Artist'}
            {Number(currentTrack.viewCount) > 0 && ` · ${formatCount(currentTrack.viewCount)} views`}
          </p>
        </div>
      </div>
    </div>
  )
}
