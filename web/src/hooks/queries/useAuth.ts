import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hostname, platform } from '@tauri-apps/plugin-os'

import * as authApi from '@/api/auth'
import { AUTH_KEY, BOOTSTRAP_KEY, NOTES_KEY } from '@/constants/queryKeys'
import { foldersRepo } from '@/db/foldersRepo'
import { notesRepo } from '@/db/notesRepo'
import { tagsRepo } from '@/db/tagsRepo'
import { clearAllDrafts } from '@/lib/drafts'
import { isNative } from '@/platform/isNative'
import { deleteToken, loadToken, saveToken } from '@/platform/secureStore'
import { useTabsStore } from '@/stores/tabsStore'
import { useUiStore } from '@/stores/uiStore'
import { syncEngine } from '@/sync/engine'
import { outbox } from '@/sync/outbox'
import type { User } from '@/types/api'

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
        if ((e as { response?: { status: number } })?.response?.status === 401) {
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
      name: string
      email: string
      password: string
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
