import type { Folder, UUID } from '@src/types/api'

import { api } from './api_client'



export async function createFolder(payload: { name: string; parent_uuid?: UUID; color?: string; uuid?: UUID }): Promise<Folder> {
  const { data } = await api.post<{ data: Folder }>('/folders', payload)
  return data.data
}

export async function renameFolder(uuid: UUID, name: string): Promise<Folder> {
  const { data } = await api.patch<{ data: Folder }>(`/folders/${uuid}`, { name })
  return data.data
}

export async function deleteFolder(uuid: UUID): Promise<void> {
  await api.delete(`/folders/${uuid}`)
}
