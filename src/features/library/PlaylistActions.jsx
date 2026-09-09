import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckIcon,
  MagnifyingGlassIcon,
  MusicalNoteIcon,
  PlusIcon,
  QueueListIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { useSettings } from '../../stores/settingsStore.jsx'
import { searchVideos } from '../../services/youtubeService.js'

function PlaylistDialog({ title, subtitle, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); previous?.focus?.() }
  }, [])

  return createPortal(
    <dialog
      ref={ref}
      className="playlist-dialog"
      aria-label={title}
      onCancel={onClose}
      onClick={event => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <header className="playlist-dialog-header">
        <span className="playlist-dialog-icon" aria-hidden="true"><QueueListIcon /></span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-btn playlist-dialog-close" onClick={onClose} aria-label="Close playlist dialog">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </header>
      <div className="playlist-dialog-body">{children}</div>
    </dialog>,
    document.body,
  )
}

function PlaylistArtwork({ playlist }) {
  const artwork = playlist.thumbnail || playlist.tracks?.[0]?.thumbnail
  return artwork
    ? <img className="playlist-picker-artwork" src={artwork} alt="" />
    : <span className="playlist-picker-artwork playlist-picker-artwork-fallback"><MusicalNoteIcon /></span>
}

function TrackPreview({ track }) {
  return (
    <div className="playlist-track-preview">
      {track.thumbnail
        ? <img src={track.thumbnail} alt="" />
        : <span><MusicalNoteIcon /></span>}
      <div>
        <strong>{track.title}</strong>
        <small>{track.channel || 'Selected song'}</small>
      </div>
    </div>
  )
}

export function AddToPlaylistButton({ track }) {
  const [open, setOpen] = useState(false)
  return <>
    <button
      className="icon-btn playlist-add-button"
      title="Add to playlist"
      aria-label={`Add ${track.title} to playlist`}
      onClick={event => { event.stopPropagation(); setOpen(true) }}
    >
      <PlusIcon className="h-4 w-4" />
    </button>
    {open && <AddToPlaylistDialog track={track} onClose={() => setOpen(false)} />}
  </>
}

function AddToPlaylistDialog({ track, onClose }) {
  const { playlists, createPlaylist, addTrackToPlaylist } = useLibrary()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async action => {
    setBusy(true)
    setError('')
    try { await action(); onClose() } catch { setError('Could not save this song. Try again.'); setBusy(false) }
  }

  return (
    <PlaylistDialog title="Add to playlist" subtitle="Choose where this song belongs." onClose={onClose}>
      <TrackPreview track={track} />

      <section className="playlist-picker-section" aria-labelledby="playlist-destinations-title">
        <div className="playlist-section-heading">
          <h3 id="playlist-destinations-title">Your playlists</h3>
          {playlists.length > 0 && <span>{playlists.length}</span>}
        </div>
        <div className="playlist-picker-results">
          {playlists.map(playlist => {
            const added = playlist.tracks.some(item => item.id === track.id)
            return (
              <button
                className={`playlist-picker-row${added ? ' is-added' : ''}`}
                key={playlist.id}
                disabled={busy || added}
                onClick={() => save(() => addTrackToPlaylist(playlist.id, track))}
              >
                <PlaylistArtwork playlist={playlist} />
                <span className="playlist-picker-copy">
                  <strong>{playlist.title}</strong>
                  <small>{playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}</small>
                </span>
                <span className="playlist-picker-status">
                  {added ? <><CheckIcon /> <span>Added</span></> : <PlusIcon />}
                </span>
              </button>
            )
          })}
          {!playlists.length && (
            <div className="playlist-picker-empty">
              <QueueListIcon />
              <div><strong>No playlists yet</strong><small>Create your first one below.</small></div>
            </div>
          )}
        </div>
      </section>

      <div className="playlist-create-divider"><span>or create a new playlist</span></div>
      <form className="playlist-create-form" onSubmit={event => {
        event.preventDefault()
        if (name.trim()) save(() => createPlaylist(name.trim(), [track]))
      }}>
        <label className="dialog-field">
          <span>New playlist name</span>
          <input
            value={name}
            maxLength={100}
            onChange={event => setName(event.target.value)}
            placeholder="e.g. Late night drives"
            autoComplete="off"
          />
        </label>
        <button className="primary-button" disabled={busy || !name.trim()} type="submit">
          <PlusIcon /> {busy ? 'Saving…' : 'Create playlist & add song'}
        </button>
      </form>
      {error && <p className="playlist-dialog-error" role="alert">{error}</p>}
    </PlaylistDialog>
  )
}

