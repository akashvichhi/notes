import type { INote } from '@src/types/api'

/** A Cloud note with sensible defaults; pass only what a test cares about. */
export function makeNote(overrides: Partial<INote> = {}): INote {
  return {
    uuid:        'note-1',
    title:       'Shopping',
    excerpt:     '',
    isStarred:   false,
    folder:      null,
    tags:        [],
    updatedAt:   '2026-11-13T09:00:00Z',
    deletedAt:   null,
    body:        null,
    version:     3,
    wordCount:   0,
    titleLocked: false,
    ...overrides,
  }
}
