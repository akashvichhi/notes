import type { ReactElement, ReactNode } from 'react'
import { type Location, MemoryRouter, useLocation } from 'react-router'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, type RenderHookResult, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MESSAGES } from '@src/constants/messages'
import { BOOTSTRAP_KEY } from '@src/constants/query_keys'
import type { IBootstrap, IPreferences } from '@src/types/api'
import { showErrorToast } from '@src/utils/notifications'

import { useMissingScopeRedirect } from './use_missing_scope_redirect'
import { type IScopeState, useScope } from './use_scope'

vi.mock('@src/api/bootstrap_api', () => ({ fetchBootstrap: vi.fn() }))
vi.mock('@src/utils/notifications', () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }))

const FOLDER_UUID: string = '0199a1b2-c3d4-7e5f-8a9b-000000000001'

const BOOTSTRAP: IBootstrap = {
  user:    { uuid: 'user', name: 'Test', email: 'test@example.com', preferences: {} as IPreferences },
  folders: [{ uuid: FOLDER_UUID, name: 'Work', parentUuid: null, color: null, position: 0 }],
  tags:    [{ uuid: 'tag', name: 'Job search', slug: 'job-search' }],
  counts:  { all: 1, starred: 0, trashed: 0, folders: {}, tags: {} },
  notes:   [],
}

interface IHookResult {
  state:    IScopeState
  location: Location
}

function renderScope(url: string): RenderHookResult<IHookResult, unknown> {
  const client: QueryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  client.setQueryData(BOOTSTRAP_KEY, BOOTSTRAP)
  const wrapper: ({ children }: { children: ReactNode }) => ReactElement = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return renderHook((): IHookResult => {
    const state: IScopeState = useScope()
    useMissingScopeRedirect(state.isMissing)
    return { state, location: useLocation() }
  }, { wrapper })
}

describe('useScope', () => {
  it('names a folder list after the folder, with a note open or not', () => {
    expect(renderScope(`/folders/${FOLDER_UUID}`).result.current.state.label).toBe('Work')
    expect(renderScope(`/folders/${FOLDER_UUID}/notes/abc`).result.current.state.label).toBe('Work')
  })

  it('names a tag list after the tag', () => {
    expect(renderScope('/tags/job-search').result.current.state.label).toBe('#Job search')
  })

  it('names search results after the words searched for', () => {
    expect(renderScope('/search?q=tax').result.current.state.label).toBe('Results for “tax”')
  })

  it('sends a folder that no longer exists to All notes, with a notice', async () => {
    const { result } = renderScope('/folders/0199a1b2-c3d4-7e5f-8a9b-999999999999')

    await waitFor(() => expect(result.current.location.pathname).toBe('/'))
    expect(showErrorToast).toHaveBeenCalledWith(MESSAGES.LIST_NOT_FOUND)
  })

  it('sends a tag that no longer exists to All notes', async () => {
    const { result } = renderScope('/tags/gone')

    await waitFor(() => expect(result.current.location.pathname).toBe('/'))
  })
})
