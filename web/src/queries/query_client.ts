import { QueryClient } from '@tanstack/react-query'

import { type ApiError, normalizeError } from '@src/api/api_client'

declare module '@tanstack/react-query' {
  // The API client rejects every request with an ApiError.
  interface Register {
    defaultError: ApiError
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,
      refetchOnWindowFocus: false,
      // Never retry a client error: 403 and 422 will not succeed on a retry.
      retry:                (count: number, error: unknown): boolean => {
        const { status } = normalizeError(error)
        if (status >= 400 && status < 500) return false
        return count < 2
      },
    },
    mutations: { retry: false },
  },
})
