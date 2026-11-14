import { API_ENDPOINTS } from '@src/constants/api_endpoints'
import type { IDataResponse } from '@src/types/api_response'
import type { ISearchResults } from '@src/types/api'

import { api } from './api_client'



export async function search(q: string, signal?: AbortSignal): Promise<ISearchResults> {
  const { data } = await api.get<IDataResponse<ISearchResults>>(API_ENDPOINTS.SEARCH, { params: { q }, signal })
  return data.data
}
