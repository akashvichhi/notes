import { useCallback, useMemo } from 'react'

import { scopePath } from '@src/routes/scope_location'
import { type IUiState, useUiStore } from '@src/stores/ui_store'
import type { TScope } from '@src/types/scope'

export interface IScopeFilter {
  filter:    string
  setFilter: (filter: string) => void
}

/**
 * The filter box's text for this list. Another list starts unfiltered: a filter
 * that stuck across lists would make notes look deleted.
 */
export function useScopeFilter(scope: TScope): IScopeFilter {
  const scopeKey: string = scopePath(scope)
  const filter: string = useUiStore((s: IUiState): string => (s.filterScopeKey === scopeKey ? s.filter : ''))

  const setFilter: (filter: string) => void = useCallback((next: string): void => {
    useUiStore.getState().setFilter(next, scopeKey)
  }, [scopeKey])

  return useMemo((): IScopeFilter => ({ filter, setFilter }), [filter, setFilter])
}
