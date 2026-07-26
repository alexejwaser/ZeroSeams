// Temporary config for browser-based verification of the renderer only
// (mirrors the renderer section of electron.vite.config.ts). Safe to delete.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal stand-in for the preload bridge so the renderer boots in a plain
// browser: listeners ("on*") return an unsubscribe fn, everything else
// resolves to a cancelled/empty IPC result.
const electronApiStub = `window.electronAPI = new Proxy({}, {
  get: (_t, prop) => (..._args) => {
    if (String(prop).startsWith('on')) return () => {}
    return Promise.resolve({ canceled: true, cancelled: true, files: [], projects: [], data: null })
  }
})`

export default defineConfig({
  root: resolve(import.meta.dirname),
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  plugins: [
    react(),
    {
      name: 'electron-api-stub',
      transformIndexHtml: () => [
        { tag: 'script', children: electronApiStub, injectTo: 'head-prepend' },
      ],
    },
  ],
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  server: { port: 5199, strictPort: true },
})
