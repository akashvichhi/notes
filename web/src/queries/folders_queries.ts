import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult } from '@tanstack/react-query'

import type { ApiError } from '@src/api/api_client'
import * as foldersApi from '@src/api/folders_api'
import type { NotesPage } from '@src/api/notes_api'
import { ALL_NOTES_LABEL } from '@src/constants/labels'
import { MESSAGES } from '@src/constants/messages'
import { BOOTSTRAP_KEY, NOTES_KEY } from '@src/constants/query_keys'
import { useUiStore } from '@src/stores/ui_store'
import type { Scope } from '@src/stores/ui_store'
import type { Bootstrap, Folder, NoteListItem, UUID } from '@src/types/api'
import type { ISidebarItemContext } from '@src/types/mutation_context'
import { getFoldersArray } from '@src/utils/bootstrap_lists'
import { showErrorToast } from '@src/utils/notifications'

export interface IRenameFolderVars { uuid: string; name: string }
export type TRenameFolderMutation = UseMutationResult<Folder, ApiError, IRenameFolderVars, ISidebarItemContext>
export type TDeleteFolderMutation = UseMutationResult<void, ApiError, string, ISidebarItemContext>

export function useCreateFolder(): UseMutationResult<Folder, ApiError, { name: string; parent_uuid?: UUID; color?: string; uuid?: UUID; }, { previous: Bootstrap | undefined; tempUuid: string; }> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; parent_uuid?: UUID; color?: string; uuid?: UUID }) => {
      const uuid: string = payload.uuid || crypto.randomUUID()
      return foldersApi.createFolder({ ...payload, uuid })
    },
    onMutate: async (payload: { name: string; parent_uuid?: UUID; color?: string; uuid?: UUID; }) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      const previous: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const tempUuid: string = payload.uuid || crypto.randomUUID()
      payload.uuid = tempUuid

      const optimisticFolder: Folder = {
        uuid:        tempUuid,
        name:        payload.name,
        color:       payload.color ?? null,
        position:    previous ? getFoldersArray(previous.folders).length : 0,
        parent_uuid: payload.parent_uuid ?? null,
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const current: Folder[] = getFoldersArray(old.folders)
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
    onError: (_err: ApiError, _v: { name: string; parent_uuid?: UUID; color?: string; uuid?: UUID; }, ctx: { previous: Bootstrap | undefined; tempUuid: string; } | undefined) => {
      if (ctx?.previous) qc.setQueryData(BOOTSTRAP_KEY, ctx.previous)
      showErrorToast(MESSAGES.FOLDER_CREATE_FAILED)
    },
    onSuccess: (realFolder: Folder, _v: { name: string; parent_uuid?: UUID; color?: string; uuid?: UUID; }, ctx: { previous: Bootstrap | undefined; tempUuid: string; }) => {
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const current: Folder[] = getFoldersArray(old.folders)
        return {
          ...old,
          folders: current.map((f: Folder) => (f.uuid === ctx?.tempUuid ? realFolder : f)),
        }
      })
    },
  })
}

export function useRenameFolder(): TRenameFolderMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) =>
      foldersApi.renameFolder(uuid, name),
    onMutate: async ({ uuid, name }: { uuid: string; name: string; }) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })

      const currentScope: Scope = useUiStore.getState().scope
      const wasActiveScope: boolean = currentScope.kind === 'folder' && currentScope.uuid === uuid
      const prevScope: Scope | null = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'folder', uuid, label: name })
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const current: Folder[] = getFoldersArray(old.folders)
        return {
          ...old,
          folders: current.map((f: Folder) => (f.uuid === uuid ? { ...f, name } : f)),
        }
      })

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: NotesPage) => ({
            ...p,
            data: p.data.map((n: NoteListItem) =>
              n.folder?.uuid === uuid ? { ...n, folder: { ...n.folder, name } } : n
            ),
          })),
        }
      })

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err: ApiError, _v: { uuid: string; name: string }, ctx: ISidebarItemContext | undefined) => {
      if (ctx?.prevScope) {
        useUiStore.getState().setScope(ctx.prevScope)
      }
      if (ctx?.prevBootstrap) qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      showErrorToast(MESSAGES.FOLDER_RENAME_FAILED)
    },
  })
}

export function useDeleteFolder(): TDeleteFolderMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: foldersApi.deleteFolder,
    onMutate:   async (uuid: string) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })

      const currentScope: Scope = useUiStore.getState().scope
      const wasActiveScope: boolean = currentScope.kind === 'folder' && currentScope.uuid === uuid
      const prevScope: Scope | null = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'all', label: ALL_NOTES_LABEL })
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const current: Folder[] = getFoldersArray(old.folders)
        const nextFolderCounts: { [x: string]: number; } = { ...old.counts?.folders }
        delete nextFolderCounts[uuid]
        return {
          ...old,
          folders: current.filter((f: Folder) => f.uuid !== uuid),
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
          pages: old.pages.map((p: NotesPage) => ({
            ...p,
            data: p.data.map((n: NoteListItem) =>
              n.folder?.uuid === uuid ? { ...n, folder: null } : n
            ),
          })),
        }
      })

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err: ApiError, _v: string, ctx: ISidebarItemContext | undefined) => {
      if (ctx?.prevScope) {
        useUiStore.getState().setScope(ctx.prevScope)
      }
      if (ctx?.prevBootstrap) qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      showErrorToast(MESSAGES.FOLDER_DELETE_FAILED)
    },
  })
}
