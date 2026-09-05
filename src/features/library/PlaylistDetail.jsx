/**
 * PlaylistDetail.jsx — Playlist/album view with full track list
 */

import { useState, useEffect, useCallback } from 'react'
import { PlayIcon, ArrowPathIcon, BookmarkIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'
import { TrackList } from '../../components/TrackList.jsx'
import { SkeletonPlaylistHeader, SkeletonTrackRow } from '../../components/ui/SkeletonLoader.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { usePlayer } from '../../stores/playerStore.jsx'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { getPlaylistTracks, enrichTracks } from '../../services/youtubeService.js'
import { shuffleArray, formatDuration } from '../../utils/formatters.js'
import { useDialog } from '../../components/ui/Dialog.jsx'

export function PlaylistDetail({ playlist, onBack }) {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [imgError, setImgError] = useState(false)
  const { playTrack, shuffle } = usePlayer()
  const { createPlaylist } = useLibrary()
  const { prompt: showPrompt } = useDialog()

  const loadTracks = useCallback(async () => {
    if (!playlist?.id) return
    setLoading(true)
    setError(null)
    try {
      const result = await getPlaylistTracks(playlist.id, 50)
      if (result.error) {
        setError(result.error)
      } else {
        setTracks(result.tracks || [])
      }
    } catch (e) {
      setError('Failed to load playlist tracks.')
      console.error('PlaylistDetail error:', e)
    } finally {
      setLoading(false)
    }
  }, [playlist?.id])

  useEffect(() => {
    loadTracks()
  }, [loadTracks])

  const handlePlayAll = () => {
    if (tracks.length === 0) return
    const list = shuffle ? shuffleArray(tracks) : tracks
    playTrack(list[0], list, 0)
  }

  const handleShufflePlay = () => {
    if (tracks.length === 0) return
    const shuffled = shuffleArray(tracks)
    playTrack(shuffled[0], shuffled, 0)
  }

  const handleSavePlaylist = async () => {
    const name = await showPrompt({
      title: 'Save to your library',
      message: 'Choose a name for this playlist.',
      inputLabel: 'Playlist name',
      defaultValue: playlist.title,
      confirmLabel: 'Save playlist',
      required: true,
    })
    if (!name) return
    await createPlaylist(name, tracks)
  }

  const totalDuration = tracks.reduce((sum, t) => sum + (t.durationSec || 0), 0)

  return (
    <div className="page-scroll fade-in">
      <div className="page-content">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-6 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>

        {loading && (
          <>
            <SkeletonPlaylistHeader />
            {Array.from({ length: 10 }).map((_, i) => <SkeletonTrackRow key={i} />)}
          </>
        )}

        {error && (
          <ErrorState error={error} onRetry={loadTracks} />
        )}

        {!loading && !error && (
          <>
            {/* Playlist header */}
            <div className="flex items-end gap-6 mb-8">
              {/* Thumbnail */}
              <div className="relative flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl"
                style={{ width: 192, height: 192 }}>
                {!imgError && playlist.thumbnail ? (
                  <img
                    src={playlist.thumbnailHigh || playlist.thumbnail}
                    alt={playlist.title}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--accent-muted), var(--bg-elevated))' }}>
                    <span className="text-6xl">📃</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="badge badge-accent mb-3">Playlist</div>
                <h1 className="text-3xl font-bold mb-2 leading-tight">{playlist.title}</h1>
                <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                  {playlist.channel && `By ${playlist.channel} · `}
                  {tracks.length} tracks
                  {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handlePlayAll}
                    disabled={tracks.length === 0}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'var(--accent)', color: 'white', boxShadow: 'var(--shadow-glow)' }}
                  >
                    <PlayIcon className="h-5 w-5" />
                    Play All
                  </button>

                  <button
                    onClick={handleShufflePlay}
                    disabled={tracks.length === 0}
                    className="flex items-center gap-2 px-4 py-3 rounded-full font-medium text-sm transition-all"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-card)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Shuffle
                  </button>

                  <button
                    onClick={handleSavePlaylist}
                    className="flex items-center gap-2 px-4 py-3 rounded-full font-medium text-sm transition-all"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-card)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <BookmarkIcon className="h-4 w-4" />
                    Save
                  </button>
                </div>
              </div>
            </div>

            {/* Track list */}
            {tracks.length > 0 ? (
              <TrackList
                tracks={tracks}
                showIndex={true}
                showDuration={true}
                onPlay={(track, i) => playTrack(track, tracks, i)}
              />
            ) : (
              <div className="empty-state">
                <p>This playlist appears to be empty.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * UserPlaylistDetail — For user-created playlists (with remove track)
 */
export function UserPlaylistDetail({ playlist, onBack }) {
  const { playTrack } = usePlayer()
  const { removeTrackFromPlaylist } = useLibrary()
  const [tracks, setTracks] = useState(playlist.tracks || [])

  // Keep in sync with library & enrich missing metadata
  useEffect(() => {
    const raw = playlist.tracks || []
    setTracks(raw)
    const hasMissing = raw.some(t => !t.title || t.title.startsWith('Track ') || t.channel === 'Unknown Artist' || !t.thumbnail)
    if (hasMissing) {
      enrichTracks(raw).then(enriched => {
        setTracks(enriched)
      })
    }
  }, [playlist.tracks])

  const handleRemove = async (trackId) => {
    await removeTrackFromPlaylist(playlist.id, trackId)
    setTracks(t => t.filter(tr => tr.id !== trackId))
  }

  return (
    <div className="page-scroll fade-in">
      <div className="page-content">
        <button onClick={onBack} className="flex items-center gap-2 mb-6 text-sm"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeftIcon className="h-4 w-4" /> Back
        </button>

        <div className="flex items-end gap-6 mb-8">
          <div className="w-48 h-48 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent-muted), var(--bg-elevated))' }}>
            {tracks[0]?.thumbnail ? (
              <img src={tracks[0].thumbnail} alt={playlist.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl">📃</span>
              </div>
            )}
          </div>
          <div className="flex-1 pb-1">
            <div className="badge badge-accent mb-3">My Playlist</div>
            <h1 className="text-3xl font-bold mb-2">{playlist.title}</h1>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {tracks.length} tracks
            </p>
            <button
              onClick={() => tracks.length > 0 && playTrack(tracks[0], tracks, 0)}
              disabled={tracks.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <PlayIcon className="h-5 w-5" />
              Play All
            </button>
          </div>
        </div>

        {tracks.length > 0 ? (
          <TrackList
            tracks={tracks}
            showIndex={true}
            showDuration={true}
            onPlay={(track, i) => playTrack(track, tracks, i)}
            onRemove={handleRemove}
          />
        ) : (
          <div className="empty-state">
            <p>No tracks in this playlist yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
