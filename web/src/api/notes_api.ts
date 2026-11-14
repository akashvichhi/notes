import { API_ENDPOINTS } from '@src/constants/api_endpoints'
import type { IDataResponse } from '@src/types/api_response'
import type { INote, INoteListItem, TProseMirrorDoc, TUuid } from '@src/types/api'
import type { IPaginatedResponse } from '@src/types/pagination'

import { api } from './api_client'



export type TNotesPage = IPaginatedResponse<INoteListItem>

export async function fetchNotes(params: Record<string, string | undefined>): Promise<TNotesPage> {
  const { data } = await api.get<TNotesPage>(API_ENDPOINTS.NOTES, { params })
  return data
}

export async function fetchNote(uuid: TUuid): Promise<INote> {
  const { data } = await api.get<IDataResponse<INote>>(API_ENDPOINTS.noteByUuid(uuid))
  return data.data
}

export async function createNote(payload: { folderId?: TUuid; uuid?: TUuid }): Promise<INote> {
  const { data } = await api.post<IDataResponse<INote>>(API_ENDPOINTS.NOTES, payload)
  return data.data
}

export async function patchNote(
  uuid: TUuid,
  payload: Partial<{ body: TProseMirrorDoc; version: number; title: string; folderId: TUuid | null; isStarred: boolean }>,
): Promise<INote> {
  const { data } = await api.patch<IDataResponse<INote>>(API_ENDPOINTS.noteByUuid(uuid), payload)
  return data.data
}

export async function syncNoteTags(uuid: TUuid, names: string[]): Promise<INote> {
  const { data } = await api.put<IDataResponse<INote>>(API_ENDPOINTS.noteTags(uuid), { names })
  return data.data
}

export async function trashNote(uuid: TUuid): Promise<void> { await api.delete(API_ENDPOINTS.noteByUuid(uuid)) }
export async function restoreNote(uuid: TUuid): Promise<void> { await api.post(API_ENDPOINTS.noteRestore(uuid)) }
export async function forceDeleteNote(uuid: TUuid): Promise<void> {
  await api.delete(API_ENDPOINTS.noteByUuid(uuid), { params: { force: true } })
}
export async function duplicateNote(uuid: TUuid): Promise<INote> {
  const { data } = await api.post<IDataResponse<INote>>(API_ENDPOINTS.noteDuplicate(uuid))
  return data.data
}
