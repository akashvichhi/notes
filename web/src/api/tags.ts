import type { Tag, UUID } from '@/types/api'

import { api } from './client'

export async function createTag(payload: { name: string; uuid?: UUID }): Promise<Tag> {
  const { data } = await api.post<{ data: Tag }>('/tags', payload)
  return data.data
}

export async function renameTag(uuid: UUID, name: string): Promise<Tag> {
  const { data } = await api.patch<{ data: Tag }>(`/tags/${uuid}`, { name })
  return data.data
}

export async function deleteTag(uuid: UUID): Promise<void> {
  await api.delete(`/tags/${uuid}`)
}
