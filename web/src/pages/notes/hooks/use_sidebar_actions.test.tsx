import type { ReactElement, ReactNode } from 'react'
import { type Location, MemoryRouter, useLocation } from 'react-router'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, type RenderHookResult, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as foldersApi from '@src/api/folders_api'
import * as tagsApi from '@src/api/tags_api'
import { BOOTSTRAP_KEY } from '@src/constants/query_keys'
import type { IBootstrap, IPreferences } from '@src/types/api'

import { type ISidebarActions, useSidebarActions } from './use_sidebar_actions'

vi.mock('@src/api/folders_api', () => ({ renameFolder: vi.fn(), deleteFolder: vi.fn() }))
vi.mock('@src/api/tags_api', () => ({ renameTag: vi.fn(), deleteTag: vi.fn() }))
vi.mock('@src/api/bootstrap_api', () => ({ fetchBootstrap: vi.fn() }))
vi.mock('@src/utils/notifications', () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }))

const FOLDER_UUID: string = '0199a1b2-c3d4-7e5f-8a9b-000000000001'
const TAG_UUID: string = '0199a1b2-c3d4-7e5f-8a9b-000000000002'
const NOTE_UUID: string = '0199a1b2-c3d4-7e5f-8a9b-000000000003'

const BOOTSTRAP: IBootstrap = {
  user:    { uuid: 'user', name: 'Test', email: 'test@example.com', preferences: {} as IPreferences },
  folders: [{ uuid: FOLDER_UUID, name: 'Work', parentUuid: null, color: null, position: 0 }],
  tags:    [{ uuid: TAG_UUID, name: 'Job search', slug: 'job-search' }],
  counts:  { all: 1, starred: 0, trashed: 0, folders: { [FOLDER_UUID]: 1 }, tags: { 'job-search': 1 } },
  notes:   [],
}

interface IHookResult {
  actions:  ISidebarActions
  location: Location
}

function renderActions(url: string): RenderHookResult<IHookResult, unknown> {
  const client: QueryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  client.setQueryData(BOOTSTRAP_KEY, BOOTSTRAP)
  const wrapper: ({ children }: { children: ReactNode }) => ReactElement = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return renderHook((): IHookResult => ({ actions: useSidebarActions(), location: useLocation() }), { wrapper })
}

function urlOf(location: Location): string {
  return `${location.pathname}${location.search}`
}

describe('useSidebarActions', () => {
  beforeEach(() => {
    vi.mocked(foldersApi.deleteFolder).mockReset().mockResolvedValue(undefined)
    vi.mocked(tagsApi.deleteTag).mockReset().mockResolvedValue(undefined)
    vi.mocked(tagsApi.renameTag).mockReset().mockResolvedValue({ uuid: TAG_UUID, name: 'Job hunt', slug: 'job-hunt' })
  })

  it('goes to All notes when the open folder is deleted', async () => {
    const { result } = renderActions(`/folders/${FOLDER_UUID}/notes/${NOTE_UUID}`)

    act(() => result.current.actions.deleteFolder(FOLDER_UUID))

    expect(urlOf(result.current.location)).toBe('/')
    await waitFor(() => expect(vi.mocked(foldersApi.deleteFolder).mock.calls[0]?.[0]).toBe(FOLDER_UUID))
  })

  it('returns to the folder when deleting it fails', async () => {
    vi.mocked(foldersApi.deleteFolder).mockRejectedValue({ status: 500, message: 'failed' })
    const { result } = renderActions(`/folders/${FOLDER_UUID}`)

    act(() => result.current.actions.deleteFolder(FOLDER_UUID))

    await waitFor(() => expect(urlOf(result.current.location)).toBe(`/folders/${FOLDER_UUID}`))
  })

  it('stays put when a folder that is not open is deleted', async () => {
    const { result } = renderActions('/trash')

    act(() => result.current.actions.deleteFolder(FOLDER_UUID))

    await waitFor(() => expect(foldersApi.deleteFolder).toHaveBeenCalled())
    expect(urlOf(result.current.location)).toBe('/trash')
  })

  it('moves to the new slug when the open tag is renamed', async () => {
    const { result } = renderActions('/tags/job-search')

    act(() => result.current.actions.renameTag(TAG_UUID, 'Job hunt'))

    expect(urlOf(result.current.location)).toBe('/tags/job-hunt')
    await waitFor(() => expect(tagsApi.renameTag).toHaveBeenCalledWith(TAG_UUID, 'Job hunt'))
  })

  it('goes to All notes when the open tag is deleted', async () => {
    const { result } = renderActions('/tags/job-search')

    act(() => result.current.actions.deleteTag(TAG_UUID))

    expect(urlOf(result.current.location)).toBe('/')
    await waitFor(() => expect(vi.mocked(tagsApi.deleteTag).mock.calls[0]?.[0]).toBe(TAG_UUID))
  })
})
