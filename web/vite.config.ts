import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':    path.resolve(import.meta.dirname, './src'),
      '@src': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port:  5173,
    // Same-origin in development, so there is no cross-site cookie at all.
    proxy: {
      '/api':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/sanctum': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
