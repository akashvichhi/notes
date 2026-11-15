import { describe, expect, it } from 'vitest'

import type { TScope } from '@src/types/scope'

import { ALL_SCOPE, notePath, scopeFromLocation, scopePath } from './scope_location'

const NOTE_UUID: string = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const FOLDER_UUID: string = '0199a1b2-c3d4-7e5f-8a9b-ffffffffffff'

interface IScopeCase {
  scope:    TScope
  listPath: string
  notePath: string
}

const CASES: IScopeCase[] = [
  { scope: ALL_SCOPE, listPath: '/', notePath: `/notes/${NOTE_UUID}` },
  { scope: { kind: 'starred' }, listPath: '/starred', notePath: `/starred/notes/${NOTE_UUID}` },
  { scope: { kind: 'trash' }, listPath: '/trash', notePath: `/trash/notes/${NOTE_UUID}` },
  { scope: { kind: 'folder', uuid: FOLDER_UUID }, listPath: `/folders/${FOLDER_UUID}`, notePath: `/folders/${FOLDER_UUID}/notes/${NOTE_UUID}` },
  { scope: { kind: 'tag', slug: 'job-search' }, listPath: '/tags/job-search', notePath: `/tags/job-search/notes/${NOTE_UUID}` },
  { scope: { kind: 'search', q: 'tax 2026' }, listPath: '/search?q=tax+2026', notePath: `/search/notes/${NOTE_UUID}?q=tax+2026` },
]

function splitUrl(url: string): [string, string] {
  const { pathname, search }: URL = new URL(url, 'http://localhost')
  return [pathname, search]
}

describe('scope URLs', () => {
  it.each(CASES)('builds the list URL for $scope.kind', ({ scope, listPath }: IScopeCase) => {
    expect(scopePath(scope)).toBe(listPath)
  })

  it.each(CASES)('builds the URL of a note open under $scope.kind', ({ scope, notePath: expected }: IScopeCase) => {
    expect(notePath(NOTE_UUID, scope)).toBe(expected)
  })

  it.each(CASES)('reads $scope.kind back from its list URL and from its note URL', ({ scope, listPath, notePath: noteUrl }: IScopeCase) => {
    expect(scopeFromLocation(...splitUrl(listPath))).toEqual(scope)
    expect(scopeFromLocation(...splitUrl(noteUrl))).toEqual(scope)
  })

  it('opens a note under All notes when no list is given', () => {
    expect(notePath(NOTE_UUID)).toBe(`/notes/${NOTE_UUID}`)
  })

  it('reads a search URL without words as All notes', () => {
    expect(scopeFromLocation('/search', '')).toEqual(ALL_SCOPE)
    expect(scopeFromLocation('/search', '?q=%20%20')).toEqual(ALL_SCOPE)
  })

  it('reads an unknown path as All notes', () => {
    expect(scopeFromLocation('/somewhere/else', '')).toEqual(ALL_SCOPE)
  })
})
