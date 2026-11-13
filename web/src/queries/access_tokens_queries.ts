import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult, UseQueryResult } from '@tanstack/react-query'

import * as accessTokensApi from '@src/api/access_tokens_api'
import type { ApiError } from '@src/api/api_client'
import { ACCESS_TOKENS_KEY } from '@src/constants/query_keys'
import type { AccessToken, AccessTokenAbility } from '@src/types/api'

export function useAccessTokens(): UseQueryResult<AccessToken[], ApiError> {
  return useQuery<AccessToken[]>({
    queryKey: ACCESS_TOKENS_KEY,
    queryFn:  accessTokensApi.fetchAccessTokens,
  })
}

export interface ICreateAccessTokenVars { name: string; abilities: AccessTokenAbility[]; expires_in_days: number | null }
export interface ICreatedAccessToken { token: string; access_token: AccessToken }
export type TCreateAccessTokenMutation = UseMutationResult<ICreatedAccessToken, ApiError, ICreateAccessTokenVars>

export function useCreateAccessToken(): TCreateAccessTokenMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: accessTokensApi.createAccessToken,
    onSuccess:  ({ access_token }: { token: string; access_token: AccessToken; }) => {
      qc.setQueryData<AccessToken[]>(ACCESS_TOKENS_KEY, (old: NoInfer<AccessToken[]> | undefined) => [access_token, ...(old ?? [])])
    },
  })
}

export function useRevokeAccessToken(): UseMutationResult<void, ApiError, number, unknown> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: accessTokensApi.revokeAccessToken,
    onSuccess:  (_: void, id: number) => {
      qc.setQueryData<AccessToken[]>(ACCESS_TOKENS_KEY, (old: NoInfer<AccessToken[]> | undefined) => (old ?? []).filter((t: AccessToken) => t.id !== id))
    },
  })
}
