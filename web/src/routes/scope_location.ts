import { generatePath, matchPath, type PathMatch } from 'react-router'

import type { TUuid } from '@src/types/api'
import type { TScope } from '@src/types/scope'

import { ROUTE_PATHS, SEARCH_QUERY_PARAM } from './route_paths'

/** The list shown on `/`. */
export const ALL_SCOPE: TScope = { kind: 'all' }

// A search for nothing would list every note under a "Results for" heading.
function searchScope(search: URLSearchParams): TScope {
  const q: string = search.get(SEARCH_QUERY_PARAM)?.trim() ?? ''
  return q ? { kind: 'search', q } : ALL_SCOPE
}

interface IScopeRoute {
  path:    string
  toScope: (match: PathMatch, search: URLSearchParams) => TScope
}

// Matched as prefixes, so a note open under a list (`/trash/notes/:uuid`) keeps its list.
const SCOPE_ROUTES: readonly IScopeRoute[] = [
  { path: ROUTE_PATHS.STARRED, toScope: (): TScope => ({ kind: 'starred' }) },
  { path: ROUTE_PATHS.TRASH, toScope: (): TScope => ({ kind: 'trash' }) },
  { path: ROUTE_PATHS.FOLDER, toScope: (match: PathMatch): TScope => ({ kind: 'folder', uuid: match.params.folderUuid ?? '' }) },
  { path: ROUTE_PATHS.TAG, toScope: (match: PathMatch): TScope => ({ kind: 'tag', slug: match.params.slug ?? '' }) },
  { path: ROUTE_PATHS.SEARCH, toScope: (_match: PathMatch, search: URLSearchParams): TScope => searchScope(search) },
]

/** The list a URL shows; anything that is not a list path is All notes. */
export function scopeFromLocation(pathname: string, search: string): TScope {
  const searchParams: URLSearchParams = new URLSearchParams(search)
  for (const route of SCOPE_ROUTES) {
    const match: PathMatch | null = matchPath({ path: route.path, end: false }, pathname)
    if (match) return route.toScope(match, searchParams)
  }
  return ALL_SCOPE
}

function scopePathname(scope: TScope): string {
  switch (scope.kind) {
    case 'all': return ''
    case 'starred': return ROUTE_PATHS.STARRED
    case 'trash': return ROUTE_PATHS.TRASH
    case 'folder': return generatePath(ROUTE_PATHS.FOLDER, { folderUuid: scope.uuid })
    case 'tag': return generatePath(ROUTE_PATHS.TAG, { slug: scope.slug })
    case 'search': return ROUTE_PATHS.SEARCH
  }
}

function scopeSearch(scope: TScope): string {
  if (scope.kind !== 'search') return ''
  return `?${new URLSearchParams({ [SEARCH_QUERY_PARAM]: scope.q }).toString()}`
}

/** The URL of a list with no note open. */
export function scopePath(scope: TScope): string {
  return `${scopePathname(scope) || ROUTE_PATHS.HOME}${scopeSearch(scope)}`
}

/** The URL of a note open under a list. */
export function notePath(uuid: TUuid, scope: TScope = ALL_SCOPE): string {
  return `${scopePathname(scope)}${generatePath(ROUTE_PATHS.NOTE, { uuid })}${scopeSearch(scope)}`
}
