import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,
      refetchOnWindowFocus: false,
      // Never retry a client error: 403 and 422 will not succeed on a retry.
      retry:                (count, error: unknown) => {
        const status = (error as { response?: { status: number } })?.response?.status ?? 0
        if (status >= 400 && status < 500) return false
        return count < 2
      },
    },
    mutations: { retry: false },
  },
})
