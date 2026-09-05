/**
 * useYouTubePlayer.js — YouTube IFrame API lifecycle hook
 * 
 * Initializes the YouTube player and wires up events to the player store.
 * The player div must have id="yt-player" and be present in the DOM.
 */

import { useEffect, useRef } from 'react'
import { usePlayer } from '../stores/playerStore.jsx'
import { useSettings } from '../stores/settingsStore.jsx'

export function useYouTubePlayer() {
  const { playerRef, handleTrackEnd, setPlaying, trackLoaded, setError, volume } = usePlayer()
  const { settings } = useSettings()
  const apiReadyRef = useRef(false)
  const initAttempts = useRef(0)

  useEffect(() => {
    const loadAPI = () => {
      // Already loaded
      if (window.YT?.Player) {
        initPlayer()
        return
      }

      // Script already injected but not ready
      if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        window.onYouTubeIframeAPIReady = initPlayer
        return
      }

      // Inject script
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        console.error('[Rajify] Failed to load YouTube IFrame API')
      }
      document.head.appendChild(script)
      window.onYouTubeIframeAPIReady = initPlayer
    }

    const initPlayer = () => {
      if (apiReadyRef.current) return

      const el = document.getElementById('yt-player')
      if (!el) {
        initAttempts.current++
        if (initAttempts.current < 20) {
          setTimeout(initPlayer, 150)
        }
        return
      }

      if (!window.YT?.Player) {
        initAttempts.current++
        if (initAttempts.current < 20) {
          setTimeout(initPlayer, 150)
        }
        return
      }

      try {
        let origin = window.location.origin
        if (!origin || origin === 'null' || origin.includes('file://')) {
          origin = 'http://localhost'
        }

        playerRef.current = new window.YT.Player('yt-player', {
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            playsinline: 1,
            origin,
            modestbranding: 1,
            rel: 0,
            fs: 1,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event) => {
              apiReadyRef.current = true
              event.target.setVolume(settings.volume * 100)
              console.log('[Rajify] YouTube player ready')
            },
            onStateChange: (event) => {
              const { PlayerState } = window.YT
              switch (event.data) {
                case PlayerState.PLAYING:
                  setPlaying(true)
                  trackLoaded()
                  break
                case PlayerState.PAUSED:
                  setPlaying(false)
                  break
                case PlayerState.ENDED:
                  setPlaying(false)
                  handleTrackEnd()
                  break
                case PlayerState.BUFFERING:
                  // Still show as playing if we were playing
                  break
                case -1: // unstarted
                  break
              }
            },
            onError: (event) => {
              const errorMessages = {
                2: 'Invalid video ID.',
                5: 'This video cannot be played in this browser.',
                100: 'Video not found or has been removed.',
                101: 'Video playback not allowed. Trying next track...',
                150: 'Video playback not allowed. Trying next track...',
              }
              const msg = errorMessages[event.data] || `Playback error (${event.data}).`
              console.warn('[Rajify] YouTube player error:', event.data, msg)
              
              // For 101/150, try playing next automatically
              if (event.data === 101 || event.data === 150) {
                setError('This video cannot be played outside YouTube. Trying the next track...')
                handleTrackEnd()
              } else {
                setError(msg)
              }
            },
          },
        })
      } catch (e) {
        console.error('[Rajify] Failed to initialize YouTube player:', e)
        initAttempts.current++
        if (initAttempts.current < 5) setTimeout(initPlayer, 1000)
      }
    }

    loadAPI()

    return () => {
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
        playerRef.current = null
        apiReadyRef.current = false
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume changes to player
  useEffect(() => {
    if (playerRef.current?.setVolume) {
      try { playerRef.current.setVolume(volume * 100) } catch { /* ignore */ }
    }
  }, [volume, playerRef])
}
