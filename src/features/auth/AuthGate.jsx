import { MusicalNoteIcon, ShieldCheckIcon, SparklesIcon } from '@heroicons/react/24/solid'
import { CloudArrowUpIcon, KeyIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../stores/authStore.jsx'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4L15.4 17c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.4H3A10 10 0 0 0 2 12c0 1.6.4 3.1 1 4.6l3.4-2.7Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.8A9.8 9.8 0 0 0 12 2a10 10 0 0 0-9 5.4l3.4 2.7C7.2 7.8 9.4 6 12 6Z" />
    </svg>
  )
}

export function AuthGate({ children }) {
  const { user, loading, guestMode, authError, isConfigured, signInWithGoogle, continueAsGuest } = useAuth()

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="brand-mark"><MusicalNoteIcon className="h-7 w-7" /></div>
        <div className="auth-loading-line" />
      </div>
    )
  }

  if (user || guestMode) return children

  return (
    <main className="auth-page">
      <div className="auth-aurora auth-aurora-one" />
      <div className="auth-aurora auth-aurora-two" />

      <section className="auth-story">
        <div className="auth-brand">
          <div className="brand-mark"><MusicalNoteIcon className="h-6 w-6" /></div>
          <span>Rajify</span>
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow"><SparklesIcon className="h-4 w-4" /> Your music, thoughtfully organized</span>
          <h1>One place for every sound you come back to.</h1>
          <p>Discover music across languages, build a personal library, and continue listening on any device.</p>
        </div>
        <div className="auth-proof-grid">
          <div><CloudArrowUpIcon /><span><strong>Cloud profile</strong>Keep preferences connected to your account.</span></div>
          <div><ShieldCheckIcon /><span><strong>Private by design</strong>Your personal API key is never stored.</span></div>
          <div><KeyIcon /><span><strong>Quota control</strong>Bring your own key whenever you need it.</span></div>
        </div>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <span className="auth-kicker">Welcome to Rajify</span>
          <h2>Start listening</h2>
          <p className="auth-panel-copy">Sign in to sync your profile and preferences, or explore locally as a guest.</p>

          <button className="google-auth-button" onClick={signInWithGoogle} disabled={!isConfigured}>
            <GoogleMark />
            Continue with Google
          </button>

          {!isConfigured && (
            <p className="auth-config-note">Cloud authentication is being configured. Guest mode is available now.</p>
          )}
          {authError && <p className="auth-error" role="alert">{authError}</p>}

          <div className="auth-divider"><span>or</span></div>
          <button className="guest-auth-button" onClick={continueAsGuest}>Continue as guest</button>
          <p className="auth-terms">Guest data stays in this browser. By continuing, you agree to use YouTube content responsibly.</p>
        </div>
      </section>
    </main>
  )
}
