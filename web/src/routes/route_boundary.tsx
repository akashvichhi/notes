import { type ReactNode, Suspense } from 'react'
import { useLocation } from 'react-router'

import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'

import { isChunkLoadError } from '@src/utils/is_chunk_load_error'
import { logCrash } from '@src/utils/log_crash'
import { reloadPageAfterNewRelease } from '@src/utils/reload_after_new_release'

import { CrashFallback } from './crash_fallback'

export interface IRouteBoundaryProps {
  children:  ReactNode
  /** Shown while the lazy page's code loads. */
  fallback?: ReactNode
}

function renderFallback({ error, resetErrorBoundary }: FallbackProps): React.JSX.Element {
  return <CrashFallback error={error} onRetry={resetErrorBoundary} />
}

function handleError(error: unknown): void {
  logCrash('route', error)
  if (isChunkLoadError(error)) reloadPageAfterNewRelease()
}

/** Wraps every lazy page: a crash stays in the page area and clears on navigation. */
export function RouteBoundary({ children, fallback = null }: IRouteBoundaryProps): React.JSX.Element {
  const { pathname } = useLocation()

  return (
    <ErrorBoundary fallbackRender={renderFallback} resetKeys={[pathname]} onError={handleError}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )
}
