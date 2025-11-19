import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getStoredData: () => ipcRenderer.invoke('get-stored-data'),
  saveStoredData: (data) => ipcRenderer.invoke('save-stored-data', data)
})

