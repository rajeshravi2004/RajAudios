import { useState } from 'react'
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
  CircleStackIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  EyeIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  KeyIcon,
  ShieldCheckIcon,
  SpeakerWaveIcon,
  TrashIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { useSettings, LANGUAGES } from '../../stores/settingsStore.jsx'
import { useLibrary } from '../../stores/libraryStore.jsx'
import { useAuth } from '../../stores/authStore.jsx'
import { useToastContext } from '../../components/ui/Toast.jsx'
import { useDialog } from '../../components/ui/Dialog.jsx'
import { cacheStorage } from '../../utils/storage.js'
import {
  clearSessionApiKey,
  setSessionApiKey,
  testYouTubeApiKey,
  useSessionApiKey,
} from '../../services/sessionApiKey.js'

const SectionCard = ({ icon: Icon, title, description, children, tone = 'default' }) => (
  <section className={`settings-card settings-card-${tone}`}>
    <header className="settings-card-header">
      <div className="settings-card-icon"><Icon /></div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
    <div className="settings-card-body">{children}</div>
  </section>
)

const SettingRow = ({ label, description, children }) => (
  <div className="setting-row">
    <div className="setting-copy">
      <span>{label}</span>
      {description && <p>{description}</p>}
    </div>
    <div className="setting-control">{children}</div>
  </div>
)

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`pro-toggle ${value ? 'is-on' : ''}`}
    role="switch"
    aria-checked={value}
  >
    <span />
  </button>
)

const Select = ({ value, onChange, options }) => (
  <select className="pro-select" value={value} onChange={event => onChange(event.target.value)}>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
)

