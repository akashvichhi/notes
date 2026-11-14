import { API_ENDPOINTS } from '@src/constants/api_endpoints'
import type { ITag, TUuid } from '@src/types/api'
import type { IDataResponse } from '@src/types/api_response'

import { api } from './api_client'



export async function createTag(payload: { name: string; uuid?: TUuid }): Promise<ITag> {
  const { data } = await api.post<IDataResponse<ITag>>(API_ENDPOINTS.TAGS, payload)
  return data.data
}

export async function renameTag(uuid: TUuid, name: string): Promise<ITag> {
  const { data } = await api.patch<IDataResponse<ITag>>(API_ENDPOINTS.tagByUuid(uuid), { name })
  return data.data
}

export async function deleteTag(uuid: TUuid): Promise<void> {
  await api.delete(API_ENDPOINTS.tagByUuid(uuid))
}
