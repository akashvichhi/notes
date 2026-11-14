import { API_ENDPOINTS } from '@src/constants/api_endpoints'
import type { IFolder, TUuid } from '@src/types/api'
import type { IDataResponse } from '@src/types/api_response'

import { api } from './api_client'



export async function createFolder(payload: { name: string; parentUuid?: TUuid; color?: string; uuid?: TUuid }): Promise<IFolder> {
  const { data } = await api.post<IDataResponse<IFolder>>(API_ENDPOINTS.FOLDERS, payload)
  return data.data
}

export async function renameFolder(uuid: TUuid, name: string): Promise<IFolder> {
  const { data } = await api.patch<IDataResponse<IFolder>>(API_ENDPOINTS.folderByUuid(uuid), { name })
  return data.data
}

export async function deleteFolder(uuid: TUuid): Promise<void> {
  await api.delete(API_ENDPOINTS.folderByUuid(uuid))
}
