import type { IAccessToken, TAccessTokenAbility } from '@src/types/api'

import { api } from './api_client'



export async function fetchAccessTokens(): Promise<IAccessToken[]> {
  const { data } = await api.get<{ data: IAccessToken[] }>('/me/access-tokens')
  return data.data
}

export async function createAccessToken(payload: {
  name:            string
  abilities:       TAccessTokenAbility[]
  expires_in_days: number | null
}): Promise<{ token: string; access_token: IAccessToken }> {
  const { data } = await api.post<{ token: string; access_token: IAccessToken }>('/me/access-tokens', payload)
  return data
}

export async function revokeAccessToken(id: number): Promise<void> {
  await api.delete(`/me/access-tokens/${id}`)
}
