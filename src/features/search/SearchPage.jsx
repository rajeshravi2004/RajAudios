/**
 * SearchPage.jsx — Modern search experience
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/solid'
import { TrackCard, PlaylistCard } from '../../components/TrackCard.jsx'
import { TrackList } from '../../components/TrackList.jsx'
import { SkeletonCard, SkeletonTrackRow } from '../../components/ui/SkeletonLoader.jsx'
import { ErrorState, EmptyState } from '../../components/ui/ErrorState.jsx'
import { usePlayer } from '../../stores/playerStore.jsx'
import { useSettings } from '../../stores/settingsStore.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { universalSearch } from '../../services/youtubeService.js'

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
    const existing = getRecentSearches().filter(s => s !== query)
    const updated = [query, ...existing].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    return updated
  } catch { return [] }
}

function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_SEARCHES_KEY) } catch { /* ignore */ }
}

export function SearchPage({ initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState(null) // null = no search yet
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recentSearches, setRecentSearches] = useState(getRecentSearches())
  const [activeTab, setActiveTab] = useState('songs')
  const inputRef = useRef(null)
  const debouncedQuery = useDebounce(query, 400)
  const { settings } = useSettings()
  const { playTrack } = usePlayer()
  const abortRef = useRef(null)

  // Auto-focus search input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null)
      setError(null)
      return
    }
    doSearch(debouncedQuery)
  }, [debouncedQuery]) // eslint-disable-line

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) return
    
    // Cancel previous request
    if (abortRef.current) abortRef.current = true
    abortRef.current = false

    setLoading(true)
    setError(null)

    const currentAbort = abortRef.current

    try {
      const data = await universalSearch({ 
        q: q.trim(), 
        maxResults: 20,
        regionCode: settings.region || 'IN',
      })

      // Don't update if a newer request has started
      if (currentAbort !== abortRef.current) return

      if (data.videoError && data.playlistError) {
        setError(data.videoError || data.playlistError)
        setResults(null)
      } else {
        setResults(data)
        // Save to recent searches
        const updated = saveRecentSearch(q.trim())
        setRecentSearches(updated)
        // Default to songs tab if results available
        if (data.videos.length > 0) setActiveTab('songs')
        else if (data.playlists.length > 0) setActiveTab('playlists')
      }
    } catch (e) {
      if (currentAbort !== abortRef.current) return
      setError('Search failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [settings.region])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) doSearch(query.trim())
  }

  const handleRecentClick = (q) => {
    setQuery(q)
  }

  const handleClearRecent = () => {
    clearRecentSearches()
    setRecentSearches([])
  }

  const hasResults = results && (results.videos.length > 0 || results.playlists.length > 0)

  return (
    <div className="page-scroll fade-in">
      <div className="page-content">
        {/* Search bar */}
        <form onSubmit={handleSubmit} className="relative mb-8">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 pointer-events-none"
            style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search songs, artists, playlists..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search music"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults(null); setError(null) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 icon-btn"
              aria-label="Clear search"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </form>

        {/* Error */}
        {error && (
          <ErrorState
            error={error}
            compact
            onRetry={() => doSearch(query)}
            className="mb-6"
          />
        )}

        {/* Loading */}
        {loading && (
          <div>
            <div className="flex gap-2 mb-6">
              {['Songs', 'Playlists'].map(t => (
                <div key={t} className="skeleton h-9 w-24 rounded-full" />
              ))}
            </div>
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonTrackRow key={i} />)}
            </div>
          </div>
        )}

        {/* No query — show recent searches */}
        {!query && !loading && (
          <div>
            {recentSearches.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Recent Searches</h2>
                  <button
                    onClick={handleClearRecent}
                    className="text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleRecentClick(s)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-card)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <ClockIcon className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<MagnifyingGlassIcon className="h-12 w-12" />}
                title="Search for music"
                subtitle="Find songs, artists, and playlists"
              />
            )}
          </div>
        )}

        {/* Results */}
        {!loading && hasResults && (
          <div>
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {results.videos.length > 0 && (
                <TabButton
                  active={activeTab === 'songs'}
                  onClick={() => setActiveTab('songs')}
                  label={`Songs (${results.videos.length})`}
                />
              )}
              {results.playlists.length > 0 && (
                <TabButton
                  active={activeTab === 'playlists'}
                  onClick={() => setActiveTab('playlists')}
                  label={`Playlists (${results.playlists.length})`}
                />
              )}
            </div>

            {/* Songs tab */}
            {activeTab === 'songs' && results.videos.length > 0 && (
              <TrackList
                tracks={results.videos}
                showIndex={false}
                showDuration={true}
                onPlay={(track, i) => playTrack(track, results.videos, i)}
              />
            )}

            {/* Playlists tab */}
            {activeTab === 'playlists' && results.playlists.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {results.playlists.map((playlist, i) => (
                  <PlaylistCard
                    key={`${playlist.id}-${i}`}
                    playlist={playlist}
                    size="md"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {!loading && results && !hasResults && (
          <EmptyState
            icon={<MagnifyingGlassIcon className="h-12 w-12" />}
            title={`No results for "${query}"`}
            subtitle="Try different keywords or check your spelling"
          />
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
