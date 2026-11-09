import type { Bootstrap } from '@src/types/api'

import { api } from './api_client'



export async function fetchBootstrap(): Promise<Bootstrap> {
  const { data } = await api.get<Bootstrap>('/bootstrap')
  return data
}
