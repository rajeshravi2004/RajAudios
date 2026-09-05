import { contextBridge, ipcRenderer } from 'electron'

// Expose a minimal, typed API surface to the renderer
// The renderer CANNOT access Node.js or Electron APIs directly
contextBridge.exposeInMainWorld('electronAPI', {
  // ── YouTube API (proxied through main — key never in renderer) ──────────────
  youtube: {
    search: (params) => ipcRenderer.invoke('youtube:search', params),
    getVideos: (params) => ipcRenderer.invoke('youtube:getVideos', params),
    getPlaylistItems: (params) => ipcRenderer.invoke('youtube:getPlaylistItems', params),
    getPlaylists: (params) => ipcRenderer.invoke('youtube:getPlaylists', params),
    searchPlaylists: (params) => ipcRenderer.invoke('youtube:searchPlaylists', params),
    getChannels: (params) => ipcRenderer.invoke('youtube:getChannels', params),
    getTrending: (params) => ipcRenderer.invoke('youtube:getTrending', params),
  },

  // ── Persistent Storage (file-based JSON via main process) ──────────────────
  store: {
    get: () => ipcRenderer.invoke('store:get'),
    set: (data) => ipcRenderer.invoke('store:set', data),
  },

  // ── Legacy handlers (for backward compatibility during migration) ───────────
  getStoredData: () => ipcRenderer.invoke('store:get'),
  saveStoredData: (data) => ipcRenderer.invoke('store:set', data),
})
