/**
 * SettingsPage.jsx — App settings
 */

import { useState } from 'react'
import { Cog6ToothIcon, TrashIcon, ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/solid'
import { useSettings, LANGUAGES } from '../../stores/settingsStore.jsx'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { cacheStorage } from '../../utils/storage.js'

const SECTION = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-lg font-bold mb-4 pb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {title}
    </h2>
    <div className="space-y-4">{children}</div>
  </div>
)

const SETTING_ROW = ({ label, description, children }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {description && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
)

const Toggle = ({ value, onChange, disabled = false }) => (
  <button
    onClick={() => !disabled && onChange(!value)}
    className="relative w-12 h-6 rounded-full transition-all duration-200 focus:outline-none"
    style={{
      background: value ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}
    role="switch"
    aria-checked={value}
    disabled={disabled}
  >
    <div
      className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200"
      style={{ left: value ? 'calc(100% - 22px)' : '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
    />
  </button>
)

const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="px-3 py-1.5 rounded-lg text-sm appearance-none cursor-pointer"
    style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-card)',
      color: 'var(--text-primary)',
      outline: 'none',
    }}
  >
    {options.map(opt => (
      <option key={opt.value} value={opt.value} style={{ background: 'var(--bg-card)' }}>
        {opt.label}
      </option>
    ))}
  </select>
)

export function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const { clearHistory } = useLibrary()
  const [clearingCache, setClearingCache] = useState(false)
  const [cacheClearedMsg, setCacheClearedMsg] = useState('')

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      await cacheStorage.clear()
      setCacheClearedMsg('Cache cleared!')
      setTimeout(() => setCacheClearedMsg(''), 3000)
    } catch (e) {
      console.error('Clear cache error:', e)
    } finally {
      setClearingCache(false)
    }
  }

  const handleResetApp = () => {
    if (confirm('Reset all app data? This will clear your history, cache, and settings.')) {
      resetSettings()
      clearHistory()
      cacheStorage.clear()
    }
  }

  return (
    <div className="page-scroll fade-in">
      <div className="page-content" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-accent)' }}>
            <Cog6ToothIcon className="h-6 w-6" style={{ color: 'var(--accent-bright)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Customize your Rajify experience</p>
          </div>
        </div>

        {/* Playback */}
        <SECTION title="🎵 Playback">
          <SETTING_ROW
            label="Autoplay"
            description="Automatically play similar music when your queue ends"
          >
            <Toggle
              value={settings.autoplay}
              onChange={(v) => updateSettings({ autoplay: v })}
            />
          </SETTING_ROW>
          <SETTING_ROW
            label="Default Volume"
            description={`Current: ${Math.round(settings.volume * 100)}%`}
          >
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.volume}
              onChange={(e) => updateSettings({ volume: parseFloat(e.target.value) })}
              className="w-28"
              style={{
                background: `linear-gradient(to right, var(--accent-bright) ${settings.volume * 100}%, rgba(255,255,255,0.15) ${settings.volume * 100}%)`,
              }}
            />
          </SETTING_ROW>
        </SECTION>

        {/* Content */}
        <SECTION title="🌐 Content">
          <SETTING_ROW
            label="Default Language"
            description="Primary language for music discovery"
          >
            <Select
              value={settings.language}
              onChange={(v) => updateSettings({ language: v })}
              options={LANGUAGES.map(l => ({ value: l.value, label: `${l.flag} ${l.label}` }))}
            />
          </SETTING_ROW>

          <SETTING_ROW
            label="Content Quality Filter"
            description="Filter non-music content from results (reactions, podcasts, etc.)"
          >
            <Select
              value={settings.contentFilterStrength}
              onChange={(v) => updateSettings({ contentFilterStrength: v })}
              options={[
                { value: 'off', label: 'Off — Show everything' },
                { value: 'light', label: 'Light — Minimal filtering' },
                { value: 'moderate', label: 'Moderate (Recommended)' },
                { value: 'strict', label: 'Strict — Music only' },
              ]}
            />
          </SETTING_ROW>
        </SECTION>

        {/* Privacy */}
        <SECTION title="🔒 Privacy">
          <SETTING_ROW
            label="Save Listening History"
            description="Track what you've listened to for better recommendations"
          >
            <Toggle
              value={settings.saveHistory}
              onChange={(v) => updateSettings({ saveHistory: v })}
            />
          </SETTING_ROW>
          <SETTING_ROW
            label="Personalized Recommendations"
            description="Use your history to improve music suggestions"
          >
            <Toggle
              value={settings.personalizedRecommendations}
              onChange={(v) => updateSettings({ personalizedRecommendations: v })}
            />
          </SETTING_ROW>
          <SETTING_ROW label="Clear Listening History" description="Remove all recently played tracks">
            <button
              onClick={() => clearHistory()}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              Clear History
            </button>
          </SETTING_ROW>
        </SECTION>

        {/* Data */}
        <SECTION title="💾 Data">
          <SETTING_ROW
            label="Clear API Cache"
            description={cacheClearedMsg || 'Refreshes all cached music data from YouTube'}
          >
            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-secondary)',
              }}
            >
              <ArrowPathIcon className={`h-4 w-4 ${clearingCache ? 'animate-spin' : ''}`} />
              {clearingCache ? 'Clearing...' : 'Clear Cache'}
            </button>
          </SETTING_ROW>
          <SETTING_ROW
            label="Reset App Data"
            description="Clear all history, settings, and cache. Cannot be undone."
          >
            <button
              onClick={handleResetApp}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
            >
              <TrashIcon className="h-4 w-4" />
              Reset All Data
            </button>
          </SETTING_ROW>
        </SECTION>

        {/* About */}
        <SECTION title="ℹ️ About">
          <div className="p-4 rounded-xl text-sm space-y-2"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Rajify — Music Discovery</p>
            <p>A personalized music discovery application powered by the YouTube Data API v3.</p>
            <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
              <span className="font-medium" style={{ color: 'var(--text-accent)' }}>API Key Security: </span>
              Your YouTube API key is stored securely in the Electron main process 
              and is never exposed in the rendered JavaScript.
            </p>
            <p className="text-xs">
              Content Quality Filter grades results by metadata signals — 
              it does not make any copyright or legal claims about videos.
            </p>
          </div>
        </SECTION>
      </div>
    </div>
  )
}
