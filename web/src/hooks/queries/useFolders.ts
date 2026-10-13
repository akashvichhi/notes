import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import * as foldersApi from '@/api/folders'
import type { NotesPage } from '@/api/notes'
import { useUiStore } from '@/stores/uiStore'
import type { Bootstrap, Folder, NoteListItem, UUID } from '@/types/api'

import { BOOTSTRAP_KEY } from './useBootstrap'
import { NOTES_KEY } from './useNotes'

function getFoldersArray(folders: Bootstrap['folders'] | undefined): Folder[] {
  if (!folders) return []
  return Array.isArray(folders) ? folders : (folders.data ?? [])
}

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; parent_uuid?: UUID; color?: string; uuid?: UUID }) => {
      const uuid = payload.uuid || crypto.randomUUID()
      return foldersApi.createFolder({ ...payload, uuid })
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      const previous = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const tempUuid = payload.uuid || crypto.randomUUID()
      payload.uuid = tempUuid

      const optimisticFolder: Folder = {
        uuid:        tempUuid,
        name:        payload.name,
        color:       payload.color ?? null,
        position:    previous ? getFoldersArray(previous.folders).length : 0,
        parent_uuid: payload.parent_uuid ?? null,
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const current = getFoldersArray(old.folders)
        return {
          ...old,
          folders: [...current, optimisticFolder],
          counts:  {
            ...old.counts,
            folders: {
              ...old.counts?.folders,
              [tempUuid]: 0,
            },
          },
        }
      })

      return { previous, tempUuid }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(BOOTSTRAP_KEY, ctx.previous)
      notifications.show({ color: 'red', message: "Couldn't create folder." })
    },
    onSuccess: (realFolder, _v, ctx) => {
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const current = getFoldersArray(old.folders)
        return {
          ...old,
          folders: current.map((f) => (f.uuid === ctx?.tempUuid ? realFolder : f)),
        }
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useRenameFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) =>
      foldersApi.renameFolder(uuid, name),
    onMutate: async ({ uuid, name }) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })

      const currentScope = useUiStore.getState().scope
      const wasActiveScope = currentScope.kind === 'folder' && currentScope.uuid === uuid
      const prevScope = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'folder', uuid, label: name })
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const current = getFoldersArray(old.folders)
        return {
          ...old,
          folders: current.map((f) => (f.uuid === uuid ? { ...f, name } : f)),
        }
      })

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.map((n: NoteListItem) =>
              n.folder?.uuid === uuid ? { ...n, folder: { ...n.folder, name } } : n
            ),
          })),
        }
      })

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prevScope) {
        useUiStore.getState().setScope(ctx.prevScope)
      }
      if (ctx?.prevBootstrap) qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      notifications.show({ color: 'red', message: "Couldn't rename folder." })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
    },
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: foldersApi.deleteFolder,
    onMutate:   async (uuid: string) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })

      const currentScope = useUiStore.getState().scope
      const wasActiveScope = currentScope.kind === 'folder' && currentScope.uuid === uuid
      const prevScope = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'all', label: 'All notes' })
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const current = getFoldersArray(old.folders)
        const nextFolderCounts = { ...old.counts?.folders }
        delete nextFolderCounts[uuid]
        return {
          ...old,
          folders: current.filter((f) => f.uuid !== uuid),
          counts:  {
            ...old.counts,
            folders: nextFolderCounts,
          },
        }
      })

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.map((n: NoteListItem) =>
              n.folder?.uuid === uuid ? { ...n, folder: null } : n
            ),
          })),
        }
      })

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prevScope) {
        useUiStore.getState().setScope(ctx.prevScope)
      }
      if (ctx?.prevBootstrap) qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      notifications.show({ color: 'red', message: "Couldn't delete folder." })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
    },
  })
}
