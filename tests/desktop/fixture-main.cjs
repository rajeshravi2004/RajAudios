const { app, BrowserWindow } = require('electron')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

app.whenReady().then(async () => {
  const { installAudioSharing } = await import('../../electron/audio-sharing.js')
  const player = join(__dirname, 'fixture-player.html')
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: false,
      autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false,
      preload: join(__dirname, '../../electron/preload.mjs'),
    },
  })
  installAudioSharing(window, url => url === pathToFileURL(player).href)
  await window.loadFile(player)
})
app.on('window-all-closed', () => app.quit())
