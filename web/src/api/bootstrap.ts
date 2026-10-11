import { api } from './client'
import type { Bootstrap } from '@/types/api'

export async function fetchBootstrap(): Promise<Bootstrap> {
  const { data } = await api.get<Bootstrap>('/bootstrap')
  return data
}
