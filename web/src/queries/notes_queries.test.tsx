import type { ReactElement, ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as notesApi from '@src/api/notes_api'
import type { TScope } from '@src/types/scope'

import { useNotesFilterQuery } from './notes_queries'

vi.mock('@src/api/notes_api', () => ({ fetchNotes: vi.fn() }))

const FOLDER_UUID: string = '0199a1b2-c3d4-7e5f-8a9b-000000000001'
const EMPTY_PAGE: notesApi.TNotesPage = { data: [], meta: { totalCount: 0, currentPage: 1, perPage: 20, totalPages: 0 } }

function wrapper({ children }: { children: ReactNode }): ReactElement {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

interface IFilterCase {
  scope:    TScope
  expected: Record<string, string | undefined>
}

const CASES: IFilterCase[] = [
  { scope: { kind: 'all' }, expected: { q: 'tax' } },
  { scope: { kind: 'folder', uuid: FOLDER_UUID }, expected: { folderId: FOLDER_UUID, q: 'tax' } },
  { scope: { kind: 'tag', slug: 'job-search' }, expected: { tag: 'job-search', q: 'tax' } },
  { scope: { kind: 'starred' }, expected: { starred: '1', q: 'tax' } },
  { scope: { kind: 'trash' }, expected: { trashed: '1', q: 'tax' } },
]

describe('useNotesFilterQuery', () => {
  beforeEach(() => {
    vi.mocked(notesApi.fetchNotes).mockReset().mockResolvedValue(EMPTY_PAGE)
  })

  it.each(CASES)('searches only inside the $scope.kind list', async ({ scope, expected }: IFilterCase) => {
    renderHook(() => useNotesFilterQuery(scope, 'tax', true), { wrapper })

    await waitFor(() => expect(notesApi.fetchNotes).toHaveBeenCalledWith(expect.objectContaining(expected)))
  })

  it('asks the server nothing while it is not needed', () => {
    renderHook(() => useNotesFilterQuery({ kind: 'all' }, 'tax', false), { wrapper })

    expect(notesApi.fetchNotes).not.toHaveBeenCalled()
  })
})
