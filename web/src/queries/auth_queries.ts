import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { HttpStatusCode } from 'axios'

import { normalizeError } from '@src/api/api_client'
import type { IApiError } from '@src/api/api_client'
import * as authApi from '@src/api/auth_api'
import { AUTH_KEY } from '@src/constants/query_keys'
import { clearAllDrafts } from '@src/db/drafts_store'
import { useTabsStore } from '@src/stores/tabs_store'
import { useUiStore } from '@src/stores/ui_store'
import type { IUser } from '@src/types/api'
import type { ILoginCredentials, IRegisterCredentials } from '@src/types/auth'

export { AUTH_KEY }

export function useMe(): UseQueryResult<IUser | null, IApiError> {
  return useQuery<IUser | null>({
    queryKey: AUTH_KEY,
    queryFn:  async () => {
      try {
        return await authApi.fetchMe()
      } catch (e) {
        // Signed out or expired session is a normal state, not an error the UI should surface.
        if (normalizeError(e).status === HttpStatusCode.Unauthorized) {
          return null
        }
        throw e
      }
    },
    staleTime: Infinity,
  })
}

export function useLogin(): UseMutationResult<IUser, IApiError, ILoginCredentials> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.login,
    onSuccess:  (user: IUser) => {
      useTabsStore.getState().closeAll()
      try {
        localStorage.removeItem('notes.tabs')
      } catch {
        // ignore
      }
      qc.setQueryData(AUTH_KEY, user)
    },
  })
}

export function useRegister(): UseMutationResult<IUser, IApiError, IRegisterCredentials> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.register,
    onSuccess:  (user: IUser) => {
      useTabsStore.getState().closeAll()
      try {
        localStorage.removeItem('notes.tabs')
      } catch {
        // ignore
      }
      qc.setQueryData(AUTH_KEY, user)
    },
  })
}


export function useLogout(): UseMutationResult<void, IApiError, void, unknown> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.logout,
    onSettled:  async () => {
      useTabsStore.getState().closeAll()
      try {
        localStorage.removeItem('notes.tabs')
      } catch {
        // ignore
      }
      try {
        await clearAllDrafts()
      } catch {
        // ignore
      }
      useUiStore.getState().setFilter('')
      useUiStore.getState().setView('list')

      await qc.cancelQueries()
      qc.removeQueries()
      qc.clear()
      qc.setQueryData(AUTH_KEY, null)
    },
  })
}


export function useUpdateProfile(): UseMutationResult<IUser, IApiError, { name?: string; email?: string; }, unknown> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess:  (user: IUser) => {
      qc.setQueryData(AUTH_KEY, user)
    },
  })
}

export function useUpdatePassword(): UseMutationResult<void, IApiError, { currentPassword: string; password: string; passwordConfirmation: string; }, unknown> {
  return useMutation({
    mutationFn: authApi.updatePassword,
  })
}
