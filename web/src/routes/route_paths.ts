/** Every route path in the app, and builders for the ones with parameters. */
export interface IRoutePaths {
  readonly HOME:          '/'
  readonly LOGIN:         '/login'
  readonly REGISTER:      '/register'
  readonly NOTE:          '/notes/:uuid'
  readonly ACCESS_TOKENS: '/settings/access-tokens'
}

export const ROUTE_PATHS: IRoutePaths = {
  HOME:          '/',
  LOGIN:         '/login',
  REGISTER:      '/register',
  NOTE:          '/notes/:uuid',
  ACCESS_TOKENS: '/settings/access-tokens',
} as const

export const notePath: (uuid: string) => string = (uuid: string): string => `/notes/${uuid}`
