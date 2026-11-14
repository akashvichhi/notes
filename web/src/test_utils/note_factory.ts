import type { INote } from '@src/types/api'

/** A Cloud note with sensible defaults; pass only what a test cares about. */
export function makeNote(overrides: Partial<INote> = {}): INote {
  return {
    uuid:         'note-1',
    title:        'Shopping',
    excerpt:      '',
    is_starred:   false,
    folder:       null,
    tags:         [],
    updated_at:   '2026-11-13T09:00:00Z',
    deleted_at:   null,
    body:         null,
    version:      3,
    word_count:   0,
    title_locked: false,
    ...overrides,
  }
}
