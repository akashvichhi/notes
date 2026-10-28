import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'http://127.0.0.1:8000'
  const targetOrigin = new URL(apiTarget).origin

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '@src': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      // Output directly to Laravel's public folder
      outDir: path.resolve(import.meta.dirname, '../api/public'),
      emptyOutDir: false, // Prevents deleting index.php and Laravel assets
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[hash].[ext]',
          chunkFileNames: 'assets/[hash].js',
          entryFileNames: 'assets/[hash].js',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lowlight') || id.includes('highlight.js')) {
                return 'vendor-highlight'
              }
              if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('@mantine/tiptap')) {
                return 'vendor-tiptap'
              }
              if (id.includes('@tabler/icons-react')) {
                return 'vendor-icons'
              }
              if (id.includes('@mantine')) {
                return 'vendor-mantine'
              }
              if (id.includes('@tanstack')) {
                return 'vendor-query'
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-react'
              }
            }
          },
        },
      },
    },
    clearScreen: false,
    server: {
      port: 5173,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
      // Proxy API and Sanctum requests to avoid cross-origin cookie and CORS issues in local development.
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: {
            '*': '',
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Origin', targetOrigin)
              proxyReq.setHeader('Referer', `${targetOrigin}/`)
            })
          },
        },
        '/sanctum': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: {
            '*': '',
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Origin', targetOrigin)
              proxyReq.setHeader('Referer', `${targetOrigin}/`)
            })
          },
        },
      },
    },
  }
})
