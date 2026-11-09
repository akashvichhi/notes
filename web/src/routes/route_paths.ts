/** Every route path in the app, and builders for the ones with parameters. */
export const ROUTE_PATHS = {
  HOME:          '/',
  LOGIN:         '/login',
  REGISTER:      '/register',
  NOTE:          '/notes/:uuid',
  ACCESS_TOKENS: '/settings/access-tokens',
} as const

export const notePath = (uuid: string): string => `/notes/${uuid}`
