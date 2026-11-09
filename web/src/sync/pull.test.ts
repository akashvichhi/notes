import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchNotes } from '@src/api/notes_api'
import { notesRepo } from '@src/db/notes_repo'
import { outbox } from './outbox'
import { pull } from './pull'
import type { NoteListItem } from '@src/types/api'

vi.mock('@src/api/bootstrap_api', () => ({
  fetchBootstrap: async (): Promise<object> => ({ folders: [], tags: [] }),
}))
vi.mock('@src/api/notes_api', () => ({ fetchNotes: vi.fn() }))
vi.mock('@src/db/folders_repo', () => ({ foldersRepo: { list: async (): Promise<[]> => [], hardDelete: vi.fn(), upsert: vi.fn() } }))
vi.mock('@src/db/tags_repo', () => ({ tagsRepo: { list: async (): Promise<[]> => [], hardDelete: vi.fn(), upsert: vi.fn(), setNoteTags: vi.fn() } }))
vi.mock('@src/db/notes_repo', () => ({
  notesRepo: { get: vi.fn(), upsert: vi.fn(), list: vi.fn(), hardDelete: vi.fn(), getDirtyCloudNotes: vi.fn() },
}))
vi.mock('./outbox', () => ({ outbox: { pending: vi.fn() } }))

const REMOTE: NoteListItem = {
  uuid: 'n1', title: 'Remote', excerpt: '', is_starred: false, folder: null, tags: [],
  updated_at: '2026-11-10T09:00:00Z', deleted_at: null,
}

describe('pull', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(notesRepo.list).mockResolvedValue([{ ...REMOTE, uuid: 'local-only' }])
    vi.mocked(notesRepo.get).mockResolvedValue(null)
    vi.mocked(notesRepo.getDirtyCloudNotes).mockResolvedValue([])
    vi.mocked(outbox.pending).mockResolvedValue([])
  })

  it('deletes nothing locally when fetching the notes fails', async () => {
    vi.mocked(fetchNotes).mockRejectedValue(new Error('Network Error'))

    await expect(pull()).rejects.toThrow()

    expect(notesRepo.hardDelete).not.toHaveBeenCalled()
  })

  it('leaves a note with unsent changes alone', async () => {
    vi.mocked(fetchNotes).mockResolvedValue({ data: [REMOTE], meta: { current_page: 1, last_page: 1 } } as Awaited<ReturnType<typeof fetchNotes>>)
    vi.mocked(outbox.pending).mockResolvedValue([{ id: 1, kind: 'body', uuid: 'n1', body: null, container: 'cloud' }])
    vi.mocked(notesRepo.list).mockResolvedValue([])

    await pull()

    expect(notesRepo.upsert).not.toHaveBeenCalledWith(expect.objectContaining({ uuid: 'n1' }))
  })
})
