import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult, UseQueryResult } from '@tanstack/react-query'

import * as accessTokensApi from '@src/api/access_tokens_api'
import type { IApiError } from '@src/api/api_client'
import { ACCESS_TOKENS_KEY } from '@src/constants/query_keys'
import type { IAccessToken, TAccessTokenAbility } from '@src/types/api'

export function useAccessTokens(): UseQueryResult<IAccessToken[], IApiError> {
  return useQuery<IAccessToken[]>({
    queryKey: ACCESS_TOKENS_KEY,
    queryFn:  accessTokensApi.fetchAccessTokens,
  })
}

export interface ICreateAccessTokenVars { name: string; abilities: TAccessTokenAbility[]; expiresInDays: number | null }
export interface ICreatedAccessToken { token: string; accessToken: IAccessToken }
export type TCreateAccessTokenMutation = UseMutationResult<ICreatedAccessToken, IApiError, ICreateAccessTokenVars>

export function useCreateAccessToken(): TCreateAccessTokenMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: accessTokensApi.createAccessToken,
    onSuccess:  ({ accessToken }: { token: string; accessToken: IAccessToken; }) => {
      qc.setQueryData<IAccessToken[]>(ACCESS_TOKENS_KEY, (old: NoInfer<IAccessToken[]> | undefined) => [accessToken, ...(old ?? [])])
    },
  })
}

export function useRevokeAccessToken(): UseMutationResult<void, IApiError, number, unknown> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: accessTokensApi.revokeAccessToken,
    onSuccess:  (_: void, id: number) => {
      qc.setQueryData<IAccessToken[]>(ACCESS_TOKENS_KEY, (old: NoInfer<IAccessToken[]> | undefined) => (old ?? []).filter((t: IAccessToken) => t.id !== id))
    },
  })
}
