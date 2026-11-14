import { API_ENDPOINTS } from '@src/constants/api_endpoints'
import type { IAccessToken, ICreatedAccessToken, TAccessTokenAbility } from '@src/types/api'
import type { IDataResponse } from '@src/types/api_response'

import { api } from './api_client'



export async function fetchAccessTokens(): Promise<IAccessToken[]> {
  const { data } = await api.get<IDataResponse<IAccessToken[]>>(API_ENDPOINTS.ACCESS_TOKENS)
  return data.data
}

export async function createAccessToken(payload: {
  name:          string
  abilities:     TAccessTokenAbility[]
  expiresInDays: number | null
}): Promise<ICreatedAccessToken> {
  const { data } = await api.post<IDataResponse<ICreatedAccessToken>>(API_ENDPOINTS.ACCESS_TOKENS, payload)
  return data.data
}

export async function revokeAccessToken(id: number): Promise<void> {
  await api.delete(API_ENDPOINTS.accessTokenById(id))
}
