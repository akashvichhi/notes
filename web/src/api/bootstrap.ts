import type { Bootstrap } from '@/types/api'

import { api } from './client'

export async function fetchBootstrap(): Promise<Bootstrap> {
  const { data } = await api.get<Bootstrap>('/bootstrap')
  return data
}
