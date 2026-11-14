import { describe, expect, it } from 'vitest'

import type { INoteListItem } from '@src/types/api'

import { filterNotes } from './filter_notes'

const note: (overrides: Partial<INoteListItem>) => INoteListItem = (overrides: Partial<INoteListItem>): INoteListItem => ({
  uuid:       '00000000-0000-7000-8000-000000000001',
  title:      'Untitled',
  excerpt:    '',
  is_starred: false,
  folder:     null,
  tags:       [],
  updated_at: '2026-01-01T00:00:00+00:00',
  deleted_at: null,
  ...overrides,
})

describe('filterNotes', (): void => {
  const groceries: INoteListItem = note({ uuid: '00000000-0000-7000-8000-000000000002', title: 'Groceries', excerpt: 'Milk and eggs' })
  const trip: INoteListItem = note({ uuid: '00000000-0000-7000-8000-000000000003', title: 'Trip plan', excerpt: 'Book the train' })

  it('returns every note for a blank query', (): void => {
    expect(filterNotes([groceries, trip], '   ')).toEqual([groceries, trip])
  })

  it('matches the title, ignoring case and surrounding spaces', (): void => {
    expect(filterNotes([groceries, trip], '  GROCER ')).toEqual([groceries])
  })

  it('matches the excerpt', (): void => {
    expect(filterNotes([groceries, trip], 'train')).toEqual([trip])
  })

  it('returns nothing when no note matches', (): void => {
    expect(filterNotes([groceries, trip], 'piano')).toEqual([])
  })
})
