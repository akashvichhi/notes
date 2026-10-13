import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as authApi from '@/api/auth'
import type { User } from '@/types/api'

export const AUTH_KEY = ['me'] as const

export function useMe() {
  return useQuery<User | null>({
    queryKey: AUTH_KEY,
    queryFn:  async () => {
      try {
        return await authApi.fetchMe()
      } catch (e) {
        // Signed out is a normal state, not an error the UI should surface.
        if ((e as { response?: { status: number } })?.response?.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.login,
    onSuccess:  (user) => qc.setQueryData(AUTH_KEY, user),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.register,
    onSuccess:  (user) => qc.setQueryData(AUTH_KEY, user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess:  () => {
      qc.setQueryData(AUTH_KEY, null)
      qc.clear()
    },
    onError: () => {
      qc.setQueryData(AUTH_KEY, null)
      qc.clear()
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess:  (user) => {
      qc.setQueryData(AUTH_KEY, user)
    },
  })
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: authApi.updatePassword,
  })
}
