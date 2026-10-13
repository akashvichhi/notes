import type { SearchResults } from '@/types/api'

import { api } from './client'

export async function search(q: string, signal?: AbortSignal): Promise<SearchResults> {
  const { data } = await api.get<SearchResults>('/search', { params: { q }, signal })
  return data
}
