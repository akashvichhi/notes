import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import * as foldersApi from '@src/api/folders_api'
import type { TNotesPage } from '@src/api/notes_api'
import { MESSAGES } from '@src/constants/messages'
import { BOOTSTRAP_KEY, NOTES_KEY } from '@src/constants/query_keys'
import type { IBootstrap, IFolder, INoteListItem, TUuid } from '@src/types/api'
import type { ISidebarItemContext } from '@src/types/mutation_context'
import { getFoldersArray } from '@src/utils/bootstrap_lists'
import { showErrorToast } from '@src/utils/notifications'

export interface IRenameFolderVars { uuid: string; name: string }
export type TRenameFolderMutation = UseMutationResult<IFolder, IApiError, IRenameFolderVars, ISidebarItemContext>
export type TDeleteFolderMutation = UseMutationResult<void, IApiError, string, ISidebarItemContext>

export function useCreateFolder(): UseMutationResult<IFolder, IApiError, { name: string; parentUuid?: TUuid; color?: string; uuid?: TUuid; }, { previous: IBootstrap | undefined; tempUuid: string; }> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; parentUuid?: TUuid; color?: string; uuid?: TUuid }) => {
      const uuid: string = payload.uuid || crypto.randomUUID()
      return foldersApi.createFolder({ ...payload, uuid })
    },
    onMutate: async (payload: { name: string; parentUuid?: TUuid; color?: string; uuid?: TUuid; }) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      const previous: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)
      const tempUuid: string = payload.uuid || crypto.randomUUID()
      payload.uuid = tempUuid

      const optimisticFolder: IFolder = {
        uuid:       tempUuid,
        name:       payload.name,
        color:      payload.color ?? null,
        position:   previous ? getFoldersArray(previous.folders).length : 0,
        parentUuid: payload.parentUuid ?? null,
      }

      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const current: IFolder[] = getFoldersArray(old.folders)
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
    onError: (_err: IApiError, _v: { name: string; parentUuid?: TUuid; color?: string; uuid?: TUuid; }, ctx: { previous: IBootstrap | undefined; tempUuid: string; } | undefined) => {
      if (ctx?.previous) qc.setQueryData(BOOTSTRAP_KEY, ctx.previous)
      showErrorToast(MESSAGES.FOLDER_CREATE_FAILED)
    },
    onSuccess: (realFolder: IFolder, _v: { name: string; parentUuid?: TUuid; color?: string; uuid?: TUuid; }, ctx: { previous: IBootstrap | undefined; tempUuid: string; }) => {
      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const current: IFolder[] = getFoldersArray(old.folders)
        return {
          ...old,
          folders: current.map((f: IFolder) => (f.uuid === ctx?.tempUuid ? realFolder : f)),
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
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)
      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })

      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const current: IFolder[] = getFoldersArray(old.folders)
        return {
          ...old,
          folders: current.map((f: IFolder) => (f.uuid === uuid ? { ...f, name } : f)),
        }
      })

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: TNotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: TNotesPage) => ({
            ...p,
            data: p.data.map((n: INoteListItem) =>
              n.folder?.uuid === uuid ? { ...n, folder: { ...n.folder, name } } : n
            ),
          })),
        }
      })

      return { prevBootstrap, prevNotes }
    },
    onError: (_err: IApiError, _v: { uuid: string; name: string }, ctx: ISidebarItemContext | undefined) => {
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
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)
      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })

      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const current: IFolder[] = getFoldersArray(old.folders)
        const nextFolderCounts: { [x: string]: number; } = { ...old.counts?.folders }
        delete nextFolderCounts[uuid]
        return {
          ...old,
          folders: current.filter((f: IFolder) => f.uuid !== uuid),
          counts:  {
            ...old.counts,
            folders: nextFolderCounts,
          },
        }
      })

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: TNotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: TNotesPage) => ({
            ...p,
            data: p.data.map((n: INoteListItem) =>
              n.folder?.uuid === uuid ? { ...n, folder: null } : n
            ),
          })),
        }
      })

      return { prevBootstrap, prevNotes }
    },
    onError: (_err: IApiError, _v: string, ctx: ISidebarItemContext | undefined) => {
      if (ctx?.prevBootstrap) qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      showErrorToast(MESSAGES.FOLDER_DELETE_FAILED)
    },
  })
}
