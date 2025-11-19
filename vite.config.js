import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isElectron = process.env.ELECTRON === 'true' || 
                   process.env.npm_lifecycle_event?.includes('electron') ||
                   process.env.npm_lifecycle_script?.includes('electron-builder')

export default defineConfig({
  base: './',
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
