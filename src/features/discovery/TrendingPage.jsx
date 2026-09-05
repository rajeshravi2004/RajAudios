/**
 * TrendingPage.jsx — Trending music page
 */

import { useState, useEffect, useCallback } from 'react'
import { FireIcon } from '@heroicons/react/24/solid'
import { TrackList } from '../../components/TrackList.jsx'
import { SkeletonTrackRow } from '../../components/ui/SkeletonLoader.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { usePlayer } from '../../stores/playerStore.jsx'
import { useSettings } from '../../stores/settingsStore.jsx'
import { getTrendingSections } from '../../services/discoveryService.js'

export function TrendingPage() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const { settings } = useSettings()
  const { playTrack } = usePlayer()

  const loadTrending = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTrendingSections(settings.language)
      if (!data?.length) {
        setError('No trending data available. Check your API key or internet connection.')
      } else {
        setSections(data)
      }
    } catch (e) {
      setError('Failed to load trending music.')
      console.error('TrendingPage error:', e)
    } finally {
      setLoading(false)
    }
  }, [settings.language])

  useEffect(() => {
    loadTrending()
  }, [loadTrending])

  const activeSection = sections[activeTab]

  return (
    <div className="page-scroll fade-in">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}>
            <FireIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Trending</h1>
            <p style={{ color: 'var(--text-muted)' }}>What the world is listening to</p>
          </div>
        </div>

        {/* Error */}
        {error && <ErrorState error={error} onRetry={loadTrending} />}

        {/* Loading */}
        {loading && (
          <div>
            <div className="skeleton h-10 w-full rounded-xl mb-6" />
            {Array.from({ length: 15 }).map((_, i) => <SkeletonTrackRow key={i} />)}
          </div>
        )}

        {/* Tabs */}
        {!loading && !error && sections.length > 0 && (
          <>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
              {sections.map((section, i) => (
                <button
                  key={section.id}
                  onClick={() => setActiveTab(i)}
                  className="px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all"
                  style={{
                    background: activeTab === i ? 'var(--accent)' : 'var(--bg-card)',
                    color: activeTab === i ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${activeTab === i ? 'var(--accent)' : 'var(--border-card)'}`,
                  }}
                >
                  {section.title}
                </button>
              ))}
            </div>

            {activeSection && (
              <div>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  {activeSection.subtitle} · {activeSection.items.length} tracks
                </p>
                <TrackList
                  tracks={activeSection.items}
                  showIndex={true}
                  showDuration={true}
                  showViews={true}
                  onPlay={(track, i) => playTrack(track, activeSection.items, i)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
