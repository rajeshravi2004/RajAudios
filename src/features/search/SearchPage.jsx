/**
 * SearchPage.jsx — Explicit, quota-conscious music search.
 */

import { useEffect, useRef, useState } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/solid'
import { PlaylistCard } from '../../components/TrackCard.jsx'
import { TrackList } from '../../components/TrackList.jsx'
import { SkeletonTrackRow } from '../../components/ui/SkeletonLoader.jsx'
import { ErrorState, EmptyState } from '../../components/ui/ErrorState.jsx'
import { usePlayer } from '../../stores/playerStore.jsx'
import { useSettings } from '../../stores/settingsStore.jsx'
import { searchPlaylists, searchVideos } from '../../services/youtubeService.js'

const MAX_RECENT_SEARCHES = 8
const RECENT_SEARCHES_KEY = 'rajify_recent_searches'

function getRecentSearches() {
  try {
    const data = localStorage.getItem(RECENT_SEARCHES_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

function saveRecentSearch(query) {
  try {
    const existing = getRecentSearches().filter(search => search !== query)
    const updated = [query, ...existing].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    return updated
  } catch { return [] }
}

function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_SEARCHES_KEY) } catch { /* ignore */ }
}

export function SearchPage({ initialQuery = '', onOpenPlaylist }) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [error, setError] = useState(null)
  const [playlistError, setPlaylistError] = useState(null)
  const [recentSearches, setRecentSearches] = useState(getRecentSearches())
  const [activeTab, setActiveTab] = useState('songs')
  const inputRef = useRef(null)
  const requestIdRef = useRef(0)
  const { settings } = useSettings()
  const { playTrack } = usePlayer()

  useEffect(() => { inputRef.current?.focus() }, [])

  const doSearch = async rawQuery => {
    const submitted = rawQuery.trim().replace(/\s+/g, ' ')
    if (!submitted) return
    const requestId = ++requestIdRef.current

    setLoading(true)
    setPlaylistLoading(false)
    setError(null)
    setPlaylistError(null)
    setActiveTab('songs')
    setResults(null)

    try {
      // One search.list call. Playlist search stays lazy until its tab is opened.
      const songResults = await searchVideos({
        q: `${submitted} music`,
        maxResults: 20,
        regionCode: settings.region || 'IN',
      })
      if (requestId !== requestIdRef.current) return

      setResults({ query: submitted, videos: songResults.items || [], playlists: null })
      setError(songResults.error || null)
      setRecentSearches(saveRecentSearch(submitted))
    } catch {
      if (requestId !== requestIdRef.current) return
      setResults({ query: submitted, videos: [], playlists: null })
      setError('Search failed. Check your connection and try again.')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  const openPlaylistResults = async () => {
    setActiveTab('playlists')
    if (!results || playlistLoading) return
    if (results.playlists !== null && !playlistError) return

    const requestId = requestIdRef.current
    const submitted = results.query
    setPlaylistLoading(true)
    setPlaylistError(null)
    try {
      const playlistResults = await searchPlaylists({
        q: `${submitted} music`,
        maxResults: 12,
        regionCode: settings.region || 'IN',
      })
      if (requestId !== requestIdRef.current) return
      setResults(current => current?.query === submitted
        ? { ...current, playlists: playlistResults.items || [] }
        : current)
      setPlaylistError(playlistResults.error || null)
    } catch {
      if (requestId === requestIdRef.current) {
        setResults(current => current?.query === submitted ? { ...current, playlists: [] } : current)
        setPlaylistError('Playlist search failed. Please try again.')
      }
    } finally {
      if (requestId === requestIdRef.current) setPlaylistLoading(false)
    }
  }

  const handleSubmit = event => {
    event.preventDefault()
    doSearch(query)
  }

  const handleRecentClick = recent => {
    setQuery(recent)
    doSearch(recent)
  }

  const handleQueryChange = event => {
    requestIdRef.current += 1
    setQuery(event.target.value)
    setResults(null)
    setError(null)
    setPlaylistError(null)
    setLoading(false)
    setPlaylistLoading(false)
  }

  const clearSearch = () => {
    requestIdRef.current += 1
    setQuery('')
    setResults(null)
    setError(null)
    setPlaylistError(null)
    setLoading(false)
    setPlaylistLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div className="page-scroll fade-in">
      <div className="page-content">
        <form onSubmit={handleSubmit} className="search-submit-form mb-8">
          <div className="search-field-wrap">
            <MagnifyingGlassIcon className="search-field-icon" />
            <input
              ref={inputRef}
              type="search"
              className="search-input"
              placeholder="Search songs or artists..."
              value={query}
              onChange={handleQueryChange}
              aria-label="Search music"
            />
            {query && (
              <button type="button" onClick={clearSearch} className="search-clear-button icon-btn" aria-label="Clear search">
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          <button type="submit" className="primary-button search-submit-button" disabled={!query.trim() || loading}>
            <MagnifyingGlassIcon /> {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && (
          <ErrorState error={error} compact onRetry={() => doSearch(results?.query || query)} className="mb-6" />
        )}

        {loading && (
          <div>
            <div className="flex gap-2 mb-6">
              <div className="skeleton h-9 w-24 rounded-full" />
              <div className="skeleton h-9 w-24 rounded-full" />
            </div>
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, index) => <SkeletonTrackRow key={index} />)}
            </div>
          </div>
        )}

        {!query && !loading && (
          <div>
            {recentSearches.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Recent Searches</h2>
                  <button onClick={() => { clearRecentSearches(); setRecentSearches([]) }} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map(recent => (
                    <button key={recent} onClick={() => handleRecentClick(recent)} className="recent-search-chip">
                      <ClockIcon /> {recent}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<MagnifyingGlassIcon className="h-12 w-12" />}
                title="Search for music"
                subtitle="Type a song or artist, then press Search"
              />
            )}
          </div>
        )}

        {!loading && results && (
          <div>
            <div className="flex gap-2 mb-6">
              <TabButton
                active={activeTab === 'songs'}
                onClick={() => setActiveTab('songs')}
                label={`Songs (${results.videos.length})`}
              />
              <TabButton
                active={activeTab === 'playlists'}
                onClick={openPlaylistResults}
                label={results.playlists === null ? 'Playlists' : `Playlists (${results.playlists.length})`}
              />
            </div>

            {activeTab === 'songs' && (results.videos.length > 0 ? (
              <TrackList
                tracks={results.videos}
                showIndex={false}
                showDuration={true}
                onPlay={(track, index) => playTrack(track, results.videos, index)}
              />
            ) : !error && (
              <EmptyState
                icon={<MagnifyingGlassIcon className="h-12 w-12" />}
                title={`No songs for “${results.query}”`}
                subtitle="Try different keywords or search playlists"
              />
            ))}

            {activeTab === 'playlists' && (
              playlistLoading ? (
                <div className="space-y-1">
                  {Array.from({ length: 6 }).map((_, index) => <SkeletonTrackRow key={index} />)}
                </div>
              ) : playlistError ? (
                <ErrorState error={playlistError} compact onRetry={openPlaylistResults} />
              ) : results.playlists?.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {results.playlists.map((playlist, index) => (
                    <PlaylistCard key={`${playlist.id}-${index}`} playlist={playlist} size="md" onClick={onOpenPlaylist} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<MagnifyingGlassIcon className="h-12 w-12" />}
                  title={`No playlists for “${results.query}”`}
                  subtitle="Try a broader artist, genre, or mood"
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-full text-sm font-medium transition-all"
      style={{
        background: active ? 'var(--accent)' : 'var(--bg-card)',
        color: active ? 'white' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-card)'}`,
      }}
    >
      {label}
    </button>
  )
}
