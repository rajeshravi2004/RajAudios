import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useToastContext } from '../components/ui/Toast.jsx'
import { createBrowserAudioSharing } from '../utils/browserAudioSharing.js'

const AudioSharingContext = createContext(null)
const cleanError = error => (error?.message || 'Audio sharing is unavailable.').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export function AudioSharingProvider({ children }) {
  const [api] = useState(() => window.electronAPI?.audioSharing || createBrowserAudioSharing())
  const supported = Boolean(api?.supported)
  const { toast } = useToastContext()
  const [devices, setDevices] = useState([])
  const [outputs, setOutputs] = useState([])
  const [mono, setMono] = useState(true)
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef(0)
  const locked = useRef(false)

  const stop = useCallback(async () => {
    if (!supported) return
    const ticket = ++operation.current
    locked.current = true
    setBusy(true)
    try {
      await api.stop()
      if (ticket === operation.current) { setActive(false); setError('') }
    } catch (error) {
      if (ticket === operation.current) setError(cleanError(error))
    } finally {
      if (ticket === operation.current) { locked.current = false; setBusy(false); setStarting(false) }
    }
  }, [api, supported])

  const refresh = async () => {
    if (!supported || locked.current) return
    locked.current = true
    setBusy(true)
    try {
      const list = await api.devices()
      setDevices(list)
      setScanned(true)
      if (!active) setOutputs(previous => previous.filter(output => list.some(device => device.deviceId === output.deviceId)))
      setError('')
    } catch (error) {
      setError(error.name === 'NotAllowedError'
        ? 'Audio-device access was cancelled or blocked. Allow access in your browser site settings, then refresh devices.'
        : error.name === 'NotFoundError' ? 'No audio devices were found. Connect your earbuds and try again.' : cleanError(error))
    }
    finally { locked.current = false; setBusy(false) }
  }

  const start = async () => {
    if (!supported || locked.current || !outputs.length) return
    const ticket = ++operation.current
    locked.current = true
    setBusy(true)
    setStarting(true)
    setError('')
    try {
      const result = await api.start({ mono, outputs })
      if (ticket === operation.current) {
        setActive(result.active)
        if (!result.active) setError(result.message || 'Sharing could not start.')
      }
    } catch (error) {
      if (ticket === operation.current) { setActive(false); setError(cleanError(error)) }
    } finally {
      if (ticket === operation.current) { locked.current = false; setBusy(false); setStarting(false) }
    }
  }

  useEffect(() => {
    if (!supported || !active) return
    const ticket = operation.current
    const timer = setTimeout(() => {
      api.update({ mono, outputs }).catch(async error => {
        if (ticket !== operation.current) return
        const message = cleanError(error)
        await stop()
        setError(message)
        toast(message, 'error')
      })
    }, 150)
    return () => clearTimeout(timer)
  }, [api, supported, active, mono, outputs, stop, toast])

  useEffect(() => {
    if (!supported || !active) return
    let cancelled = false
    let timer
    const poll = async () => {
      const ticket = operation.current
      try {
        const status = await api.status()
        if (cancelled || ticket !== operation.current) return
        if (!status.active) {
          setActive(false)
          const message = status.message || 'Sharing stopped. Normal playback has been restored.'
          setError(message)
          toast(message, 'warning')
          return
        }
      } catch (error) {
        if (cancelled || ticket !== operation.current) return
        await stop()
        setError(cleanError(error))
      }
      if (!cancelled) timer = setTimeout(poll, 1500)
    }
    timer = setTimeout(poll, 1500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [api, supported, active, stop, toast])

  useEffect(() => () => {
    operation.current++
    if (supported) void api.stop().catch(() => {})
  }, [api, supported])

  const selectDevice = deviceId => {
    if (active || busy) return
    setOutputs(previous => previous.some(output => output.deviceId === deviceId)
      ? previous.filter(output => output.deviceId !== deviceId)
      : previous.length < 8 ? [...previous, { deviceId, volume: 0.8, delayMs: 0 }] : previous)
  }
  const adjustOutput = (deviceId, updates) => setOutputs(previous => previous.map(output =>
    output.deviceId === deviceId ? { ...output, ...updates } : output))

  const openBluetooth = async () => {
    if (!api.openBluetooth) return
    try { await api.openBluetooth() } catch (error) { setError(cleanError(error)) }
  }

  return <AudioSharingContext.Provider value={{ supported, browser: Boolean(api.browser), devices, outputs, mono, setMono,
    active, busy, starting, scanned, error, refresh, start, stop, selectDevice, adjustOutput, openBluetooth }}>
    {children}
  </AudioSharingContext.Provider>
}

export function useAudioSharing() {
  const context = useContext(AudioSharingContext)
  if (!context) throw new Error('useAudioSharing must be inside AudioSharingProvider')
  return context
}
