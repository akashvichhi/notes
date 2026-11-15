import type { QueryKey } from '@tanstack/react-query'

import type { IBootstrap, INote } from '@src/types/api'

/** What optimistic updates save so they can roll back: every cached list they touched. */
export type TQuerySnapshot = [QueryKey, unknown][]

/** Trash, restore and permanent delete: the note leaves one list for another. */
export interface INoteListContext {
  prevNotes:     TQuerySnapshot
  prevBootstrap: IBootstrap | undefined
}

/** Rename: the note's title changes in lists and its open copy. */
export interface IRenameNoteContext {
  prevNotes:      TQuerySnapshot
  prevSingleNote: INote | undefined
  prevBootstrap:  IBootstrap | undefined
}

/** Star and move: also changes sidebar counts. */
export type INoteEditContext = IRenameNoteContext

export interface ICreateNoteContext {
  prevNotes:     TQuerySnapshot
  prevBootstrap: IBootstrap | undefined
  uuid:          string
}

export interface IDuplicateNoteContext extends INoteListContext {
  tempUuid: string
}

export interface INoteTagsContext {
  prevNote:      INote | undefined
  prevBootstrap: IBootstrap | undefined
}

/** Creating a folder or tag shows it at once under a temporary uuid. */
export interface ICreateSidebarItemContext {
  previous: IBootstrap | undefined
  tempUuid: string
}

/** Renaming or deleting a folder or tag. */
export interface ISidebarItemContext {
  prevBootstrap: IBootstrap | undefined
  prevNotes:     TQuerySnapshot
}
