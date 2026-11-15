import { useEffect } from 'react'
import { type NavigateFunction, useNavigate } from 'react-router'

import { useIsMutating } from '@tanstack/react-query'

import { MESSAGES } from '@src/constants/messages'
import { type TBootstrapResult, useBootstrap } from '@src/queries/bootstrap_queries'
import { ROUTE_PATHS } from '@src/routes/route_paths'
import { showErrorToast } from '@src/utils/notifications'

/**
 * A URL naming a folder or tag that no longer exists (a stale bookmark, a typo,
 * one deleted on another device) goes to All notes with a notice. It waits while
 * anything is saving or loading: renaming a tag moves the URL to the new slug a
 * moment before the sidebar has it.
 */
export function useMissingScopeRedirect(isMissing: boolean): void {
  const navigate: NavigateFunction = useNavigate()
  const { isFetching }: TBootstrapResult = useBootstrap()
  const pendingMutations: number = useIsMutating()

  useEffect(() => {
    if (!isMissing || isFetching || pendingMutations > 0) return
    showErrorToast(MESSAGES.LIST_NOT_FOUND)
    void navigate(ROUTE_PATHS.HOME, { replace: true })
  }, [isMissing, isFetching, pendingMutations, navigate])
}
