import type { JSONContent } from '@tiptap/core'

export type TUuid = string
export type TIsoDate = string

export interface IUser {
  uuid:        TUuid
  name:        string
  email:       string
  preferences: IPreferences
}

export interface IPreferences {
  theme?:         'light' | 'dark' | 'system'
  sort?:          'updated' | 'created' | 'title'
  group_by_date?: boolean
  show_snippets?: boolean
}

export interface IFolder {
  uuid:        TUuid
  name:        string
  parent_uuid: TUuid | null
  color:       string | null
  position:    number
}

export interface ITag {
  uuid: TUuid
  name: string
  slug: string
}

export interface INoteListItem {
  uuid:       TUuid
  title:      string
  excerpt:    string
  is_starred: boolean
  folder:     { uuid: TUuid; name: string } | null
  tags:       string[]
  updated_at: TIsoDate
  deleted_at: TIsoDate | null
}

/** A ProseMirror document. Opaque to everything outside the editor. */
export type TProseMirrorDoc = JSONContent

export interface INote extends INoteListItem {
  body:         TProseMirrorDoc | null
  version:      number
  word_count:   number
  title_locked: boolean
  plain_text?:  string
}

export interface INoteCounts {
  all:     number
  starred: number
  trashed: number
  folders: Record<TUuid, number>
  tags:    Record<string, number>
}

export interface IBootstrap {
  user:    IUser | { data: IUser }
  folders: IFolder[] | { data: IFolder[] }
  tags:    ITag[] | { data: ITag[] }
  counts:  INoteCounts
  notes:   INoteListItem[] | { data: INoteListItem[] }
}

export interface ISearchHit {
  uuid:    TUuid
  title:   string
  /** Plain text. The server never sends HTML; the client highlights `terms`. */
  snippet: string
  terms:   string[]
}

export interface ISearchResults {
  notes:   ISearchHit[]
  folders: { uuid: TUuid; name: string }[]
  tags:    ITag[]
}

export type TAccessTokenAbility = 'notes:read' | 'notes:write'

/** A personal access token, for Claude and other MCP clients. The token itself is never listed. */
export interface IAccessToken {
  id:           number
  name:         string
  abilities:    TAccessTokenAbility[]
  created_at:   TIsoDate
  last_used_at: TIsoDate | null
  expires_at:   TIsoDate | null
}
