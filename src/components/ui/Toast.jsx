/**
 * Toast.jsx — Toast notification system
 */

import { createContext, useContext } from 'react'
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useToast } from '../../hooks/useDebounce.js'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const { toasts, addToast, removeToast } = useToast()

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div
        className="fixed bottom-24 right-4 flex flex-col gap-2 z-50 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type} pointer-events-auto`}>
            <ToastIcon type={t.type} />
            <span>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-auto p-0.5 hover:opacity-70 transition"
              aria-label="Dismiss"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastIcon({ type }) {
  const icons = {
    success: <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />,
    error: <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />,
    info: <InformationCircleIcon className="h-4 w-4 flex-shrink-0" />,
    warning: <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />,
  }
  return icons[type] || icons.info
}

export const useToastContext = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastContext must be used within ToastProvider')
  return ctx
}
