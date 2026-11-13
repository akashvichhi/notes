import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createNote, patchNote, trashNote } from '@src/api/notes_api'
import { notesRepo } from '@src/db/notes_repo'
import { outbox, type OutboxItem } from './outbox'
import { push } from './push'

vi.mock('@src/platform/is_native', () => ({ isNative: (): boolean => true }))
vi.mock('@src/platform/secure_store', () => ({ loadToken: async (): Promise<string> => 'token' }))
vi.mock('@src/api/notes_api', () => ({
  createNote:     vi.fn(),
  fetchNote:      vi.fn(),
  forceDeleteNote: vi.fn(),
  patchNote:      vi.fn(),
  restoreNote:    vi.fn(),
  syncNoteTags:   vi.fn(),
  trashNote:      vi.fn(),
}))
vi.mock('@src/db/notes_repo', () => ({
  notesRepo: { getDirtyCloudNotes: vi.fn(), get: vi.fn(), upsert: vi.fn(), hardDelete: vi.fn(), markDirty: vi.fn() },
}))
vi.mock('./outbox', () => ({
  outbox: { pending: vi.fn(), enqueue: vi.fn(), complete: vi.fn(), remove: vi.fn() },
}))

const TRASH_OP: OutboxItem = { id: 1, kind: 'trash', uuid: 'n1', container: 'cloud' }

function httpError(status: number): unknown {
  return { response: { status, data: { message: 'Rejected' } } }
}

describe('push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(notesRepo.getDirtyCloudNotes).mockResolvedValue([])
    vi.mocked(notesRepo.get).mockResolvedValue(null)
    vi.mocked(outbox.complete).mockResolvedValue(true)
  })

  it('keeps an op the server rate-limited, to retry on the next run', async () => {
    vi.mocked(outbox.pending).mockResolvedValue([TRASH_OP])
    vi.mocked(trashNote).mockRejectedValue(httpError(429))

    await push()

    expect(outbox.remove).not.toHaveBeenCalled()
    expect(outbox.complete).not.toHaveBeenCalled()
  })

  it('drops an op the server rejected and reports the note', async () => {
    vi.mocked(outbox.pending).mockResolvedValue([{ id: 2, kind: 'body', uuid: 'n2', body: null, version: 1, container: 'cloud' }])
    vi.mocked(patchNote).mockRejectedValue(httpError(422))

    const result: Awaited<ReturnType<typeof push>> = await push()

    expect(outbox.remove).toHaveBeenCalledWith(2)
    expect(result.rejected).toEqual(['n2'])
  })

  it('stops re-sending a rejected change on the next run', async () => {
    vi.mocked(outbox.pending).mockResolvedValue([{ id: 4, kind: 'body', uuid: 'n4', body: null, version: 1, container: 'cloud' }])
    vi.mocked(patchNote).mockRejectedValue(httpError(422))

    await push()

    // Still dirty, the note would be queued again by the next run's recovery step.
    expect(notesRepo.markDirty).toHaveBeenCalledWith('n4', false)
  })

  it('re-creates a dirty note the server has never seen', async () => {
    vi.mocked(notesRepo.getDirtyCloudNotes).mockResolvedValue([
      { uuid: 'n3', title: '', excerpt: '', is_starred: false, folder: null, tags: [], updated_at: '2026-11-10T00:00:00Z', deleted_at: null, body: null, version: 1, word_count: 0, title_locked: false, plain_text: '', server_version: null },
    ])
    vi.mocked(outbox.pending).mockResolvedValue([])

    await push()

    expect(outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'create', uuid: 'n3' }))
    expect(createNote).not.toHaveBeenCalled()
  })
})
