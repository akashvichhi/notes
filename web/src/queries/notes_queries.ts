import { type InfiniteData, type QueryClient, useInfiniteQuery, type UseInfiniteQueryResult, useMutation, type UseMutationResult, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { HttpStatusCode } from 'axios'

import { normalizeError } from '@src/api/api_client'
import type { IApiError } from '@src/api/api_client'
import * as notesApi from '@src/api/notes_api'
import { COPY_NOTE_SUFFIX, DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import { MESSAGES } from '@src/constants/messages'
import { BOOTSTRAP_KEY, NOTE_KEY, NOTES_KEY, queryKeys } from '@src/constants/query_keys'
import { useTabsStore } from '@src/stores/tabs_store'
import type { ITabsState } from '@src/stores/tabs_store'
import type { TScope } from '@src/stores/ui_store'
import type { IBootstrap, IFolder, INote, INoteListItem, ITag, TUuid } from '@src/types/api'
import type {
  ICreateNoteContext, IDuplicateNoteContext, INoteEditContext, INoteListContext, INoteTagsContext, IRenameNoteContext,
} from '@src/types/mutation_context'
import { getFoldersArray, getTagsArray } from '@src/utils/bootstrap_lists'
import { showErrorToast } from '@src/utils/notifications'
import { slugify } from '@src/utils/slugify'

export interface IStarNoteVars { uuid: string; isStarred: boolean }
export interface IRenameNoteVars { uuid: string; title: string }
export interface ICreateNoteVars { folderId?: TUuid; uuid?: TUuid }
export interface INoteTagsVars { uuid: TUuid; names: string[] }
export interface IMoveNoteVars { uuid: TUuid; folderId: TUuid | null }

export type TStarNoteMutation = UseMutationResult<INote | null, IApiError, IStarNoteVars, INoteEditContext>
export type TRenameNoteMutation = UseMutationResult<INote | null, IApiError, IRenameNoteVars, IRenameNoteContext>
export type TCreateNoteMutation = UseMutationResult<INote, IApiError, ICreateNoteVars, ICreateNoteContext>
export type TDuplicateNoteMutation = UseMutationResult<INote, IApiError, string, IDuplicateNoteContext | undefined>
export type TNoteTagsMutation = UseMutationResult<unknown, IApiError, INoteTagsVars, INoteTagsContext>
/** Trash, restore and permanent delete. */
export type TNoteListMutation = UseMutationResult<void, IApiError, string, INoteListContext>
export type TMoveNoteMutation = UseMutationResult<unknown, IApiError, IMoveNoteVars, INoteEditContext>

export { NOTE_KEY, NOTES_KEY }

export function useNote(uuid?: TUuid | null): UseQueryResult<INote | null, IApiError> {
  const closeTab: (uuid: TUuid) => void = useTabsStore((s: ITabsState) => s.close)

  return useQuery({
    queryKey: queryKeys.notes.detail(uuid),
    queryFn:  async () => {
      if (!uuid) return null

      try {
        return await notesApi.fetchNote(uuid)
      } catch (err: unknown) {
        if (normalizeError(err).status === HttpStatusCode.NotFound) {
          closeTab(uuid)
          return null
        }
        throw err
      }
    },
    enabled:        Boolean(uuid),
    staleTime:      0,
    refetchOnMount: 'always',
    retry:          (failureCount: number, err: IApiError) => {
      if (normalizeError(err).status === HttpStatusCode.NotFound) {
        return false
      }
      return failureCount < 2
    },
  })
}

function scopeParams(scope: TScope): Record<string, string | undefined> {
  switch (scope.kind) {
    case 'folder': return { folderId: scope.uuid }
    case 'tag': return { tag: scope.slug }
    case 'starred': return { starred: '1' }
    case 'trash': return { trashed: '1' }
    case 'search': return { q: scope.q }
    default: return {}
  }
}

function scopeKey(scope: TScope): string {
  switch (scope.kind) {
    case 'folder': return `folder:${scope.uuid}`
    case 'tag': return `tag:${scope.slug}`
    case 'starred': return 'starred'
    case 'trash': return 'trash'
    case 'search': return `search:${scope.q}`
    default: return 'all'
  }
}

export function useNotes(scope: TScope): UseInfiniteQueryResult<InfiniteData<notesApi.TNotesPage, unknown>, IApiError> {
  return useInfiniteQuery({
    queryKey: queryKeys.notes.list(scopeKey(scope)),
    queryFn:  async ({ pageParam }: { pageParam: number }) => {
      return notesApi.fetchNotes({
        ...scopeParams(scope),
        page: pageParam ? String(pageParam) : undefined,
      })
    },
    initialPageParam: 1,
    getNextPageParam: (last: notesApi.TNotesPage) =>
      last.meta.currentPage < last.meta.totalPages
        ? last.meta.currentPage + 1
        : undefined,
    staleTime: Infinity,
  })
}

/** Optimistic star: update list, single note, and sidebar counts immediately */
export function useStarNote(_scope?: TScope): TStarNoteMutation {
  const qc: QueryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ uuid, isStarred }: { uuid: string; isStarred: boolean }) => {
      return notesApi.patchNote(uuid, { isStarred })
    },
    onMutate: async ({ uuid, isStarred }: { uuid: string; isStarred: boolean; }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote: INote | undefined = qc.getQueryData<INote>(queryKeys.notes.detail(uuid))
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)

      // 1. Update all cached note lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.TNotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.TNotesPage) => ({
            ...p,
            data: p.data.map((n: INoteListItem) => (n.uuid === uuid ? { ...n, isStarred } : n)),
          })),
        }
      })

      // 2. Update single note query if open
      if (prevSingleNote) {
        qc.setQueryData<INote>(queryKeys.notes.detail(uuid), { ...prevSingleNote, isStarred })
      }

      // 3. Update the sidebar's starred count
      const delta: 1 | -1 = isStarred ? 1 : -1
      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const currentStarred: number = old.counts?.starred ?? 0
        return {
          ...old,
          counts: {
            ...old.counts,
            starred: Math.max(0, currentStarred + delta),
          },
        }
      })

      return { prevNotes, prevSingleNote, prevBootstrap }
    },
    onError: (_e: IApiError, { uuid }: IStarNoteVars, ctx: INoteEditContext | undefined) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevSingleNote) {
        qc.setQueryData(queryKeys.notes.detail(uuid), ctx.prevSingleNote)
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_UPDATE_FAILED)
    },
    onSettled: (_data: INote | null | undefined, _err: IApiError | null, { uuid }: { uuid: string; isStarred: boolean; }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useRenameNote(): TRenameNoteMutation {
  const qc: QueryClient = useQueryClient()
  const setTitle: (uuid: TUuid, title: string) => void = useTabsStore((s: ITabsState) => s.setTitle)

  return useMutation({
    mutationFn: async ({ uuid, title }: { uuid: string; title: string }) => {
      return notesApi.patchNote(uuid, { title })
    },
    onMutate: async ({ uuid, title }: { uuid: string; title: string; }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote: INote | undefined = qc.getQueryData<INote>(queryKeys.notes.detail(uuid))
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)

      // 1. Instantly update tab title in UI
      setTitle(uuid, title || DEFAULT_NOTE_TITLE)

      // 2. Instantly update note lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.TNotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.TNotesPage) => ({
            ...p,
            data: p.data.map((n: INoteListItem) => (n.uuid === uuid ? { ...n, title } : n)),
          })),
        }
      })

      // 3. Instantly update single note query
      if (prevSingleNote) {
        qc.setQueryData<INote>(queryKeys.notes.detail(uuid), { ...prevSingleNote, title })
      }

      return { prevNotes, prevSingleNote, prevBootstrap }
    },
    onError: (_err: IApiError, { uuid }: { uuid: string; title: string; }, ctx: { prevNotes: [readonly unknown[], unknown][]; prevSingleNote: INote | undefined; prevBootstrap: IBootstrap | undefined; } | undefined) => {
      if (ctx?.prevSingleNote) {
        setTitle(uuid, ctx.prevSingleNote.title || DEFAULT_NOTE_TITLE)
        qc.setQueryData(queryKeys.notes.detail(uuid), ctx.prevSingleNote)
      }
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_RENAME_FAILED)
    },
    onSettled: (_data: INote | null | undefined, _err: IApiError | null, { uuid }: { uuid: string; title: string; }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useCreateNote(): TCreateNoteMutation {
  const qc: QueryClient = useQueryClient()
  const openTab: (uuid: TUuid, title: string) => void = useTabsStore((s: ITabsState) => s.open)

  return useMutation({
    mutationFn: async (payload: ICreateNoteVars) => {
      const uuid: string = payload.uuid || crypto.randomUUID()
      return notesApi.createNote({ ...payload, uuid })
    },
    onMutate: async (payload: ICreateNoteVars) => {
      const uuid: string = payload.uuid || crypto.randomUUID()
      payload.uuid = uuid

      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)

      // 1. Open tab immediately
      openTab(uuid, DEFAULT_NOTE_TITLE)

      // 2. Populate single note cache optimistically
      let currentFolder: { uuid: TUuid; name: string } | null = null
      if (payload.folderId) {
        const foldersList: IFolder[] = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
        const found: IFolder | undefined = foldersList.find((f: IFolder) => f.uuid === payload.folderId)
        currentFolder = found ? { uuid: found.uuid, name: found.name } : null
      }

      const optimisticNote: INote = {
        uuid,
        title:       DEFAULT_NOTE_TITLE,
        titleLocked: false,
        body:        { type: 'doc', content: [] },
        excerpt:     '',
        isStarred:   false,
        version:     1,
        wordCount:   0,
        folder:      currentFolder,
        tags:        [],
        updatedAt:   new Date().toISOString(),
        deletedAt:   null,
      }
      qc.setQueryData(queryKeys.notes.detail(uuid), optimisticNote)

      // 3. Prepend to note list queries
      const optimisticListItem: INoteListItem = {
        uuid,
        title:     DEFAULT_NOTE_TITLE,
        excerpt:   '',
        isStarred: false,
        folder:    currentFolder,
        tags:      [],
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.TNotesPage[] } | undefined) => {
        if (!old?.pages?.length || !old.pages[0]) return old
        const first: notesApi.TNotesPage = old.pages[0]
        return {
          ...old,
          pages: [
            {
              ...first,
              data: [optimisticListItem, ...first.data],
              meta: {
                ...first.meta,
                totalCount: (first.meta?.totalCount ?? 0) + 1,
              },
            },
            ...old.pages.slice(1),
          ],
        }
      })

      // 4. Update sidebar counts
      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        return {
          ...old,
          counts: {
            ...old.counts,
            all:     (old.counts?.all ?? 0) + 1,
            folders: payload.folderId
              ? {
                ...old.counts?.folders,
                [payload.folderId]: (old.counts?.folders?.[payload.folderId] ?? 0) + 1,
              }
              : old.counts?.folders,
          },
        }
      })

      return { prevNotes, prevBootstrap, uuid }
    },
    onError: (_err: IApiError, _v: ICreateNoteVars, ctx: ICreateNoteContext | undefined) => {
      if (ctx?.uuid) {
        useTabsStore.getState().close(ctx.uuid)
      }
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_CREATE_FAILED)
    },
    onSuccess: (newNote: INote) => {
      qc.setQueryData(queryKeys.notes.detail(newNote.uuid), newNote)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useTrashNote(): TNoteListMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: async (uuid: string) => {
      return notesApi.trashNote(uuid)
    },
    onMutate: async (uuid: string) => {
      // Close open tab immediately
      useTabsStore.getState().close(uuid)

      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)

      // Find note in cached pages to get starred / folder info
      let trashedItem: INoteListItem | undefined
      for (const [, queryData] of prevNotes) {
        const pagesData: { pages?: notesApi.TNotesPage[]; } = queryData as { pages?: notesApi.TNotesPage[] }
        const item: INoteListItem | undefined = pagesData?.pages?.flatMap((p: notesApi.TNotesPage) => p.data).find((n: INoteListItem) => n.uuid === uuid)
        if (item) {
          trashedItem = item
          break
        }
      }

      // Remove from non-trash lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.TNotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.TNotesPage) => ({
            ...p,
            data: p.data.filter((n: INoteListItem) => n.uuid !== uuid),
          })),
        }
      })

      // Update sidebar counts

      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const nextFolderCounts: { [x: string]: number; } = { ...old.counts?.folders }
        const folderUuid: string | undefined = trashedItem?.folder?.uuid
        if (folderUuid && nextFolderCounts[folderUuid] !== undefined) {
          nextFolderCounts[folderUuid] = Math.max(0, nextFolderCounts[folderUuid] - 1)
        }
        return {
          ...old,
          counts: {
            ...old.counts,
            all:     Math.max(0, (old.counts?.all ?? 1) - 1),
            trashed: (old.counts?.trashed ?? 0) + 1,
            starred: trashedItem?.isStarred ? Math.max(0, (old.counts?.starred ?? 1) - 1) : (old.counts?.starred ?? 0),
            folders: nextFolderCounts,
          },
        }
      })

      return { prevNotes, prevBootstrap }
    },
    onError: (_err: IApiError, _v: string, ctx: INoteListContext | undefined | undefined) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_TRASH_FAILED)
    },
    onSettled: (_data: void | undefined, _err: IApiError | null, uuid: string) => {
      qc.removeQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useRestoreNote(): TNoteListMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: async (uuid: string) => {
      return notesApi.restoreNote(uuid)
    },
    onMutate: async (uuid: string) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)

      // Remove from trash list
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.TNotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.TNotesPage) => ({
            ...p,
            data: p.data.filter((n: INoteListItem) => n.uuid !== uuid),
          })),
        }
      })

      // Update sidebar counts

      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        return {
          ...old,
          counts: {
            ...old.counts,
            trashed: Math.max(0, (old.counts?.trashed ?? 1) - 1),
            all:     (old.counts?.all ?? 0) + 1,
          },
        }
      })

      return { prevNotes, prevBootstrap }
    },
    onError: (_err: IApiError, _v: string, ctx: INoteListContext | undefined | undefined) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_RESTORE_FAILED)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useForceDeleteNote(): TNoteListMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: async (uuid: string) => {
      return notesApi.forceDeleteNote(uuid)
    },
    onMutate: async (uuid: string) => {
      // Close open tab immediately
      useTabsStore.getState().close(uuid)

      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.TNotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.TNotesPage) => ({
            ...p,
            data: p.data.filter((n: INoteListItem) => n.uuid !== uuid),
          })),
        }
      })

      // Update sidebar counts

      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        return {
          ...old,
          counts: {
            ...old.counts,
            trashed: Math.max(0, (old.counts?.trashed ?? 1) - 1),
          },
        }
      })

      return { prevNotes, prevBootstrap }
    },
    onError: (_err: IApiError, _v: string, ctx: INoteListContext | undefined | undefined) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_DELETE_FAILED)
    },
    onSettled: (_data: void | undefined, _err: IApiError | null, uuid: string) => {
      qc.removeQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useDuplicateNote(): TDuplicateNoteMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sourceUuid: string) => {
      return notesApi.duplicateNote(sourceUuid)
    },
    onMutate: async (sourceUuid: string) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)
      const prevSingle: INote | undefined = qc.getQueryData<INote>(queryKeys.notes.detail(sourceUuid))

      // Find the source note in cached queries if not in single query
      let sourceItem: INoteListItem | INote | undefined = prevSingle
      if (!sourceItem && prevNotes) {
        for (const [, data] of prevNotes) {
          const pages: notesApi.TNotesPage[] | undefined = (data as { pages?: notesApi.TNotesPage[] })?.pages
          if (pages) {
            for (const page of pages) {
              const found: INoteListItem | undefined = page.data.find((n: INoteListItem) => n.uuid === sourceUuid)
              if (found) {
                sourceItem = found
                break
              }
            }
          }
          if (sourceItem) break
        }
      }

      const tempUuid: `${string}-${string}-${string}-${string}-${string}` = crypto.randomUUID()
      const title: string = sourceItem
        ? (sourceItem.title === '' ? '' : `${sourceItem.title}${COPY_NOTE_SUFFIX}`)
        : `${DEFAULT_NOTE_TITLE}${COPY_NOTE_SUFFIX}`
      const folder: { uuid: TUuid; name: string; } | null = sourceItem?.folder ?? null
      const tags: string[] = sourceItem?.tags ?? []
      const excerpt: string = sourceItem?.excerpt ?? ''

      const optimisticListItem: INoteListItem = {
        uuid:      tempUuid,
        title,
        excerpt,
        isStarred: false,
        folder,
        tags,
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }

      // If we have single note data for the source note, also pre-populate single note query
      if (prevSingle) {
        const optimisticNote: INote = {
          ...prevSingle,
          uuid:        tempUuid,
          title,
          version:     1,
          titleLocked: sourceItem ? sourceItem.title !== '' : true,
          updatedAt:   new Date().toISOString(),
          deletedAt:   null,
        }
        qc.setQueryData(queryKeys.notes.detail(tempUuid), optimisticNote)
      }

      // Prepend to note list queries
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.TNotesPage[] } | undefined) => {
        if (!old?.pages?.length || !old.pages[0]) return old
        const first: notesApi.TNotesPage = old.pages[0]
        return {
          ...old,
          pages: [
            {
              ...first,
              data: [optimisticListItem, ...first.data],
              meta: {
                ...first.meta,
                totalCount: (first.meta?.totalCount ?? 0) + 1,
              },
            },
            ...old.pages.slice(1),
          ],
        }
      })

      // Update sidebar counts
      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        return {
          ...old,
          counts: {
            ...old.counts,
            all:     (old.counts?.all ?? 0) + 1,
            folders: folder?.uuid
              ? {
                ...old.counts?.folders,
                [folder.uuid]: (old.counts?.folders?.[folder.uuid] ?? 0) + 1,
              }
              : old.counts?.folders,
          },
        }
      })

      return { prevNotes, prevBootstrap, tempUuid }
    },
    onError: (_err: IApiError, _v: string, ctx: IDuplicateNoteContext | undefined) => {
      if (ctx?.tempUuid) {
        qc.removeQueries({ queryKey: queryKeys.notes.detail(ctx.tempUuid) })
      }
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_DUPLICATE_FAILED)
    },
    onSuccess: (realNote: INote, _v: string, ctx: IDuplicateNoteContext | undefined) => {
      qc.setQueryData(queryKeys.notes.detail(realNote.uuid), realNote)
      if (ctx?.tempUuid) {
        qc.removeQueries({ queryKey: queryKeys.notes.detail(ctx.tempUuid) })
        qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.TNotesPage[] } | undefined) => {
          if (!old?.pages?.length) return old
          return {
            ...old,
            pages: old.pages.map((p: notesApi.TNotesPage) => ({
              ...p,
              data: p.data.map((n: INoteListItem) => (n.uuid === ctx.tempUuid ? realNote : n)),
            })),
          }
        })
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

