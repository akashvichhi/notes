import type { Scope } from '@/stores/uiStore'
import type { UUID } from '@/types/api'

export const BOOTSTRAP_KEY = ['bootstrap'] as const
export const NOTES_KEY = ['notes'] as const
export const NOTE_KEY = ['note'] as const
export const AUTH_KEY = ['me'] as const
export const LOCAL_SIDEBAR_KEY = ['local-sidebar'] as const

export const queryKeys = {
  bootstrap: BOOTSTRAP_KEY,
  auth:      AUTH_KEY,
  notes:     {
    all:    NOTES_KEY,
    list:   (scopeKey: string) => [...NOTES_KEY, scopeKey] as const,
    detail: (uuid?: UUID | null) => [...NOTE_KEY, uuid] as const,
    filter: (scope: Scope, query: string) => ['notes-filter', scope, query] as const,
  },
  search: (query: string) => ['search', query] as const,
} as const
