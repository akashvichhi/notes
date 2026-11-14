import { RouterProvider } from 'react-router'

import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'

import { MESSAGES } from '@src/constants/messages'
import { useGlobalErrorListener } from '@src/hooks/use_global_error_listener'
import { queryClient } from '@src/queries/query_client'
import { router } from '@src/routes/app_routes'
import { ErrorFallback } from '@src/ui/feedback/error_fallback'
import { logCrash } from '@src/utils/log_crash'

function reloadPage(): void {
  window.location.reload()
}

function renderAppFallback(_props: FallbackProps): React.JSX.Element {
  return <ErrorFallback fullPage actionLabel={MESSAGES.RELOAD_ACTION} message={MESSAGES.CRASH_APP} title={MESSAGES.CRASH_TITLE} onAction={reloadPage} />
}

function handleAppError(error: unknown): void {
  logCrash('app', error)
}

export function App(): React.JSX.Element {
  useGlobalErrorListener()

  return (
    <ErrorBoundary fallbackRender={renderAppFallback} onError={handleAppError}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
