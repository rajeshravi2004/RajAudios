/**
 * HomePage.jsx — Music discovery home page
 */

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, LanguageIcon, ChevronDownIcon } from '@heroicons/react/24/solid'
import { TrackCard, PlaylistCard } from '../../components/TrackCard.jsx'
import { SkeletonSection } from '../../components/ui/SkeletonLoader.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { usePlayer } from '../../stores/playerStore.jsx'
import { useSettings, LANGUAGES } from '../../stores/settingsStore.jsx'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { getHomeSections, getContinueListening } from '../../services/discoveryService.js'
import { generateExplanation, buildProfile } from '../../services/recommendationEngine.js'
import { useAuth } from '../../stores/authStore.jsx'

export function HomePage({ onOpenPlaylist }) {
  const [sections, setSections] = useState([])
  const [continueListening, setContinueListening] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const { settings, updateSettings } = useSettings()
  const { playTrack } = usePlayer()
  const { history } = useLibrary()
  const { user, profile: accountProfile } = useAuth()
  const [profile, setProfile] = useState(null)

  const loadHome = useCallback(async (lang = settings.language) => {
    setLoading(true)
    setError(null)

    try {
      const [sectionsData, continueData] = await Promise.all([
        getHomeSections(lang, { strength: settings.contentFilterStrength }),
        getContinueListening(),
      ])

      if (sectionsData.length === 0) {
        setError('No content available. Check your API key or internet connection.')
      } else {
        setSections(sectionsData)
      }
      setContinueListening(continueData)
    } catch (e) {
      setError('Failed to load music. Please check your connection and API key.')
      console.error('HomePage loadHome error:', e)
    } finally {
      setLoading(false)
    }
  }, [settings.language, settings.contentFilterStrength])

  // Build recommendation profile from history
  useEffect(() => {
    if (history.length > 0) {
      setProfile(buildProfile(history))
    }
  }, [history])

  // Reload when language changes
  useEffect(() => {
    loadHome(settings.language)
  }, [settings.language, loadHome])

  const handleLanguageChange = (lang) => {
    updateSettings({ language: lang })
    setShowLangDropdown(false)
  }

  const handlePlayTrack = (track, sectionTracks) => {
    playTrack(track, sectionTracks)
  }

  const handlePlaylistClick = (playlist) => {
    onOpenPlaylist?.(playlist)
  }

  const currentLang = LANGUAGES.find(l => l.value === settings.language)

  return (
    <div className="page-scroll fade-in">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Good {getGreeting()}
              {user ? `, ${accountProfile.name.split(' ')[0]}` : ''}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Discover music personalized for you
            </p>
          </div>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangDropdown(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-secondary)',
              }}
            >
              <LanguageIcon className="h-4 w-4" />
              {currentLang?.flag} {currentLang?.label}
              <ChevronDownIcon className={`h-4 w-4 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showLangDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowLangDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 rounded-xl shadow-xl z-20 overflow-hidden overflow-y-auto max-h-64"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-card)',
                    minWidth: '180px',
                  }}>
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => handleLanguageChange(lang.value)}
                      className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors"
                      style={{
                        color: lang.value === settings.language ? 'var(--text-accent)' : 'var(--text-secondary)',
                        background: lang.value === settings.language ? 'var(--accent-subtle)' : '',
                      }}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                      {lang.value === settings.language && (
                        <span className="ml-auto text-xs" style={{ color: 'var(--accent-bright)' }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Continue Listening */}
        {continueListening.length > 0 && (
          <Section
            id="continue"
            title="▶ Continue Listening"
            subtitle="Pick up where you left off"
            items={continueListening}
            type="tracks"
            onPlayTrack={handlePlayTrack}
            profile={profile}
          />
        )}

        {/* Error state */}
        {error && !loading && (
          <ErrorState
            error={error}
            onRetry={() => loadHome()}
          />
        )}

        {/* Loading */}
        {loading && (
          <>
            <SkeletonSection />
            <SkeletonSection />
            <SkeletonSection />
          </>
        )}

        {/* Content sections */}
        {!loading && !error && sections.map(section => (
          <Section
            key={section.id}
            id={section.id}
            title={section.title}
            subtitle={section.subtitle}
            items={section.items}
            type={section.type}
            context={section.context}
            onPlayTrack={handlePlayTrack}
            onPlaylistClick={handlePlaylistClick}
            profile={profile}
          />
        ))}
      </div>
    </div>
  )
}

function Section({ id, title, subtitle, items, type, context, onPlayTrack, onPlaylistClick, profile }) {
  const scrollRef = useCallback(node => {
    if (node) {
      // Store reference for scroll buttons
      node._sectionId = id
    }
  }, [id])

  if (!items?.length) return null

  const scroll = (dir) => {
    const el = document.getElementById(`section-scroll-${id}`)
    if (el) el.scrollBy({ left: dir * 220, behavior: 'smooth' })
  }

  return (
    <div className="mb-10">
      {/* Section header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={() => scroll(-1)} className="icon-btn" aria-label="Scroll left">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button onClick={() => scroll(1)} className="icon-btn" aria-label="Scroll right">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Horizontal scroll row */}
      <div
        id={`section-scroll-${id}`}
        className="section-row"
      >
        {type === 'tracks' ? (
          items.map((track, i) => (
            <TrackCard
              key={`${id}-${track.id}-${i}`}
              track={track}
              contextTracks={items}
              explanation={profile ? generateExplanation(track, profile, context) : null}
              onPlay={(t) => onPlayTrack(t, items)}
            />
          ))
        ) : (
          items.map((playlist, i) => (
            <PlaylistCard
              key={`${id}-${playlist.id}-${i}`}
              playlist={playlist}
              onClick={onPlaylistClick}
            />
          ))
        )}
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning 🌅'
  if (h < 18) return 'Afternoon ☀️'
  return 'Evening 🌙'
}
