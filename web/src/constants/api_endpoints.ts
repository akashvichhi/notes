import type { TUuid } from '@src/types/api'

type TPathByUuid = (uuid: TUuid) => string

interface IApiEndpoints {
  readonly LOGIN:           string
  readonly REGISTER:        string
  readonly LOGOUT:          string
  readonly CURRENT_USER:    string
  readonly PROFILE:         string
  readonly PASSWORD:        string
  readonly ACCESS_TOKENS:   string
  readonly BOOTSTRAP:       string
  readonly SEARCH:          string
  readonly NOTES:           string
  readonly FOLDERS:         string
  readonly TAGS:            string
  readonly accessTokenById: (id: number) => string
  readonly noteByUuid:      TPathByUuid
  readonly noteTags:        TPathByUuid
  readonly noteRestore:     TPathByUuid
  readonly noteDuplicate:   TPathByUuid
  readonly folderByUuid:    TPathByUuid
  readonly tagByUuid:       TPathByUuid
}

/** API paths, relative to /api/v1. */
export const API_ENDPOINTS: IApiEndpoints = {
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

  accessTokenById: (id: number): string => `/me/access-tokens/${id}`,
  noteByUuid:      (uuid: TUuid): string => `/notes/${uuid}`,
  noteTags:        (uuid: TUuid): string => `/notes/${uuid}/tags`,
  noteRestore:     (uuid: TUuid): string => `/notes/${uuid}/restore`,
  noteDuplicate:   (uuid: TUuid): string => `/notes/${uuid}/duplicate`,
  folderByUuid:    (uuid: TUuid): string => `/folders/${uuid}`,
  tagByUuid:       (uuid: TUuid): string => `/tags/${uuid}`,
}
