import { api } from './client'
import type { SearchResults } from '@/types/api'

export async function search(q: string, signal?: AbortSignal): Promise<SearchResults> {
  const { data } = await api.get<SearchResults>('/search', { params: { q }, signal })
  return data
}
