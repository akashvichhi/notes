import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/spotlight/styles.css'
import '@mantine/tiptap/styles.css'
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'


import { App } from './App'
import { theme } from './theme'

// Automatically reload the page when a chunk 404s after a new release
window.addEventListener('vite:preloadError', (event) => {
  const lastReload = sessionStorage.getItem('chunk_reload')
  const now = Date.now()

  // Guard against infinite reload loops if offline or server is unreachable
  if (!lastReload || now - Number(lastReload) > 10_000) {
    sessionStorage.setItem('chunk_reload', String(now))
    window.location.reload()
  } else {
    console.error('Failed to preload chunk after reload:', event)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      <ModalsProvider>
        <Notifications position="bottom-center" />
        <App />
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
)