export function SettingsPage() {
  const { settings, updateSettings, resetSettings, cloudStatus } = useSettings()
  const { clearHistory } = useLibrary()
  const { user, profile, isConfigured, signInWithGoogle, signOut } = useAuth()
  const { toast } = useToastContext()
  const { confirm: showConfirm } = useDialog()
  const activeApiKey = useSessionApiKey()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)

  const handleUsePersonalKey = async () => {
    const candidate = apiKeyInput.trim()
    if (!candidate) {
      toast('Enter a YouTube Data API key first.', 'warning')
      return
    }

    setTestingKey(true)
    try {
      const result = await testYouTubeApiKey(candidate)
      if (!result.valid) {
        toast(result.message || 'That API key could not be verified.', 'error')
        return
      }
      setSessionApiKey(candidate)
      setApiKeyInput('')
      setShowApiKey(false)
      await cacheStorage.clear()
      toast('Personal API key is active for this session.', 'success')
    } catch {
      toast('Could not verify the key. Check your connection and try again.', 'error')
    } finally {
      setTestingKey(false)
    }
  }

  const handleRemovePersonalKey = async () => {
    clearSessionApiKey()
    await cacheStorage.clear()
    toast('Personal API key removed from memory.', 'info')
  }

  const handleClearCache = async () => {
    setClearingCache(true)
    await cacheStorage.clear()
    setClearingCache(false)
    toast('Music discovery cache cleared.', 'success')
  }

  const handleResetApp = async () => {
    const confirmed = await showConfirm({
      title: 'Reset local data?',
      message: 'This clears listening history, restores default settings, removes cached discovery data, and forgets the session API key.',
      confirmLabel: 'Reset local data',
      tone: 'danger',
    })
    if (!confirmed) return
    await resetSettings()
    await clearHistory()
    await cacheStorage.clear()
    clearSessionApiKey()
    toast('Local app data has been reset.', 'success')
  }

  const handleClearHistory = async () => {
    const confirmed = await showConfirm({
      title: 'Clear listening history?',
      message: 'Recently played songs and listening signals used for recommendations will be removed.',
      confirmLabel: 'Clear history',
      tone: 'danger',
    })
    if (!confirmed) return
    await clearHistory()
    toast('Listening history cleared.', 'success')
  }

  const syncLabel = {
    synced: 'Preferences synced',
    syncing: 'Syncing preferences',
    error: 'Local preferences only',
    local: 'Stored on this device',
  }[cloudStatus]

  return (
    <div className="page-scroll fade-in">
      <div className="settings-page">
        <header className="settings-hero">
          <div>
            <span className="eyebrow"><Cog6ToothIcon /> Account & preferences</span>
            <h1>Settings</h1>
            <p>Manage your listening experience, cloud profile, privacy, and API access.</p>
          </div>
          <div className={`sync-pill sync-${cloudStatus}`}>
            {user ? <CloudArrowUpIcon /> : <CircleStackIcon />}
            <span>{syncLabel}</span>
          </div>
        </header>

        <div className="settings-grid">
          <SectionCard icon={UserCircleIcon} title="Account" description="Your identity and cloud connection">
            {user ? (
              <div className="account-profile">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="account-avatar-fallback">{profile.name.slice(0, 1).toUpperCase()}</div>
                )}
                <div className="account-identity">
                  <strong>{profile.name}</strong>
                  <span>{profile.email}</span>
                  <small><CheckCircleIcon /> Connected with Google</small>
                </div>
                <button className="secondary-button" onClick={signOut}>
                  <ArrowRightOnRectangleIcon /> Sign out
                </button>
              </div>
            ) : (
              <div className="guest-account">
                <div>
                  <strong>Guest session</strong>
                  <p>Sign in to sync preferences and keep a consistent profile across devices.</p>
                </div>
                <button className="primary-button" onClick={signInWithGoogle} disabled={!isConfigured}>
                  Continue with Google
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard icon={KeyIcon} title="YouTube API access" description="Use your own quota when the shared quota is unavailable">
            <div className="session-key-status">
              <div className={`status-dot ${activeApiKey ? 'is-active' : ''}`} />
              <div>
                <strong>{activeApiKey ? 'Personal key active' : 'Using Rajify shared access'}</strong>
                <p>{activeApiKey ? 'Requests use your key until this tab is refreshed or closed.' : 'Add a key only if shared access reaches its daily limit.'}</p>
              </div>
            </div>

            {!activeApiKey ? (
              <div className="api-key-form">
                <label htmlFor="personal-youtube-key">Personal YouTube Data API key</label>
                <div className="secret-input-wrap">
                  <input
                    id="personal-youtube-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={event => setApiKeyInput(event.target.value)}
                    placeholder="Paste key for this session"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button type="button" onClick={() => setShowApiKey(value => !value)} aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>
                    {showApiKey ? <EyeSlashIcon /> : <EyeIcon />}
                  </button>
                </div>
                <div className="api-key-actions">
                  <p><ShieldCheckIcon /> Kept in memory only. Never saved or synced.</p>
                  <button className="primary-button" onClick={handleUsePersonalKey} disabled={testingKey}>
                    {testingKey ? <ArrowPathIcon className="spin" /> : <KeyIcon />}
                    {testingKey ? 'Verifying' : 'Use for session'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="secondary-button danger-text" onClick={handleRemovePersonalKey}>Remove personal key</button>
            )}
          </SectionCard>

          <SectionCard icon={SpeakerWaveIcon} title="Playback" description="Tune how Rajify behaves while you listen">
            <SettingRow label="Autoplay" description="Continue with similar music when the queue ends">
              <Toggle value={settings.autoplay} onChange={value => updateSettings({ autoplay: value })} />
            </SettingRow>
            <SettingRow label="Default volume" description={`${Math.round(settings.volume * 100)} percent`}>
              <input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={event => updateSettings({ volume: Number(event.target.value) })} className="settings-volume" />
            </SettingRow>
          </SectionCard>

          <SectionCard icon={GlobeAltIcon} title="Discovery" description="Control the language and quality of recommendations">
            <SettingRow label="Music language" description="Primary language for discovery">
              <Select value={settings.language} onChange={value => updateSettings({ language: value })} options={LANGUAGES.map(language => ({ value: language.value, label: language.label }))} />
            </SettingRow>
            <SettingRow label="Content filter" description="Reduce podcasts, reactions, and non-music results">
              <Select
                value={settings.contentFilterStrength}
                onChange={value => updateSettings({ contentFilterStrength: value })}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'light', label: 'Light' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'strict', label: 'Strict' },
                ]}
              />
            </SettingRow>
          </SectionCard>

          <SectionCard icon={ShieldCheckIcon} title="Privacy" description="Choose what is used for your recommendations">
            <SettingRow label="Listening history" description="Remember played tracks on this device">
              <Toggle value={settings.saveHistory} onChange={value => updateSettings({ saveHistory: value })} />
            </SettingRow>
            <SettingRow label="Personalized discovery" description="Use listening signals to improve suggestions">
              <Toggle value={settings.personalizedRecommendations} onChange={value => updateSettings({ personalizedRecommendations: value })} />
            </SettingRow>
            <button className="text-button" onClick={handleClearHistory}>Clear listening history</button>
          </SectionCard>

          <SectionCard icon={CircleStackIcon} title="Data controls" description="Refresh temporary data or reset this installation" tone="danger">
            <div className="data-actions">
              <button className="secondary-button" onClick={handleClearCache} disabled={clearingCache}>
                <ArrowPathIcon className={clearingCache ? 'spin' : ''} />
                {clearingCache ? 'Clearing cache' : 'Clear discovery cache'}
              </button>
              <button className="danger-button" onClick={handleResetApp}>
                <TrashIcon /> Reset local data
              </button>
            </div>
          </SectionCard>
        </div>

        <footer className="settings-footer">
          <span>Rajify 1.0</span>
          <span>Powered by YouTube Data API and Supabase</span>
        </footer>
      </div>
    </div>
  )
}
