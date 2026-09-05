import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── Load .env into process.env ───────────────────────────────────────────────
const loadEnv = () => {
  const possibleEnvPaths = [
    join(process.cwd(), '.env'),
    join(__dirname, '..', '.env'),
    join(__dirname, '.env'),
  ]

  for (const envPath of possibleEnvPaths) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf-8')
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eqIdx = trimmed.indexOf('=')
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim()
            let val = trimmed.slice(eqIdx + 1).trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1)
            }
            if (!process.env[key]) {
              process.env[key] = val
            }
          }
        }
        break
      } catch (e) {
        console.warn('Could not parse .env at:', envPath, e)
      }
    }
  }
}

loadEnv()

// YouTube API key lives in main process (fallback to VITE_ prefix if present)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || ''

let mainWindow

// ─── Window State Persistence ────────────────────────────────────────────────
const getWindowStatePath = () => {
  const userDataPath = app.getPath('userData')
  const dir = join(userDataPath, 'rajify-data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'window-state.json')
}

const loadWindowState = () => {
  try {
    const path = getWindowStatePath()
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'))
    }
  } catch { /* ignore */ }
  return { width: 1400, height: 900, x: undefined, y: undefined, isMaximized: false }
}

const saveWindowState = () => {
  if (!mainWindow) return
  try {
    const bounds = mainWindow.getBounds()
    const state = { ...bounds, isMaximized: mainWindow.isMaximized() }
    writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2))
  } catch { /* ignore */ }
}

