import { BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { validateShareOptions } from './audio-router.js'

const hostPath = fileURLToPath(new URL('./audio-host.html', import.meta.url))
const hostURL = pathToFileURL(hostPath).href
const idle = () => ({ active: false, mono: true, outputs: [], message: '' })

export function installAudioSharing(sourceWindow, isTrustedURL) {
  let host = null
  let loading = null
  let queue = Promise.resolve()
  let captureAllowed = false
  let lastMessage = ''

  const disposeHost = () => {
    captureAllowed = false
    if (host && !host.isDestroyed()) host.destroy()
    host = null
    loading = null
  }

  const ensureHost = async () => {
    if (loading) return loading
    host = new BrowserWindow({
      show: false, width: 320, height: 180, skipTaskbar: true,
      webPreferences: {
        partition: 'rajify-audio-output', sandbox: true, contextIsolation: true,
        nodeIntegration: false, webSecurity: true, backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    })
    const currentHost = host
    const session = host.webContents.session
    session.setPermissionCheckHandler((contents, permission, origin, details) => {
      const trusted = contents === currentHost.webContents && details.isMainFrame
        && currentHost.webContents.getURL() === hostURL
      return trusted && (permission === 'speaker-selection' || permission === 'display-capture'
        || (permission === 'media' && details.mediaType === 'audio'))
    })
    session.setPermissionRequestHandler((contents, permission, callback, details) => {
      // Enumerating outputs does not require opening a microphone or camera.
      callback(contents === currentHost.webContents && currentHost.webContents.getURL() === hostURL
        && (['speaker-selection', 'display-capture'].includes(permission)
          || (captureAllowed && permission === 'media' && details.mediaTypes?.length === 0)))
    })
    session.setDisplayMediaRequestHandler((request, callback) => {
      if (!captureAllowed || request.frame !== currentHost.webContents.mainFrame
        || request.frame.url !== hostURL || !request.audioRequested
        || sourceWindow.isDestroyed() || !isTrustedURL(sourceWindow.webContents.getURL())) {
        callback({})
        return
      }
      captureAllowed = false
      callback({ video: sourceWindow.webContents.mainFrame,
        audio: sourceWindow.webContents.mainFrame, enableLocalEcho: false })
    })
    host.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    host.webContents.on('will-navigate', event => event.preventDefault())
    host.webContents.on('render-process-gone', () => {
      lastMessage = 'Audio sharing stopped unexpectedly. Normal playback has been restored.'
      disposeHost()
    })
    loading = host.loadFile(hostPath).then(() => currentHost)
    try { return await loading } catch (error) { disposeHost(); throw error }
  }

  const invokeHost = async (method, options) => {
    const currentHost = await ensureHost()
    // JSON is passed to JavaScript, never a shell. Only validated options and
    // allowlisted method names cross into the local, sandboxed output window.
    let timer
    try {
      return await Promise.race([
        currentHost.webContents.executeJavaScript(`window.rajifyAudio(${JSON.stringify(method)}, ${JSON.stringify(options ?? null)})`, true),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            disposeHost()
            reject(new Error('Audio sharing timed out. Normal playback has been restored.'))
          }, 15000)
        }),
      ])
    } finally { clearTimeout(timer); captureAllowed = false }
  }

  const actions = {
    devices: () => invokeHost('devices'),
    status: () => host ? invokeHost('status') : { ...idle(), message: lastMessage },
    start: async options => {
      const validated = validateShareOptions(options)
      await ensureHost()
      captureAllowed = true
      lastMessage = ''
      return invokeHost('start', validated)
    },
    update: options => invokeHost('update', validateShareOptions(options)),
    stop: async () => {
      // Destroying the capture window also guarantees that hung/crashed audio
      // contexts release the source tab's local-playback suppression.
      disposeHost()
      lastMessage = ''
      return idle()
    },
    openBluetooth: async () => {
      if (process.platform !== 'win32') throw new Error('Open Bluetooth settings on your device to pair earbuds.')
      await shell.openExternal('ms-settings:bluetooth')
      return true
    },
  }

  for (const [method, action] of Object.entries(actions)) {
    ipcMain.handle(`audio-sharing:${method}`, (event, value) => {
      if (event.sender !== sourceWindow.webContents || event.senderFrame !== sourceWindow.webContents.mainFrame
        || !isTrustedURL(event.senderFrame.url)) throw new Error('Audio sharing is available only inside Rajify.')
      if (process.platform !== 'win32') throw new Error('Shared audio currently requires Rajify for Windows.')
      const operation = queue.then(() => action(value))
      queue = operation.catch(() => {})
      return operation
    })
  }
  const onNavigation = (_event, _url, _inPlace, isMainFrame) => {
    if (isMainFrame) disposeHost()
  }
  sourceWindow.webContents.on('did-start-navigation', onNavigation)
  sourceWindow.webContents.on('render-process-gone', disposeHost)
  sourceWindow.on('closed', () => {
    disposeHost()
    for (const method of Object.keys(actions)) ipcMain.removeHandler(`audio-sharing:${method}`)
  })
}
