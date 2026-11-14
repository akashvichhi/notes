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
  theme?:        'light' | 'dark' | 'system'
  sort?:         'updated' | 'created' | 'title'
  groupByDate?:  boolean
  showSnippets?: boolean
}

export interface IFolder {
  uuid:       TUuid
  name:       string
  parentUuid: TUuid | null
  color:      string | null
  position:   number
}

export interface ITag {
  uuid: TUuid
  name: string
  slug: string
}

/** The folder a note is in, as the note carries it. */
export interface INoteFolder {
  uuid: TUuid
  name: string
}

export interface INoteListItem {
  uuid:      TUuid
  title:     string
  excerpt:   string
  isStarred: boolean
  folder:    INoteFolder | null
  /** Tag slugs. */
  tags:      string[]
  updatedAt: TIsoDate
  deletedAt: TIsoDate | null
}

/** A ProseMirror document. Opaque to everything outside the editor. */
export type TProseMirrorDoc = JSONContent

export interface INote extends INoteListItem {
  body:        TProseMirrorDoc | null
  version:     number
  wordCount:   number
  titleLocked: boolean
}

/** Note counts for the sidebar. The API sends lists; the app looks them up by folder uuid and tag slug. */
export interface INoteCounts {
  all:     number
  starred: number
  trashed: number
  folders: Record<TUuid, number>
  tags:    Record<string, number>
}

export interface IFolderCount {
  uuid:  TUuid
  count: number
}

export interface ITagCount {
  slug:  string
  count: number
}

/** The counts as the API sends them. */
export interface INoteCountsResponse extends Omit<INoteCounts, 'folders' | 'tags'> {
  folders: IFolderCount[]
  tags:    ITagCount[]
}

export interface IBootstrap {
  user:    IUser
  folders: IFolder[]
  tags:    ITag[]
  counts:  INoteCounts
  notes:   INoteListItem[]
}

/** The bootstrap as the API sends it. */
export interface IBootstrapResponse extends Omit<IBootstrap, 'counts'> {
  counts: INoteCountsResponse
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
  folders: INoteFolder[]
  tags:    ITag[]
}

export type TAccessTokenAbility = 'notes:read' | 'notes:write'

/** A personal access token, for Claude and other MCP clients. The token itself is never listed. */
export interface IAccessToken {
  id:         number
  name:       string
  abilities:  TAccessTokenAbility[]
  createdAt:  TIsoDate
  lastUsedAt: TIsoDate | null
  expiresAt:  TIsoDate | null
}

/** A token just created: the only time its text is shown. */
export interface ICreatedAccessToken {
  token:       string
  accessToken: IAccessToken
}
