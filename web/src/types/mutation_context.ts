import type { QueryKey } from '@tanstack/react-query'

import type { Scope } from '@src/stores/ui_store'
import type { Bootstrap, Note } from '@src/types/api'

/** What optimistic updates save so they can roll back: every cached list they touched. */
export type TQuerySnapshot = [QueryKey, unknown][]

/** Trash, restore and permanent delete: the note leaves one list for another. */
export interface INoteListContext {
  prevNotes:     TQuerySnapshot
  prevBootstrap: Bootstrap | undefined
}

/** Rename: the note's title changes in lists and its open copy. */
export interface IRenameNoteContext {
  prevNotes:      TQuerySnapshot
  prevSingleNote: Note | undefined
  prevBootstrap:  Bootstrap | undefined
}

/** Star and move: also changes sidebar counts. */
export type INoteEditContext = IRenameNoteContext

export interface ICreateNoteContext {
  prevNotes:     TQuerySnapshot
  prevBootstrap: Bootstrap | undefined
  uuid:          string
}

export interface IDuplicateNoteContext extends INoteListContext {
  tempUuid: string
}

export interface INoteTagsContext {
  prevNote:      Note | undefined
  prevBootstrap: Bootstrap | undefined
}

/** Creating a folder or tag shows it at once under a temporary uuid. */
export interface ICreateSidebarItemContext {
  previous: Bootstrap | undefined
  tempUuid: string
}

/** Renaming or deleting a folder or tag; the open scope may point at it. */
export interface ISidebarItemContext {
  prevBootstrap: Bootstrap | undefined
  prevNotes:     TQuerySnapshot
  prevScope:     Scope | null
}
