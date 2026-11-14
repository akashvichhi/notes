import type { ISearchResults } from '@src/types/api'

import { api } from './api_client'



export async function search(q: string, signal?: AbortSignal): Promise<ISearchResults> {
  const { data } = await api.get<ISearchResults>('/search', { params: { q }, signal })
  return data
}
