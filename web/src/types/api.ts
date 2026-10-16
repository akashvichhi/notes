import type { JSONContent } from '@tiptap/core'

export type UUID = string
export type ISODate = string
export type Container = 'cloud' | 'local'

export interface LocalNote {
  uuid: UUID
  container: Container
  folder_uuid: UUID | null
  title: string
  title_locked: boolean
  body: ProseMirrorDoc | null
  plain_text: string
  excerpt: string
  is_starred: boolean
  word_count: number
  deleted_at: ISODate | null
  updated_at: ISODate
  server_version: number | null
  server_revision: number | null
  dirty: boolean
}

export interface LocalFolder {
  uuid: UUID
  container: Container
  parent_uuid: UUID | null
  name: string
  color: string | null
  position: number
  deleted_at: ISODate | null
  dirty: boolean
  server_revision: number | null
}

export interface LocalTag {
  uuid: UUID
  container: Container
  name: string
  slug: string
  deleted_at: ISODate | null
  dirty: boolean
  server_revision: number | null
}

export interface User {
  uuid: UUID
  name: string
  email: string
  preferences: Preferences
}

export interface Preferences {
  theme?: 'light' | 'dark' | 'system'
  sort?: 'updated' | 'created' | 'title'
  group_by_date?: boolean
  show_snippets?: boolean
}

export interface Folder {
  uuid: UUID
  name: string
  parent_uuid: UUID | null
  color: string | null
  position: number
}

export interface Tag {
  uuid: UUID
  name: string
  slug: string
}

export interface NoteListItem {
  uuid: UUID
  container?: Container
  title: string
  excerpt: string
  is_starred: boolean
  folder: { uuid: UUID; name: string } | null
  tags: string[]
  updated_at: ISODate
  deleted_at: ISODate | null
}

/** A ProseMirror document. Opaque to everything outside the editor. */
export type ProseMirrorDoc = JSONContent

export interface Note extends NoteListItem {
  body: ProseMirrorDoc | null
  version: number
  word_count: number
  title_locked: boolean
  plain_text?: string
}

export interface Counts {
  all: number
  starred: number
  trashed: number
  folders: Record<UUID, number>
  tags: Record<string, number>
}

export interface Bootstrap {
  user: User | { data: User }
  folders: Folder[] | { data: Folder[] }
  tags: Tag[] | { data: Tag[] }
  counts: Counts
  notes: NoteListItem[] | { data: NoteListItem[] }
}

export interface SearchHit {
  uuid: UUID
  title: string
  /** Plain text. The server never sends HTML; the client highlights `terms`. */
  snippet: string
  terms: string[]
}

export interface SearchResults {
  notes: SearchHit[]
  folders: { uuid: UUID; name: string }[]
  tags: Tag[]
}
