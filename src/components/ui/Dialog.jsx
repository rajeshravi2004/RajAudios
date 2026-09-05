import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'

const DialogContext = createContext(null)

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)

  const openDialog = useCallback((options) => new Promise(resolve => {
    // Resolve an already-open dialog as cancelled before showing the next one.
    resolverRef.current?.(null)
    resolverRef.current = resolve
    setDialog({ id: Date.now(), ...options })
  }), [])

  const closeDialog = useCallback((value = null) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setDialog(null)
    resolve?.(value)
  }, [])

  const confirm = useCallback((options) => openDialog({
    type: 'confirm',
    ...(typeof options === 'string' ? { message: options } : options),
  }).then(Boolean), [openDialog])

  const prompt = useCallback((options) => openDialog({
    type: 'prompt',
    ...(typeof options === 'string' ? { title: options } : options),
  }), [openDialog])

  useEffect(() => () => resolverRef.current?.(null), [])

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialog && <AppDialog key={dialog.id} dialog={dialog} onClose={closeDialog} />}
    </DialogContext.Provider>
  )
}

function AppDialog({ dialog, onClose }) {
  const [value, setValue] = useState(dialog.defaultValue || '')
  const inputRef = useRef(null)
  const confirmRef = useRef(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const focusTimer = window.setTimeout(() => {
      if (dialog.type === 'prompt') inputRef.current?.focus()
      else confirmRef.current?.focus()
    }, 0)

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose(null)
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [dialog.type, onClose])

  const isPrompt = dialog.type === 'prompt'
  const canSubmit = !isPrompt || !dialog.required || value.trim().length > 0

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!canSubmit) return
    onClose(isPrompt ? value.trim() : true)
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose(null)}
    >
      <section
        className={`app-dialog ${dialog.tone === 'danger' ? 'app-dialog-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby={dialog.message ? 'app-dialog-message' : undefined}
      >
        <button className="dialog-close icon-btn" onClick={() => onClose(null)} aria-label="Close dialog">
          <XMarkIcon />
        </button>

        {dialog.tone === 'danger' && (
          <div className="dialog-icon"><ExclamationTriangleIcon /></div>
        )}

        <h2 id="app-dialog-title">{dialog.title || (isPrompt ? 'Enter a name' : 'Are you sure?')}</h2>
        {dialog.message && <p id="app-dialog-message">{dialog.message}</p>}

        <form onSubmit={handleSubmit}>
          {isPrompt && (
            <label className="dialog-field">
              <span>{dialog.inputLabel || 'Name'}</span>
              <input
                ref={inputRef}
                value={value}
                onChange={event => setValue(event.target.value)}
                placeholder={dialog.placeholder}
                maxLength={dialog.maxLength || 100}
                required={dialog.required}
                autoComplete="off"
              />
            </label>
          )}

          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={() => onClose(null)}>
              {dialog.cancelLabel || 'Cancel'}
            </button>
            <button
              ref={confirmRef}
              type="submit"
              className={dialog.tone === 'danger' ? 'danger-button' : 'primary-button'}
              disabled={!canSubmit}
            >
              {dialog.confirmLabel || (isPrompt ? 'Save' : 'Confirm')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export const useDialog = () => {
  const context = useContext(DialogContext)
  if (!context) throw new Error('useDialog must be used within DialogProvider')
  return context
}
