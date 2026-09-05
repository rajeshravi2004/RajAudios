/**
 * ErrorState.jsx — User-friendly error display
 */

import { ExclamationTriangleIcon, WifiIcon, KeyIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

const ERROR_ICONS = {
  QUOTA_EXCEEDED: <KeyIcon className="h-12 w-12" />,
  NETWORK_ERROR: <WifiIcon className="h-12 w-12" />,
  NO_API_KEY: <KeyIcon className="h-12 w-12" />,
  default: <ExclamationTriangleIcon className="h-12 w-12" />,
}

export function ErrorState({ 
  error,
  errorType,
  onRetry,
  className = '',
  compact = false,
}) {
  const icon = ERROR_ICONS[errorType] || ERROR_ICONS.default
  const message = error || 'Something went wrong.'

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-4 rounded-xl bg-red-950/30 border border-red-900/30 text-red-400 ${className}`}>
        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto text-sm text-red-300 hover:text-red-200 flex items-center gap-1"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`empty-state ${className}`}>
      <div className="text-red-400/50 mb-2">{icon}</div>
      <p className="text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
      {errorType === 'QUOTA_EXCEEDED' && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          YouTube API daily quota exceeded. Music will resume tomorrow.
        </p>
      )}
      {errorType === 'NO_API_KEY' && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Add YOUTUBE_API_KEY to your .env file and restart the app.
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
          style={{ background: 'var(--accent-subtle)', color: 'var(--text-accent)', border: '1px solid var(--border-accent)' }}
        >
          <ArrowPathIcon className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  )
}

/**
 * EmptyState.jsx
 */
export function EmptyState({ icon, title, subtitle, action, className = '' }) {
  return (
    <div className={`empty-state ${className}`}>
      {icon && <div className="mb-2">{icon}</div>}
      <p className="text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>{title}</p>
      {subtitle && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
