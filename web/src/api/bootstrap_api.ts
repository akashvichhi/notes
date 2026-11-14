import type { IBootstrap } from '@src/types/api'

import { api } from './api_client'



export async function fetchBootstrap(): Promise<IBootstrap> {
  const { data } = await api.get<IBootstrap>('/bootstrap')
  return data
}