// ─── Create Window ────────────────────────────────────────────────────────────
function createWindow() {
  const windowState = loadWindowState()

  mainWindow = new BrowserWindow({
    width: windowState.width || 1400,
    height: windowState.height || 900,
    x: windowState.x,
    y: windowState.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#09090f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      // webSecurity is false to allow YouTube IFrame API to work in Electron file:// context
      // This is a known trade-off for desktop YouTube player apps
      webSecurity: false,
      allowRunningInsecureContent: true,
      sandbox: false
    },
    icon: join(__dirname, '../public/fav.jpg'),
    titleBarStyle: 'default',
    frame: true,
    show: false,
    autoHideMenuBar: true
  })

  Menu.setApplicationMenu(null)
  mainWindow.setMenuBarVisibility(false)

  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // Comment out to hide DevTools in dev: mainWindow.webContents.openDevTools()
  } else {
    const appPath = app.getAppPath()
    const pathsToTry = [
      join(appPath, 'dist', 'index.html'),
      join(__dirname, '..', 'dist', 'index.html'),
      join(__dirname, 'dist', 'index.html'),
      join(process.resourcesPath, 'app', 'dist', 'index.html'),
      join(process.resourcesPath, 'dist', 'index.html')
    ]

    let indexPath
    for (const p of pathsToTry) {
      if (existsSync(p)) { indexPath = p; break }
    }

    if (indexPath) {
      mainWindow.loadFile(indexPath).catch(err => {
        console.error('Error loading file:', err)
      })
    } else {
      console.error('Could not find index.html. Tried:', pathsToTry)
      mainWindow.loadURL(`data:text/html,<h1>App files not found</h1><p>${pathsToTry.join('<br>')}</p>`)
    }
  }

  mainWindow.once('ready-to-show', () => { mainWindow.show() })

  // Save window state on resize/move/close
  mainWindow.on('resize', saveWindowState)
  mainWindow.on('move', saveWindowState)
  mainWindow.on('close', saveWindowState)
  mainWindow.on('closed', () => { mainWindow = null })

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, description) => {
    if (errorCode !== -3) { // -3 is ERR_ABORTED (normal for navigation)
      console.error('Failed to load:', errorCode, description)
    }
  })
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Data Storage IPC ─────────────────────────────────────────────────────────
const getDataPath = () => {
  const userDataPath = app.getPath('userData')
  const dataDir = join(userDataPath, 'rajify-data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  return join(dataDir, 'data.json')
}

ipcMain.handle('store:get', () => {
  try {
    const p = getDataPath()
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'))
    return {}
  } catch (e) {
    console.error('store:get error:', e)
    return {}
  }
})

ipcMain.handle('store:set', (event, data) => {
  try {
    writeFileSync(getDataPath(), JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('store:set error:', e)
    return false
  }
})

// ─── Multi-Key Pool with Automatic Failover ──────────────────────────────────
const rawKeys = process.env.YOUTUBE_API_KEYS || process.env.VITE_YOUTUBE_API_KEYS || process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || ''
const YOUTUBE_API_KEYS = rawKeys
  .split(',')
  .map(k => k.trim().replace(/^["']|["']$/g, ''))
  .filter(Boolean)

let activeKeyIndex = 0
const exhaustedKeys = new Map() // key -> timestamp

const getNextAvailableKey = () => {
  if (YOUTUBE_API_KEYS.length === 0) return null
  const now = Date.now()
  // Reset keys exhausted more than 6 hours ago
  for (const [k, time] of exhaustedKeys.entries()) {
    if (now - time > 6 * 60 * 60 * 1000) exhaustedKeys.delete(k)
  }

  for (let i = 0; i < YOUTUBE_API_KEYS.length; i++) {
    const idx = (activeKeyIndex + i) % YOUTUBE_API_KEYS.length
    const key = YOUTUBE_API_KEYS[idx]
    if (!exhaustedKeys.has(key)) {
      activeKeyIndex = idx
      return key
    }
  }
  // All exhausted, fallback to first key
  return YOUTUBE_API_KEYS[0]
}

const markKeyExhausted = (key) => {
  console.warn(`[Rajify] YouTube API key quota reached for ${key.slice(0, 10)}... Switching to next key.`)
  exhaustedKeys.set(key, Date.now())
  activeKeyIndex = (activeKeyIndex + 1) % Math.max(1, YOUTUBE_API_KEYS.length)
}

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3'

const ytFetch = async (endpoint, params) => {
  if (YOUTUBE_API_KEYS.length === 0) {
    return { error: 'NO_API_KEY', message: 'YouTube API key not configured. Add YOUTUBE_API_KEYS to .env' }
  }

  const maxAttempts = YOUTUBE_API_KEYS.length
  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const currentKey = getNextAvailableKey()
    if (!currentKey) break

    const url = new URL(`${YOUTUBE_BASE}/${endpoint}`)
    url.searchParams.set('key', currentKey)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v)
    }

    try {
      const res = await fetch(url.toString())
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const reason = errBody?.error?.errors?.[0]?.reason
        
        // Quota exhaustion or rate limit -> rotate key and retry
        if (res.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded')) {
          markKeyExhausted(currentKey)
          lastError = { error: 'QUOTA_EXCEEDED', message: 'API key quota reached. Trying backup key...' }
          continue // retry loop with next key!
        }
        
        if (res.status === 400) {
          return { error: 'BAD_REQUEST', message: errBody?.error?.message || 'Invalid API request' }
        }
        return { error: 'API_ERROR', message: `HTTP ${res.status}`, status: res.status }
      }
      return await res.json()
    } catch (e) {
      if (e.message?.includes('fetch')) {
        return { error: 'NETWORK_ERROR', message: 'No internet connection' }
      }
      return { error: 'UNKNOWN', message: e.message }
    }
  }

  return lastError || { error: 'QUOTA_EXCEEDED', message: 'All configured YouTube API keys have reached their quota limits.' }
}

ipcMain.handle('youtube:search', async (event, { q, type, maxResults, pageToken, videoCategoryId, regionCode, order }) => {
  return ytFetch('search', {
    part: 'snippet',
    q,
    type: type || 'video',
    maxResults: maxResults || 20,
    pageToken,
    videoCategoryId, // 10 = Music
    regionCode,
    order: order || 'relevance',
    safeSearch: 'none'
  })
})

ipcMain.handle('youtube:getVideos', async (event, { ids, part }) => {
  return ytFetch('videos', {
    part: part || 'snippet,contentDetails,statistics',
    id: Array.isArray(ids) ? ids.join(',') : ids,
    maxResults: 50
  })
})

ipcMain.handle('youtube:getPlaylistItems', async (event, { playlistId, maxResults, pageToken }) => {
  return ytFetch('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: maxResults || 50,
    pageToken
  })
})

ipcMain.handle('youtube:getPlaylists', async (event, { ids, part }) => {
  return ytFetch('playlists', {
    part: part || 'snippet,contentDetails',
    id: Array.isArray(ids) ? ids.join(',') : ids
  })
})

ipcMain.handle('youtube:searchPlaylists', async (event, { q, maxResults, pageToken, regionCode }) => {
  return ytFetch('search', {
    part: 'snippet',
    q,
    type: 'playlist',
    maxResults: maxResults || 20,
    pageToken,
    regionCode
  })
})

ipcMain.handle('youtube:getChannels', async (event, { ids, part }) => {
  return ytFetch('channels', {
    part: part || 'snippet,statistics',
    id: Array.isArray(ids) ? ids.join(',') : ids
  })
})

ipcMain.handle('youtube:getTrending', async (event, { regionCode, videoCategoryId, maxResults, pageToken }) => {
  return ytFetch('videos', {
    part: 'snippet,contentDetails,statistics',
    chart: 'mostPopular',
    regionCode: regionCode || 'IN',
    videoCategoryId: videoCategoryId || '10', // 10 = Music
    maxResults: maxResults || 50,
    pageToken
  })
})

// Legacy handlers for backward compatibility
ipcMain.handle('get-stored-data', () => ipcMain.emit('store:get'))
ipcMain.handle('save-stored-data', (event, data) => ipcMain.emit('store:set', null, data))
