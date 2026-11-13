import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hostname, platform } from '@tauri-apps/plugin-os'
import { HttpStatusCode } from 'axios'

import { normalizeError } from '@src/api/api_client'
import * as authApi from '@src/api/auth_api'
import { AUTH_KEY, BOOTSTRAP_KEY, NOTES_KEY } from '@src/constants/query_keys'
import { clearAllDrafts } from '@src/db/drafts_store'
import { foldersRepo } from '@src/db/folders_repo'
import { notesRepo } from '@src/db/notes_repo'
import { tagsRepo } from '@src/db/tags_repo'
import { isNative } from '@src/platform/is_native'
import { deleteToken, loadToken, saveToken } from '@src/platform/secure_store'
import { useTabsStore } from '@src/stores/tabs_store'
import { useUiStore } from '@src/stores/ui_store'
import { syncEngine } from '@src/sync/engine'
import { outbox } from '@src/sync/outbox'
import type { User } from '@src/types/api'

export { AUTH_KEY }

export function useMe() {
  return useQuery<User | null>({
    queryKey: AUTH_KEY,
    queryFn:  async () => {
      try {
        if (isNative()) {
          const token = await loadToken()
          if (!token) return null
        }
        return await authApi.fetchMe()
      } catch (e) {
        // Signed out or expired token is a normal state, not an error the UI should surface.
        if (normalizeError(e).status === HttpStatusCode.Unauthorized) {
          if (isNative()) {
            await deleteToken()
          }
          return null
        }
        throw e
      }
    },
    staleTime: Infinity,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      if (isNative()) {
        const host = await hostname().catch(() => 'Desktop')
        let plat = 'desktop'
        try {
          plat = platform()
        } catch {
          // ignore
        }
        const token = await authApi.issueToken({
          ...creds,
          device_name: `${host ?? 'Device'} · ${plat}`,
        })
        await saveToken(token)
        const user = await authApi.fetchMe()
        useUiStore.getState().setScope({
          kind:      'all',
          container: 'cloud',
          label:     'All notes',
        })
        await syncEngine.run().catch(() => {})
        return user
      }

      return authApi.login(creds)
    },
    onSuccess: (user) => {
      useTabsStore.getState().closeAll()
      try {
        localStorage.removeItem('notes.tabs')
      } catch {
        // ignore
      }
      qc.setQueryData(AUTH_KEY, user)
      if (isNative()) {
        void qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
        void qc.invalidateQueries({ queryKey: NOTES_KEY })
      }
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (creds: {
      name:                  string
      email:                 string
      password:              string
      password_confirmation: string
    }) => {
      if (isNative()) {
        await authApi.register(creds)
        const host = await hostname().catch(() => 'Desktop')
        let plat = 'desktop'
        try {
          plat = platform()
        } catch {
          // ignore
        }
        const token = await authApi.issueToken({
          email:       creds.email,
          password:    creds.password,
          device_name: `${host ?? 'Device'} · ${plat}`,
        })
        await saveToken(token)
        const user = await authApi.fetchMe()
        useUiStore.getState().setScope({
          kind:      'all',
          container: 'cloud',
          label:     'All notes',
        })
        await syncEngine.run().catch(() => {})
        return user
      }

      return authApi.register(creds)
    },
    onSuccess: (user) => {
      useTabsStore.getState().closeAll()
      try {
        localStorage.removeItem('notes.tabs')
      } catch {
        // ignore
      }
      qc.setQueryData(AUTH_KEY, user)
      if (isNative()) {
        void qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
        void qc.invalidateQueries({ queryKey: NOTES_KEY })
      }
    },
  })
}


export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (isNative()) {
        try {
          await authApi.revokeToken()
        } finally {
          await deleteToken()
          await Promise.all([
            notesRepo.clearContainer('cloud'),
            foldersRepo.clearContainer('cloud'),
            tagsRepo.clearContainer('cloud'),
            outbox.clear(),
          ]).catch(() => {})
          const currentScope = useUiStore.getState().scope
          if (currentScope.container === 'cloud') {
            useUiStore.getState().setScope({
              kind:      'all',
              container: 'local',
              label:     'All notes',
            })
          }
        }
        return
      }

      return authApi.logout()
    },
    onSettled: async () => {
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
