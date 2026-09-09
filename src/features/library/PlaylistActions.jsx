import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { useSettings } from '../../stores/settingsStore.jsx'
import { searchVideos } from '../../services/youtubeService.js'

function PlaylistDialog({ title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); previous?.focus?.() }
  }, [])
  return createPortal(<dialog ref={ref} className="playlist-dialog" aria-label={title}
    onCancel={onClose} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose() }}>
    <header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close playlist dialog"><XMarkIcon className="h-5 w-5" /></button></header>
    {children}
  </dialog>, document.body)
}

export function AddToPlaylistButton({ track }) {
  const [open, setOpen] = useState(false)
  return <>
    <button className="icon-btn playlist-add-button" title="Add to playlist" aria-label={`Add ${track.title} to playlist`}
      onClick={event => { event.stopPropagation(); setOpen(true) }}><PlusIcon className="h-4 w-4" /></button>
    {open && <AddToPlaylistDialog track={track} onClose={() => setOpen(false)} />}
  </>
}

function AddToPlaylistDialog({ track, onClose }) {
  const { playlists, createPlaylist, addTrackToPlaylist } = useLibrary()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async action => {
    setBusy(true); setError('')
    try { await action(); onClose() } catch { setError('Could not save this song. Try again.'); setBusy(false) }
  }
  return <PlaylistDialog title="Add to playlist" onClose={onClose}>
    <p>{track.title}</p>
    <div className="playlist-picker-results">
      {playlists.map(playlist => {
        const added = playlist.tracks.some(item => item.id === track.id)
        return <button className="playlist-picker-row" key={playlist.id} disabled={busy || added}
          onClick={() => save(() => addTrackToPlaylist(playlist.id, track))}>
          <span>{playlist.title}<small>{playlist.tracks.length} songs</small></span>
          {added ? <span>Added</span> : <PlusIcon className="h-5 w-5" />}
        </button>
      })}
      {!playlists.length && <p>Create your first playlist below.</p>}
    </div>
    <form onSubmit={event => { event.preventDefault(); if (name.trim()) save(() => createPlaylist(name.trim(), [track])) }}>
      <label className="dialog-field">New playlist name<input value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder="Name your playlist" /></label>
      <button className="btn-primary" disabled={busy || !name.trim()} type="submit">Create playlist & add song</button>
    </form>
    {error && <p role="alert">{error}</p>}
  </PlaylistDialog>
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
    setBusy(true); setError('')
    try {
      const result = await searchVideos({ q: query.trim(), regionCode: settings.region })
      if (generation.current !== id) return
      if (result.error) throw new Error(result.error)
      setResults(result.items)
    } catch (error) { if (generation.current === id) setError(error.message) }
    finally { if (generation.current === id) setBusy(false) }
  }
  return <PlaylistDialog title={`Add songs to ${playlist.title}`} onClose={onClose}>
    <form className="playlist-search-form" onSubmit={search}>
      <label className="dialog-field">Search songs<input value={query} onChange={event => {
        generation.current++; setBusy(false); setQuery(event.target.value); setResults(null); setError('')
      }} placeholder="Song or artist" /></label>
      <button className="btn-primary" disabled={busy || !query.trim()}>Search</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <p>{busy ? 'Searching...' : results ? 'Search results' : 'From your likes and listening history'}</p>
    <div className="playlist-picker-results" aria-busy={busy}>
      {(results ?? suggestions).map(track => {
        const added = playlist.tracks.some(item => item.id === track.id)
        return <div className="playlist-picker-row" key={track.id}>
          <span>{track.title}<small>{track.channel}</small></span>
          <button className="btn-secondary" disabled={added || adding !== null} aria-label={added ? `${track.title} added` : `Add ${track.title}`}
            onClick={async () => { setAdding(track.id); try { await addTrackToPlaylist(playlist.id, track) } catch { setError('Could not add this song. Try again.') } finally { setAdding(null) } }}>
            {added ? <><CheckIcon className="h-4 w-4" /> Added</> : <><PlusIcon className="h-4 w-4" /> Add</>}
          </button>
        </div>
      })}
      {!(results ?? suggestions).length && !busy && <p>{results ? 'No matching songs. Try another search.' : 'Search for songs to add to this playlist.'}</p>}
    </div>
    <button className="btn-primary" onClick={onClose}>Done</button>
  </PlaylistDialog>
}
