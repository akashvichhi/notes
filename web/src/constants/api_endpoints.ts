import type { TUuid } from '@src/types/api'

/** API paths, relative to /api/v1. */
export const API_ENDPOINTS = {
  LOGIN:         '/auth/login',
  REGISTER:      '/auth/register',
  LOGOUT:        '/auth/logout',
  CURRENT_USER:  '/auth/me',
  PROFILE:       '/me',
  PASSWORD:      '/me/password',
  ACCESS_TOKENS: '/me/access-tokens',
  BOOTSTRAP:     '/bootstrap',
  SEARCH:        '/search',
  NOTES:         '/notes',
  FOLDERS:       '/folders',
  TAGS:          '/tags',

  accessTokenById:  (id: number): string => `/me/access-tokens/${id}`,
  noteByUuid:       (uuid: TUuid): string => `/notes/${uuid}`,
  noteTags:         (uuid: TUuid): string => `/notes/${uuid}/tags`,
  noteRestore:      (uuid: TUuid): string => `/notes/${uuid}/restore`,
  noteDuplicate:    (uuid: TUuid): string => `/notes/${uuid}/duplicate`,
  folderByUuid:     (uuid: TUuid): string => `/folders/${uuid}`,
  tagByUuid:        (uuid: TUuid): string => `/tags/${uuid}`,
} as const