/** Optimistically sync/toggle tags on a note */
export function useSyncNoteTags(): TNoteTagsMutation {
  const qc: QueryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ uuid, names }: { uuid: TUuid; names: string[] }) => {
      return notesApi.syncNoteTags(uuid, names)
    },
    onMutate: async ({ uuid, names }: { uuid: TUuid; names: string[]; }) => {
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNote: INote | undefined = qc.getQueryData<INote>(queryKeys.notes.detail(uuid))
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)

      // 1. Update single note query tags immediately
      if (prevNote) {
        qc.setQueryData<INote>(queryKeys.notes.detail(uuid), { ...prevNote, tags: names })
      }

      // 2. Update tags and tag counts
      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const currentTags: ITag[] = getTagsArray(old.tags)
        const currentNames: string[] = currentTags.map((t: ITag) => t.name)

        const addedTags: ITag[] = names
          .filter((name: string) => !currentNames.includes(name))
          .map((name: string) => ({
            uuid: crypto.randomUUID(),
            name,
            slug: slugify(name),
          }))

        const nextTags: ITag[] = [...currentTags, ...addedTags]
        const nextTagCounts: { [x: string]: number; } = { ...old.counts?.tags }

        const prevNames: string[] = prevNote?.tags ?? []
        for (const added of names) {
          if (!prevNames.includes(added)) {
            const slug: string = slugify(added)
            nextTagCounts[slug] = (nextTagCounts[slug] ?? 0) + 1
          }
        }
        for (const removed of prevNames) {
          if (!names.includes(removed)) {
            const slug: string = slugify(removed)
            nextTagCounts[slug] = Math.max(0, (nextTagCounts[slug] ?? 1) - 1)
          }
        }

        return {
          ...old,
          tags:   nextTags,
          counts: {
            ...old.counts,
            tags: nextTagCounts,
          },
        }
      })

      return { prevNote, prevBootstrap }
    },
    onError: (_err: IApiError, { uuid }: { uuid: TUuid; names: string[]; }, ctx: { prevNote: INote | undefined; prevBootstrap: IBootstrap | undefined; } | undefined) => {
      if (ctx?.prevNote) {
        qc.setQueryData(queryKeys.notes.detail(uuid), ctx.prevNote)
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_TAGS_FAILED)
    },
    onSettled: (_data: unknown, _err: IApiError | null, { uuid }: { uuid: TUuid; names: string[]; }) => {
      qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
    },
  })
}

