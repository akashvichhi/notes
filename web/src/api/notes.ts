import type { Note, NoteListItem, ProseMirrorDoc, UUID } from '@/types/api'

import { api } from './client'

export interface NotesPage {
  data: NoteListItem[]
  meta: { next_cursor: string | null }
}

export async function fetchNotes(params: Record<string, string | undefined>): Promise<NotesPage> {
  const { data } = await api.get<NotesPage>('/notes', { params })
  return data
}

export async function fetchNote(uuid: UUID): Promise<Note> {
  const { data } = await api.get<{ data: Note }>(`/notes/${uuid}`)
  return data.data
}

export async function createNote(payload: { folder_id?: UUID }): Promise<Note> {
  const { data } = await api.post<{ data: Note }>('/notes', payload)
  return data.data
}

export async function patchNote(
  uuid: UUID,
  payload: Partial<{ body: ProseMirrorDoc; version: number; title: string; folder_id: UUID | null; is_starred: boolean }>,
): Promise<Note> {
  const { data } = await api.patch<{ data: Note }>(`/notes/${uuid}`, payload)
  return data.data
}

export async function syncNoteTags(uuid: UUID, names: string[]): Promise<Note> {
  const { data } = await api.put<{ data: Note }>(`/notes/${uuid}/tags`, { names })
  return data.data
}

export async function trashNote(uuid: UUID): Promise<void> { await api.delete(`/notes/${uuid}`) }
export async function restoreNote(uuid: UUID): Promise<void> { await api.post(`/notes/${uuid}/restore`) }
export async function forceDeleteNote(uuid: UUID): Promise<void> {
  await api.delete(`/notes/${uuid}`, { params: { force: 1 } })
}
export async function duplicateNote(uuid: UUID): Promise<Note> {
  const { data } = await api.post<{ data: Note }>(`/notes/${uuid}/duplicate`)
  return data.data
}
