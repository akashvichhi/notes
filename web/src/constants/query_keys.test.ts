import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { TScope } from '@src/types/scope'

import { NOTES_KEY, queryKeys } from './query_keys'

describe('queryKeys.notes.filter', () => {
  it('is refreshed with every other note list when a note changes', async () => {
    const qc: QueryClient = new QueryClient()
    const scope: TScope = { kind: 'all' }
    const key: readonly unknown[] = queryKeys.notes.filter(scope, 'draft')
    qc.setQueryData(key, { data: [] })

    await qc.invalidateQueries({ queryKey: NOTES_KEY })

    expect(qc.getQueryState(key)?.isInvalidated).toBe(true)
  })
})
