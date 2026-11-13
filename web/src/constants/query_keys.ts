import type { Scope } from '@src/stores/ui_store'
import type { Container, UUID } from '@src/types/api'

export const BOOTSTRAP_KEY: readonly ['bootstrap'] = ['bootstrap'] as const
export const NOTES_KEY: readonly ['notes'] = ['notes'] as const
export const NOTE_KEY: readonly ['note'] = ['note'] as const
export const AUTH_KEY: readonly ['me'] = ['me'] as const
export const LOCAL_SIDEBAR_KEY: readonly ['local-sidebar'] = ['local-sidebar'] as const
export const ACCESS_TOKENS_KEY: readonly ['access-tokens'] = ['access-tokens'] as const

export interface IQueryKeys {
  readonly bootstrap:    typeof BOOTSTRAP_KEY
  readonly auth:         typeof AUTH_KEY
  readonly accessTokens: typeof ACCESS_TOKENS_KEY
  readonly notes: {
    readonly all:    typeof NOTES_KEY
    readonly list:   (container: Container | undefined, scopeKey: string) => readonly ['notes', Container | undefined, string]
    readonly detail: (uuid?: UUID | null) => readonly ['note', UUID | null | undefined]
    readonly filter: (scope: Scope, query: string) => readonly ['notes', 'filter', Scope, string]
  }
  readonly search: (query: string, container: Container | undefined) => readonly ['search', string, Container | undefined]
}

export const queryKeys: IQueryKeys = {
  bootstrap:    BOOTSTRAP_KEY,
  auth:         AUTH_KEY,
  accessTokens: ACCESS_TOKENS_KEY,
  notes:        {
    all:    NOTES_KEY,
    list:   (container: Container | undefined, scopeKey: string) => [...NOTES_KEY, container, scopeKey] as const,
    detail: (uuid?: UUID | null) => [...NOTE_KEY, uuid] as const,
    // Under NOTES_KEY, so every note change refreshes filter results too.
    filter: (scope: Scope, query: string) => [...NOTES_KEY, 'filter', scope, query] as const,
  },
  search: (query: string, container: Container | undefined) => ['search', query, container] as const,
} as const
