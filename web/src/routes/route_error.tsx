import { useCallback, useEffect } from 'react'
import { useRouteError } from 'react-router'

import { isChunkLoadError } from '@src/utils/is_chunk_load_error'
import { logCrash } from '@src/utils/log_crash'
import { reloadPageAfterNewRelease } from '@src/utils/reload_after_new_release'

import { CrashFallback } from './crash_fallback'
import { ROUTE_PATHS } from './route_paths'

/** The router's errorElement: the same fallback as RouteBoundary, for errors the router catches. */
export function RouteErrorBoundary(): React.JSX.Element {
  const error: unknown = useRouteError()

  useEffect((): void => {
    logCrash('router', error)
    if (isChunkLoadError(error)) reloadPageAfterNewRelease()
  }, [error])

  const handleRetry: () => void = useCallback((): void => {
    window.location.href = ROUTE_PATHS.HOME
  }, [])

  return <CrashFallback error={error} onRetry={handleRetry} />
}
