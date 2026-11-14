// Vite + Vitest config. Build, chunking and alias rules are described in web/CLAUDE.md.
//
// Dev dependencies (tested together): vite 8.3.5, @vitejs/plugin-react 6.2.1, vitest 5.1.0, jsdom 31.0.0.
// tsconfig.app.json must match the alias: "paths": { "@src/*": ["./src/*"] }.
//
// Build output: every file name is a content hash under assets/, so the server can cache
// /assets/* forever (immutable) while index.html is served with no-cache.

import type { ClientRequest } from 'node:http'
import path from 'node:path'

import react from '@vitejs/plugin-react'
import { type ConfigEnv, loadEnv, type ProxyOptions, type UserConfig } from 'vite'
import { defineConfig } from 'vitest/config'

const DEV_SERVER_PORT: number = 5173
const DEFAULT_API_TARGET: string = 'http://127.0.0.1:8000'

// Each vendor gets its own long-cached chunk, so an app change doesn't re-download them.
// Order matters: the editor and highlighting packages are checked first, and
// '@tabler/icons-react' and '@tanstack/react-query' contain "react", so they are
// checked before the generic React check.
function vendorChunkName(id: string): string | null {
  if (!id.includes('node_modules')) return null
  if (id.includes('lowlight') || id.includes('highlight.js')) return 'vendor-highlight'
  if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('@mantine/tiptap')) return 'vendor-tiptap'
  if (id.includes('@tabler/icons-react')) return 'vendor-icons'
  if (id.includes('@mantine')) return 'vendor-mantine'
  if (id.includes('@tanstack')) return 'vendor-query'
  if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react'
  return null
}

// Proxies a path to the API, so the dev server is same-origin with it: Sanctum's
// cookies and CSRF checks then work exactly as in production.
type TProxyServer = Parameters<NonNullable<ProxyOptions['configure']>>[0]

function apiProxy(target: string): ProxyOptions {
  const origin: string = new URL(target).origin

  return {
    target,
    changeOrigin:        true,
    secure:              true,
    cookieDomainRewrite: { '*': '' },
    configure:           (proxy: TProxyServer): void => {
      proxy.on('proxyReq', (proxyReq: ClientRequest): void => {
        proxyReq.setHeader('Origin', origin)
        proxyReq.setHeader('Referer', `${origin}/`)
      })
    },
  }
}

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const env: Record<string, string> = loadEnv(mode, process.cwd(), '')
  const apiTarget: string = env.VITE_API_URL || DEFAULT_API_TARGET

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@src': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      // The web build is served by Laravel: write straight into its public folder,
      // without emptying it (index.php and Laravel's own files live there).
      outDir:                path.resolve(import.meta.dirname, '../api-laravel/public'),
      emptyOutDir:           false,
      chunkSizeWarningLimit: 600,
      // Vite 8 bundles with Rolldown: `codeSplitting.groups` replaces Rollup's `manualChunks`.
      rolldownOptions:       {
        output: {
          assetFileNames: 'assets/[hash].[ext]',
          chunkFileNames: 'assets/[hash].js',
          entryFileNames: 'assets/[hash].js',
          codeSplitting:  {
            groups: [{ name: vendorChunkName, debugName: 'vendor' }],
          },
        },
      },
    },
    server: {
      port:  DEV_SERVER_PORT,
      proxy: {
        '/api':     apiProxy(apiTarget),
        '/sanctum': apiProxy(apiTarget),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles:  ['./vitest.setup.ts'],
      // Vitest reads web/.env too. Blank every VITE_* variable that changes behaviour,
      // so every test gives the same result on any machine.
      env:         { VITE_API_URL: '' },
    },
  }
})
