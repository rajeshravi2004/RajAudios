import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
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
  
  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const appPath = app.getAppPath()
    let indexPath
    
    const pathsToTry = [
      join(appPath, 'dist', 'index.html'),
      join(__dirname, '..', 'dist', 'index.html'),
      join(__dirname, 'dist', 'index.html'),
      join(process.resourcesPath, 'app', 'dist', 'index.html'),
      join(process.resourcesPath, 'dist', 'index.html')
    ]
    
    for (const path of pathsToTry) {
      if (existsSync(path)) {
        indexPath = path
        console.log('Found index.html at:', path)
        break
      }
    }
    
    if (indexPath) {
      mainWindow.loadFile(indexPath).catch((error) => {
        console.error('Error loading file:', error)
        mainWindow.webContents.openDevTools()
        mainWindow.loadURL('data:text/html,<h1>Error loading application</h1><p>' + error.message + '</p><p>Path: ' + indexPath + '</p>')
      })
    } else {
      console.error('Could not find index.html. Tried paths:', pathsToTry)
      mainWindow.webContents.openDevTools()
      mainWindow.loadURL('data:text/html,<h1>Application files not found</h1><p>App path: ' + appPath + '</p><p>__dirname: ' + __dirname + '</p><p>Please check the console for details.</p>')
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

const getDataPath = () => {
  const userDataPath = app.getPath('userData')
  const dataDir = join(userDataPath, 'rajify-data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  return join(dataDir, 'data.json')
}

ipcMain.handle('get-stored-data', () => {
  try {
    const dataPath = getDataPath()
    if (existsSync(dataPath)) {
      const data = readFileSync(dataPath, 'utf-8')
      return JSON.parse(data)
    }
    return {}
  } catch (error) {
    console.error('Error reading stored data:', error)
    return {}
  }
})

ipcMain.handle('save-stored-data', (event, data) => {
  try {
    const dataPath = getDataPath()
    writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error saving stored data:', error)
    return false
  }
})

