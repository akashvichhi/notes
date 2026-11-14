import type { ITag, TUuid } from '@src/types/api'

import { api } from './api_client'



export async function createTag(payload: { name: string; uuid?: TUuid }): Promise<ITag> {
  const { data } = await api.post<{ data: ITag }>('/tags', payload)
  return data.data
}

export async function renameTag(uuid: TUuid, name: string): Promise<ITag> {
  const { data } = await api.patch<{ data: ITag }>(`/tags/${uuid}`, { name })
  return data.data
}

export async function deleteTag(uuid: TUuid): Promise<void> {
  await api.delete(`/tags/${uuid}`)
}
