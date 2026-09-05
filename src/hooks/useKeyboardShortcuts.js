/**
 * useKeyboardShortcuts.js — Global keyboard shortcuts for the player
 * 
 * Only fires when focus is NOT in a text input/textarea to avoid conflicts.
 */

import { useEffect } from 'react'
import { usePlayer } from '../stores/playerStore.jsx'

const isInputFocused = () => {
  const el = document.activeElement
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export function useKeyboardShortcuts() {
  const { togglePlayPause, playNext, playPrevious, toggleShuffle, toggleRepeat, setVolume, volume, currentTrack } = usePlayer()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isInputFocused()) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (currentTrack) togglePlayPause()
          break
        case 'ArrowRight':
          if (e.shiftKey) {
            e.preventDefault()
            playNext()
          }
          break
        case 'ArrowLeft':
          if (e.shiftKey) {
            e.preventDefault()
            playPrevious()
          }
          break
        case 'n':
        case 'N':
          playNext()
          break
        case 'p':
        case 'P':
          playPrevious()
          break
        case 'm':
        case 'M':
          e.preventDefault()
          setVolume(volume > 0 ? 0 : 0.8)
          break
        case 's':
        case 'S':
          if (e.ctrlKey || e.metaKey) break // don't intercept Ctrl+S
          toggleShuffle()
          break
        case 'r':
        case 'R':
          if (e.ctrlKey || e.metaKey) break
          toggleRepeat()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTrack, togglePlayPause, playNext, playPrevious, toggleShuffle, toggleRepeat, setVolume, volume])
}
