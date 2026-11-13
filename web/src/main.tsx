import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/spotlight/styles.css'
import '@mantine/tiptap/styles.css'
import '@src/styles/global.scss'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { ErrorBoundary } from 'react-error-boundary'

import { App } from '@src/app'
import { theme } from '@src/styles/theme'
import { RootErrorFallback } from '@src/ui/feedback/root_error_fallback'
import { logCrash } from '@src/utils/log_crash'
import { reloadPageAfterNewRelease } from '@src/utils/reload_after_new_release'

// A lazy chunk 404s after a new release: reload once to fetch the new files.
// Within the guard window the route fallback offers "A new version is available".
window.addEventListener('vite:preloadError', (): void => {
  reloadPageAfterNewRelease()
})

function handleRootError(error: unknown): void {
  logCrash('root', error)
}

const rootElement: HTMLElement | null = document.getElementById('root')
if (rootElement === null) throw new Error('index.html has no #root element')

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={RootErrorFallback} onError={handleRootError}>
      <MantineProvider defaultColorScheme="dark" theme={theme}>
        <ModalsProvider>
          <Notifications position="bottom-center" />
          <App />
        </ModalsProvider>
      </MantineProvider>
    </ErrorBoundary>
  </StrictMode>,
)
