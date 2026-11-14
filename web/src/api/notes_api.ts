import type { INote, INoteListItem, TProseMirrorDoc, TUuid } from '@src/types/api'

import { api } from './api_client'



export interface IPaginationMeta {
  current_page: number
  from:         number | null
  last_page:    number
  path:         string
  per_page:     number
  to:           number | null
  total:        number
}

export interface INotesPage {
  data: INoteListItem[]
  meta: IPaginationMeta
}

export async function fetchNotes(params: Record<string, string | undefined>): Promise<INotesPage> {
  const { data } = await api.get<INotesPage>('/notes', { params })
  return data
}

export async function fetchNote(uuid: TUuid): Promise<INote> {
  const { data } = await api.get<{ data: INote }>(`/notes/${uuid}`)
  return data.data
}

export async function createNote(payload: { folder_id?: TUuid; uuid?: TUuid }): Promise<INote> {
  const { data } = await api.post<{ data: INote }>('/notes', payload)
  return data.data
}

export async function patchNote(
  uuid: TUuid,
  payload: Partial<{ body: TProseMirrorDoc; version: number; title: string; folder_id: TUuid | null; is_starred: boolean }>,
): Promise<INote> {
  const { data } = await api.patch<{ data: INote }>(`/notes/${uuid}`, payload)
  return data.data
}

export async function syncNoteTags(uuid: TUuid, names: string[]): Promise<INote> {
  const { data } = await api.put<{ data: INote }>(`/notes/${uuid}/tags`, { names })
  return data.data
}

export async function trashNote(uuid: TUuid): Promise<void> { await api.delete(`/notes/${uuid}`) }
export async function restoreNote(uuid: TUuid): Promise<void> { await api.post(`/notes/${uuid}/restore`) }
export async function forceDeleteNote(uuid: TUuid): Promise<void> {
  await api.delete(`/notes/${uuid}`, { params: { force: 1 } })
}
export async function duplicateNote(uuid: TUuid): Promise<INote> {
  const { data } = await api.post<{ data: INote }>(`/notes/${uuid}/duplicate`)
  return data.data
}
