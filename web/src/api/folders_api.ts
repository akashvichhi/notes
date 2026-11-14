import type { IFolder, TUuid } from '@src/types/api'

import { api } from './api_client'



export async function createFolder(payload: { name: string; parent_uuid?: TUuid; color?: string; uuid?: TUuid }): Promise<IFolder> {
  const { data } = await api.post<{ data: IFolder }>('/folders', payload)
  return data.data
}

export async function renameFolder(uuid: TUuid, name: string): Promise<IFolder> {
  const { data } = await api.patch<{ data: IFolder }>(`/folders/${uuid}`, { name })
  return data.data
}

export async function deleteFolder(uuid: TUuid): Promise<void> {
  await api.delete(`/folders/${uuid}`)
}
