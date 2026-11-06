import type { AccessToken, AccessTokenAbility } from '@/types/api'

import { api } from './client'

export async function fetchAccessTokens(): Promise<AccessToken[]> {
  const { data } = await api.get<{ data: AccessToken[] }>('/me/access-tokens')
  return data.data
}

export async function createAccessToken(payload: {
  name: string
  abilities: AccessTokenAbility[]
  expires_in_days: number | null
}): Promise<{ token: string; access_token: AccessToken }> {
  const { data } = await api.post<{ token: string; access_token: AccessToken }>('/me/access-tokens', payload)
  return data
}

export async function revokeAccessToken(id: number): Promise<void> {
  await api.delete(`/me/access-tokens/${id}`)
}
