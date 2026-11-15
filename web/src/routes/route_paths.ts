/** Every route path in the app, and builders for the ones with parameters. */
export interface IRoutePaths {
  readonly HOME:          '/'
  readonly LOGIN:         '/login'
  readonly REGISTER:      '/register'
  readonly NOTE:          '/notes/:uuid'
  readonly STARRED:       '/starred'
  readonly TRASH:         '/trash'
  readonly FOLDER:        '/folders/:folderUuid'
  readonly TAG:           '/tags/:slug'
  readonly SEARCH:        '/search'
  readonly ACCESS_TOKENS: '/settings/access-tokens'
}

export const ROUTE_PATHS: IRoutePaths = {
  HOME:          '/',
  LOGIN:         '/login',
  REGISTER:      '/register',
  NOTE:          '/notes/:uuid',
  STARRED:       '/starred',
  TRASH:         '/trash',
  FOLDER:        '/folders/:folderUuid',
  TAG:           '/tags/:slug',
  SEARCH:        '/search',
  ACCESS_TOKENS: '/settings/access-tokens',
} as const

/** The search words, in the query string of every search URL. */
export const SEARCH_QUERY_PARAM: string = 'q'

/** The lists, each of which can also have a note open under it (decision 13). */
const LIST_PATHS: readonly string[] = [
  ROUTE_PATHS.STARRED, ROUTE_PATHS.TRASH, ROUTE_PATHS.FOLDER, ROUTE_PATHS.TAG, ROUTE_PATHS.SEARCH,
]

/** Every path the notes page answers on: All notes is `/` and `/notes/:uuid`. */
export const NOTES_PAGE_PATHS: readonly string[] = [
  ROUTE_PATHS.HOME,
  ROUTE_PATHS.NOTE,
  ...LIST_PATHS.flatMap((path: string): string[] => [path, `${path}${ROUTE_PATHS.NOTE}`]),
]
