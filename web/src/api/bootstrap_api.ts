import { API_ENDPOINTS } from '@src/constants/api_endpoints'
import type { IDataResponse } from '@src/types/api_response'
import type { IBootstrap, IBootstrapResponse, IFolderCount, ITagCount } from '@src/types/api'

import { api } from './api_client'



/** The counts come as lists; the sidebar and the optimistic updates look them up by uuid and slug. */
export async function fetchBootstrap(): Promise<IBootstrap> {
  const { data } = await api.get<IDataResponse<IBootstrapResponse>>(API_ENDPOINTS.BOOTSTRAP)
  const { counts, ...rest } = data.data
  return {
    ...rest,
    counts: {
      ...counts,
      folders: Object.fromEntries(counts.folders.map((folder: IFolderCount): [string, number] => [folder.uuid, folder.count])),
      tags:    Object.fromEntries(counts.tags.map((tag: ITagCount): [string, number] => [tag.slug, tag.count])),
    },
  }
}