export function PlaylistSongPicker({ playlist, onClose }) {
  const { favorites, history, addTrackToPlaylist } = useLibrary()
  const { settings } = useSettings()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(null)
  const [error, setError] = useState('')
  const generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  const suggestions = [...new Map([...favorites, ...history].filter(t => !t.isPlaylist).map(t => [t.id, t])).values()]
  const search = async event => {
    event.preventDefault()
    if (!query.trim()) return
    const id = ++generation.current
    setBusy(true)
    setError('')
    try {
      const result = await searchVideos({ q: query.trim(), regionCode: settings.region })
      if (generation.current !== id) return
      if (result.error) throw new Error(result.error)
      setResults(result.items)
    } catch (searchError) {
      if (generation.current === id) setError(searchError.message)
    } finally {
      if (generation.current === id) setBusy(false)
    }
  }
  const visibleTracks = results ?? suggestions

  return (
    <PlaylistDialog title={`Add songs to ${playlist.title}`} subtitle="Build it one great track at a time." onClose={onClose}>
      <form className="playlist-search-form" onSubmit={search}>
        <label className="dialog-field">
          <span>Search songs</span>
          <span className="playlist-search-input">
            <MagnifyingGlassIcon />
            <input value={query} onChange={event => {
              generation.current++
              setBusy(false)
              setQuery(event.target.value)
              setResults(null)
              setError('')
            }} placeholder="Song or artist" />
          </span>
        </label>
        <button className="primary-button" disabled={busy || !query.trim()}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      {error && <p className="playlist-dialog-error" role="alert">{error}</p>}

      <section className="playlist-picker-section">
        <div className="playlist-section-heading">
          <h3>{results ? 'Search results' : 'Recently enjoyed'}</h3>
          {visibleTracks.length > 0 && <span>{visibleTracks.length}</span>}
        </div>
        <div className="playlist-picker-results playlist-song-results" aria-busy={busy}>
          {visibleTracks.map(track => {
            const added = playlist.tracks.some(item => item.id === track.id)
            return (
              <div className="playlist-picker-row" key={track.id}>
                {track.thumbnail
                  ? <img className="playlist-picker-artwork" src={track.thumbnail} alt="" />
                  : <span className="playlist-picker-artwork playlist-picker-artwork-fallback"><MusicalNoteIcon /></span>}
                <span className="playlist-picker-copy"><strong>{track.title}</strong><small>{track.channel}</small></span>
                <button
                  className={`secondary-button playlist-result-add${added ? ' is-added' : ''}`}
                  disabled={added || adding !== null}
                  aria-label={added ? `${track.title} added` : `Add ${track.title}`}
                  onClick={async () => {
                    setAdding(track.id)
                    try { await addTrackToPlaylist(playlist.id, track) } catch { setError('Could not add this song. Try again.') } finally { setAdding(null) }
                  }}
                >
                  {added ? <><CheckIcon /> Added</> : <><PlusIcon /> Add</>}
                </button>
              </div>
            )
          })}
          {!visibleTracks.length && !busy && (
            <div className="playlist-picker-empty">
              <MagnifyingGlassIcon />
              <div>
                <strong>{results ? 'No songs found' : 'Find the right song'}</strong>
                <small>{results ? 'Try another song or artist.' : 'Search above to add music.'}</small>
              </div>
            </div>
          )}
        </div>
      </section>
      <div className="playlist-dialog-footer">
        <button className="primary-button" onClick={onClose}>Done</button>
      </div>
    </PlaylistDialog>
  )
}
