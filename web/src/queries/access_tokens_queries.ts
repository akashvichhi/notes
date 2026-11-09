import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as accessTokensApi from '@src/api/access_tokens_api'
import { ACCESS_TOKENS_KEY } from '@src/constants/query_keys'
import type { AccessToken } from '@src/types/api'

export function useAccessTokens() {
  return useQuery<AccessToken[]>({
    queryKey: ACCESS_TOKENS_KEY,
    queryFn:  accessTokensApi.fetchAccessTokens,
  })
}

export function useCreateAccessToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: accessTokensApi.createAccessToken,
    onSuccess:  ({ access_token }) => {
      qc.setQueryData<AccessToken[]>(ACCESS_TOKENS_KEY, (old) => [access_token, ...(old ?? [])])
    },
  })
}

export function useRevokeAccessToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: accessTokensApi.revokeAccessToken,
    onSuccess:  (_, id) => {
      qc.setQueryData<AccessToken[]>(ACCESS_TOKENS_KEY, (old) => (old ?? []).filter((t) => t.id !== id))
    },
  })
}
