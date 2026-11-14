import { describe, expect, it } from 'vitest'

import { toCamelCaseKeys, toSnakeCaseKeys } from './case_conversion'

describe('toCamelCaseKeys', (): void => {
  it('converts the keys of nested objects and arrays', (): void => {
    const response: unknown = {
      is_starred: true,
      folder:     { parent_uuid: null },
      notes:      [{ updated_at: '2026-01-01T00:00:00+05:30', word_count: 3 }],
    }

    expect(toCamelCaseKeys(response)).toEqual({
      isStarred: true,
      folder:    { parentUuid: null },
      notes:     [{ updatedAt: '2026-01-01T00:00:00+05:30', wordCount: 3 }],
    })
  })

  it('never converts values, only keys', (): void => {
    expect(toCamelCaseKeys({ field: 'current_password', tags: ['read_later'] })).toEqual({
      field: 'current_password',
      tags:  ['read_later'],
    })
  })

  it('leaves a note body exactly as the editor stored it, wherever the note is', (): void => {
    const body: unknown = { type: 'doc', content: [{ type: 'paragraph', attrs: { text_align: 'center' } }] }

    expect(toCamelCaseKeys({ data: { body, title_locked: false } })).toEqual({ data: { body, titleLocked: false } })
    expect(toCamelCaseKeys({ error: 'Changed', server_copy: { body } })).toEqual({
      error:      'Changed',
      serverCopy: { body },
    })
  })

  it('passes primitives and null through', (): void => {
    expect(toCamelCaseKeys(null)).toBeNull()
    expect(toCamelCaseKeys('per_page')).toBe('per_page')
    expect(toCamelCaseKeys([1, 2])).toEqual([1, 2])
  })
})

describe('toSnakeCaseKeys', (): void => {
  it('converts the keys of a request body and its nested objects', (): void => {
    expect(toSnakeCaseKeys({ expiresInDays: 30, folder: { parentUuid: 'f1' }, items: [{ isStarred: true }] })).toEqual({
      expires_in_days: 30,
      folder:          { parent_uuid: 'f1' },
      items:           [{ is_starred: true }],
    })
  })

  it('sends a note body as the editor made it', (): void => {
    const body: unknown = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' } }] }

    expect(toSnakeCaseKeys({ body, version: 2 })).toEqual({ body, version: 2 })
  })

  it('leaves keys that are already snake_case unchanged', (): void => {
    expect(toSnakeCaseKeys({ per_page: 20, page: 1 })).toEqual({ per_page: 20, page: 1 })
  })
})