/** Optimistically move note to a folder or root */
export function useMoveNoteFolder(): TMoveNoteMutation {
  const qc: QueryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ uuid, folderId }: { uuid: TUuid; folderId: TUuid | null }) => {
      return notesApi.patchNote(uuid, { folderId })
    },
    onMutate: async ({ uuid, folderId }: { uuid: TUuid; folderId: TUuid | null; }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote: INote | undefined = qc.getQueryData<INote>(queryKeys.notes.detail(uuid))
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)

      let targetFolder: { uuid: TUuid; name: string } | null = null
      if (folderId) {
        const foldersList: IFolder[] = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
        const found: IFolder | undefined = foldersList.find((f: IFolder) => f.uuid === folderId)
        targetFolder = found ? { uuid: found.uuid, name: found.name } : null
      }

      const prevFolderUuid: string | undefined = prevSingleNote?.folder?.uuid

      // 1. Update single note query
      if (prevSingleNote) {
        qc.setQueryData<INote>(queryKeys.notes.detail(uuid), {
          ...prevSingleNote,
          folder: targetFolder,
        })
      }

      // 2. Update note lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.TNotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.TNotesPage) => ({
            ...p,
            data: p.data.map((n: INoteListItem) => (n.uuid === uuid ? { ...n, folder: targetFolder } : n)),
          })),
        }
      })

      // 3. Update folder counts
      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const nextFolderCounts: { [x: string]: number; } = { ...old.counts?.folders }
        if (prevFolderUuid && nextFolderCounts[prevFolderUuid] !== undefined) {
          nextFolderCounts[prevFolderUuid] = Math.max(0, nextFolderCounts[prevFolderUuid] - 1)
        }
        if (folderId) {
          nextFolderCounts[folderId] = (nextFolderCounts[folderId] ?? 0) + 1
        }
        return {
          ...old,
          counts: {
            ...old.counts,
            folders: nextFolderCounts,
          },
        }
      })

      return { prevNotes, prevSingleNote, prevBootstrap }
    },
    onError: (_err: IApiError, { uuid }: IMoveNoteVars, ctx: INoteEditContext | undefined) => {
      if (ctx?.prevSingleNote) {
        qc.setQueryData(queryKeys.notes.detail(uuid), ctx.prevSingleNote)
      }
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_MOVE_FAILED)
    },
    onSettled: (_data: unknown, _err: IApiError | null, { uuid }: { uuid: TUuid; folderId: TUuid | null; }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

/**
 * Tops up the filter box from the server when the scope has more pages than are
 * loaded, so a filter never silently misses notes.
 */
export function useNotesFilterQuery(
  scope: TScope,
  query: string,
  params: Record<string, string | undefined>,
  enabled: boolean,
): UseQueryResult<notesApi.TNotesPage> {
  return useQuery({
    queryKey: queryKeys.notes.filter(scope, query),
    queryFn:  (): Promise<notesApi.TNotesPage> => notesApi.fetchNotes({ ...params, q: query }),
    enabled,
  })
}
