import { type InfiniteData, type QueryClient, useInfiniteQuery, type UseInfiniteQueryResult, useMutation, type UseMutationResult, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { HttpStatusCode } from 'axios'

import { normalizeError } from '@src/api/api_client'
import type { ApiError } from '@src/api/api_client'
import * as notesApi from '@src/api/notes_api'
import { COPY_NOTE_SUFFIX, DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import { MESSAGES } from '@src/constants/messages'
import { BOOTSTRAP_KEY, NOTE_KEY, NOTES_KEY, queryKeys } from '@src/constants/query_keys'
import { useTabsStore } from '@src/stores/tabs_store'
import type { TabsState } from '@src/stores/tabs_store'
import type { Scope } from '@src/stores/ui_store'
import type { Bootstrap, Folder, Note, NoteListItem, Tag, UUID } from '@src/types/api'
import type {
  ICreateNoteContext, IDuplicateNoteContext, INoteEditContext, INoteListContext, INoteTagsContext, IRenameNoteContext,
} from '@src/types/mutation_context'
import { getFoldersArray, getTagsArray } from '@src/utils/bootstrap_lists'
import { showErrorToast } from '@src/utils/notifications'
import { slugify } from '@src/utils/slugify'

export interface IStarNoteVars { uuid: string; is_starred: boolean }
export interface IRenameNoteVars { uuid: string; title: string }
export interface ICreateNoteVars { folder_id?: UUID; uuid?: UUID }
export interface INoteTagsVars { uuid: UUID; names: string[] }
export interface IMoveNoteVars { uuid: UUID; folder_id: UUID | null }

export type TStarNoteMutation = UseMutationResult<Note | null, ApiError, IStarNoteVars, INoteEditContext>
export type TRenameNoteMutation = UseMutationResult<Note | null, ApiError, IRenameNoteVars, IRenameNoteContext>
export type TCreateNoteMutation = UseMutationResult<Note, ApiError, ICreateNoteVars, ICreateNoteContext>
export type TDuplicateNoteMutation = UseMutationResult<Note, ApiError, string, IDuplicateNoteContext | undefined>
export type TNoteTagsMutation = UseMutationResult<unknown, ApiError, INoteTagsVars, INoteTagsContext>
/** Trash, restore and permanent delete. */
export type TNoteListMutation = UseMutationResult<void, ApiError, string, INoteListContext>
export type TMoveNoteMutation = UseMutationResult<unknown, ApiError, IMoveNoteVars, INoteEditContext>

export { NOTE_KEY, NOTES_KEY }

export function useNote(uuid?: UUID | null): UseQueryResult<Note | null, ApiError> {
  const closeTab: (uuid: UUID) => void = useTabsStore((s: TabsState) => s.close)

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
    retry:          (failureCount: number, err: ApiError) => {
      if (normalizeError(err).status === HttpStatusCode.NotFound) {
        return false
      }
      return failureCount < 2
    },
  })
}

function scopeParams(scope: Scope): Record<string, string | undefined> {
  switch (scope.kind) {
    case 'folder': return { folder_id: scope.uuid }
    case 'tag': return { tag: scope.slug }
    case 'starred': return { starred: '1' }
    case 'trash': return { trashed: '1' }
    case 'search': return { q: scope.q }
    default: return {}
  }
}

function scopeKey(scope: Scope): string {
  switch (scope.kind) {
    case 'folder': return `folder:${scope.uuid}`
    case 'tag': return `tag:${scope.slug}`
    case 'starred': return 'starred'
    case 'trash': return 'trash'
    case 'search': return `search:${scope.q}`
    default: return 'all'
  }
}

export function useNotes(scope: Scope): UseInfiniteQueryResult<InfiniteData<notesApi.NotesPage, unknown>, ApiError> {
  return useInfiniteQuery({
    queryKey: queryKeys.notes.list(scopeKey(scope)),
    queryFn:  async ({ pageParam }: { pageParam: number }) => {
      return notesApi.fetchNotes({
        ...scopeParams(scope),
        page: pageParam ? String(pageParam) : undefined,
      })
    },
    initialPageParam: 1,
    getNextPageParam: (last: notesApi.NotesPage) =>
      last.meta.current_page < last.meta.last_page
        ? last.meta.current_page + 1
        : undefined,
    staleTime: Infinity,
  })
}

/** Optimistic star: update list, single note, and sidebar counts immediately */
export function useStarNote(_scope?: Scope): TStarNoteMutation {
  const qc: QueryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ uuid, is_starred }: { uuid: string; is_starred: boolean }) => {
      return notesApi.patchNote(uuid, { is_starred })
    },
    onMutate: async ({ uuid, is_starred }: { uuid: string; is_starred: boolean; }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote: Note | undefined = qc.getQueryData<Note>(queryKeys.notes.detail(uuid))
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // 1. Update all cached note lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.NotesPage) => ({
            ...p,
            data: p.data.map((n: NoteListItem) => (n.uuid === uuid ? { ...n, is_starred } : n)),
          })),
        }
      })

      // 2. Update single note query if open
      if (prevSingleNote) {
        qc.setQueryData<Note>(queryKeys.notes.detail(uuid), { ...prevSingleNote, is_starred })
      }

      // 3. Update the sidebar's starred count
      const delta: 1 | -1 = is_starred ? 1 : -1
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
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
    onError: (_e: ApiError, { uuid }: IStarNoteVars, ctx: INoteEditContext | undefined) => {
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
    onSettled: (_data: Note | null | undefined, _err: ApiError | null, { uuid }: { uuid: string; is_starred: boolean; }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useRenameNote(): TRenameNoteMutation {
  const qc: QueryClient = useQueryClient()
  const setTitle: (uuid: UUID, title: string) => void = useTabsStore((s: TabsState) => s.setTitle)

  return useMutation({
    mutationFn: async ({ uuid, title }: { uuid: string; title: string }) => {
      return notesApi.patchNote(uuid, { title })
    },
    onMutate: async ({ uuid, title }: { uuid: string; title: string; }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote: Note | undefined = qc.getQueryData<Note>(queryKeys.notes.detail(uuid))
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // 1. Instantly update tab title in UI
      setTitle(uuid, title || DEFAULT_NOTE_TITLE)

      // 2. Instantly update note lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.NotesPage) => ({
            ...p,
            data: p.data.map((n: NoteListItem) => (n.uuid === uuid ? { ...n, title } : n)),
          })),
        }
      })

      // 3. Instantly update single note query
      if (prevSingleNote) {
        qc.setQueryData<Note>(queryKeys.notes.detail(uuid), { ...prevSingleNote, title })
      }

      return { prevNotes, prevSingleNote, prevBootstrap }
    },
    onError: (_err: ApiError, { uuid }: { uuid: string; title: string; }, ctx: { prevNotes: [readonly unknown[], unknown][]; prevSingleNote: Note | undefined; prevBootstrap: Bootstrap | undefined; } | undefined) => {
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
    onSettled: (_data: Note | null | undefined, _err: ApiError | null, { uuid }: { uuid: string; title: string; }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useCreateNote(): TCreateNoteMutation {
  const qc: QueryClient = useQueryClient()
  const openTab: (uuid: UUID, title: string) => void = useTabsStore((s: TabsState) => s.open)

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
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // 1. Open tab immediately
      openTab(uuid, DEFAULT_NOTE_TITLE)

      // 2. Populate single note cache optimistically
      let currentFolder: { uuid: UUID; name: string } | null = null
      if (payload.folder_id) {
        const foldersList: Folder[] = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
        const found: Folder | undefined = foldersList.find((f: Folder) => f.uuid === payload.folder_id)
        currentFolder = found ? { uuid: found.uuid, name: found.name } : null
      }

      const optimisticNote: Note = {
        uuid,
        title:        DEFAULT_NOTE_TITLE,
        title_locked: false,
        body:         { type: 'doc', content: [] },
        excerpt:      '',
        is_starred:   false,
        version:      1,
        word_count:   0,
        folder:       currentFolder,
        tags:         [],
        updated_at:   new Date().toISOString(),
        deleted_at:   null,
      }
      qc.setQueryData(queryKeys.notes.detail(uuid), optimisticNote)

      // 3. Prepend to note list queries
      const optimisticListItem: NoteListItem = {
        uuid,
        title:      DEFAULT_NOTE_TITLE,
        excerpt:    '',
        is_starred: false,
        folder:     currentFolder,
        tags:       [],
        updated_at: new Date().toISOString(),
        deleted_at: null,
      }

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length || !old.pages[0]) return old
        const first: notesApi.NotesPage = old.pages[0]
        return {
          ...old,
          pages: [
            {
              ...first,
              data: [optimisticListItem, ...first.data],
              meta: {
                ...first.meta,
                total: (first.meta?.total ?? 0) + 1,
              },
            },
            ...old.pages.slice(1),
          ],
        }
      })

      // 4. Update sidebar counts
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        return {
          ...old,
          counts: {
            ...old.counts,
            all:     (old.counts?.all ?? 0) + 1,
            folders: payload.folder_id
              ? {
                ...old.counts?.folders,
                [payload.folder_id]: (old.counts?.folders?.[payload.folder_id] ?? 0) + 1,
              }
              : old.counts?.folders,
          },
        }
      })

      return { prevNotes, prevBootstrap, uuid }
    },
    onError: (_err: ApiError, _v: ICreateNoteVars, ctx: ICreateNoteContext | undefined) => {
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
    onSuccess: (newNote: Note) => {
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
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // Find note in cached pages to get starred / folder info
      let trashedItem: NoteListItem | undefined
      for (const [, queryData] of prevNotes) {
        const pagesData: { pages?: notesApi.NotesPage[]; } = queryData as { pages?: notesApi.NotesPage[] }
        const item: NoteListItem | undefined = pagesData?.pages?.flatMap((p: notesApi.NotesPage) => p.data).find((n: NoteListItem) => n.uuid === uuid)
        if (item) {
          trashedItem = item
          break
        }
      }

      // Remove from non-trash lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.NotesPage) => ({
            ...p,
            data: p.data.filter((n: NoteListItem) => n.uuid !== uuid),
          })),
        }
      })

      // Update sidebar counts

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
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
            starred: trashedItem?.is_starred ? Math.max(0, (old.counts?.starred ?? 1) - 1) : (old.counts?.starred ?? 0),
            folders: nextFolderCounts,
          },
        }
      })

      return { prevNotes, prevBootstrap }
    },
    onError: (_err: ApiError, _v: string, ctx: INoteListContext | undefined | undefined) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_TRASH_FAILED)
    },
    onSettled: (_data: void | undefined, _err: ApiError | null, uuid: string) => {
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
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // Remove from trash list
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.NotesPage) => ({
            ...p,
            data: p.data.filter((n: NoteListItem) => n.uuid !== uuid),
          })),
        }
      })

      // Update sidebar counts

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
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
    onError: (_err: ApiError, _v: string, ctx: INoteListContext | undefined | undefined) => {
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
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.NotesPage) => ({
            ...p,
            data: p.data.filter((n: NoteListItem) => n.uuid !== uuid),
          })),
        }
      })

      // Update sidebar counts

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
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
    onError: (_err: ApiError, _v: string, ctx: INoteListContext | undefined | undefined) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_DELETE_FAILED)
    },
    onSettled: (_data: void | undefined, _err: ApiError | null, uuid: string) => {
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
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevSingle: Note | undefined = qc.getQueryData<Note>(queryKeys.notes.detail(sourceUuid))

      // Find the source note in cached queries if not in single query
      let sourceItem: NoteListItem | Note | undefined = prevSingle
      if (!sourceItem && prevNotes) {
        for (const [, data] of prevNotes) {
          const pages: notesApi.NotesPage[] | undefined = (data as { pages?: notesApi.NotesPage[] })?.pages
          if (pages) {
            for (const page of pages) {
              const found: NoteListItem | undefined = page.data.find((n: NoteListItem) => n.uuid === sourceUuid)
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
      const folder: { uuid: UUID; name: string; } | null = sourceItem?.folder ?? null
      const tags: string[] = sourceItem?.tags ?? []
      const excerpt: string = sourceItem?.excerpt ?? ''

      const optimisticListItem: NoteListItem = {
        uuid:       tempUuid,
        title,
        excerpt,
        is_starred: false,
        folder,
        tags,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      }

      // If we have single note data for the source note, also pre-populate single note query
      if (prevSingle) {
        const optimisticNote: Note = {
          ...prevSingle,
          uuid:         tempUuid,
          title,
          version:      1,
          title_locked: sourceItem ? sourceItem.title !== '' : true,
          updated_at:   new Date().toISOString(),
          deleted_at:   null,
        }
        qc.setQueryData(queryKeys.notes.detail(tempUuid), optimisticNote)
      }

      // Prepend to note list queries
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length || !old.pages[0]) return old
        const first: notesApi.NotesPage = old.pages[0]
        return {
          ...old,
          pages: [
            {
              ...first,
              data: [optimisticListItem, ...first.data],
              meta: {
                ...first.meta,
                total: (first.meta?.total ?? 0) + 1,
              },
            },
            ...old.pages.slice(1),
          ],
        }
      })

      // Update sidebar counts
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
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
    onError: (_err: ApiError, _v: string, ctx: IDuplicateNoteContext | undefined) => {
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
    onSuccess: (realNote: Note, _v: string, ctx: IDuplicateNoteContext | undefined) => {
      qc.setQueryData(queryKeys.notes.detail(realNote.uuid), realNote)
      if (ctx?.tempUuid) {
        qc.removeQueries({ queryKey: queryKeys.notes.detail(ctx.tempUuid) })
        qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
          if (!old?.pages?.length) return old
          return {
            ...old,
            pages: old.pages.map((p: notesApi.NotesPage) => ({
              ...p,
              data: p.data.map((n: NoteListItem) => (n.uuid === ctx.tempUuid ? realNote : n)),
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
    mutationFn: async ({ uuid, names }: { uuid: UUID; names: string[] }) => {
      return notesApi.syncNoteTags(uuid, names)
    },
    onMutate: async ({ uuid, names }: { uuid: UUID; names: string[]; }) => {
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNote: Note | undefined = qc.getQueryData<Note>(queryKeys.notes.detail(uuid))
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // 1. Update single note query tags immediately
      if (prevNote) {
        qc.setQueryData<Note>(queryKeys.notes.detail(uuid), { ...prevNote, tags: names })
      }

      // 2. Update tags and tag counts
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const currentTags: Tag[] = getTagsArray(old.tags)
        const currentNames: string[] = currentTags.map((t: Tag) => t.name)

        const addedTags: Tag[] = names
          .filter((name: string) => !currentNames.includes(name))
          .map((name: string) => ({
            uuid: crypto.randomUUID(),
            name,
            slug: slugify(name),
          }))

        const nextTags: Tag[] = [...currentTags, ...addedTags]
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
    onError: (_err: ApiError, { uuid }: { uuid: UUID; names: string[]; }, ctx: { prevNote: Note | undefined; prevBootstrap: Bootstrap | undefined; } | undefined) => {
      if (ctx?.prevNote) {
        qc.setQueryData(queryKeys.notes.detail(uuid), ctx.prevNote)
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      showErrorToast(MESSAGES.NOTE_TAGS_FAILED)
    },
    onSettled: (_data: unknown, _err: ApiError | null, { uuid }: { uuid: UUID; names: string[]; }) => {
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
    mutationFn: async ({ uuid, folder_id }: { uuid: UUID; folder_id: UUID | null }) => {
      return notesApi.patchNote(uuid, { folder_id })
    },
    onMutate: async ({ uuid, folder_id }: { uuid: UUID; folder_id: UUID | null; }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote: Note | undefined = qc.getQueryData<Note>(queryKeys.notes.detail(uuid))
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      let targetFolder: { uuid: UUID; name: string } | null = null
      if (folder_id) {
        const foldersList: Folder[] = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
        const found: Folder | undefined = foldersList.find((f: Folder) => f.uuid === folder_id)
        targetFolder = found ? { uuid: found.uuid, name: found.name } : null
      }

      const prevFolderUuid: string | undefined = prevSingleNote?.folder?.uuid

      // 1. Update single note query
      if (prevSingleNote) {
        qc.setQueryData<Note>(queryKeys.notes.detail(uuid), {
          ...prevSingleNote,
          folder: targetFolder,
        })
      }

      // 2. Update note lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p: notesApi.NotesPage) => ({
            ...p,
            data: p.data.map((n: NoteListItem) => (n.uuid === uuid ? { ...n, folder: targetFolder } : n)),
          })),
        }
      })

      // 3. Update folder counts
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const nextFolderCounts: { [x: string]: number; } = { ...old.counts?.folders }
        if (prevFolderUuid && nextFolderCounts[prevFolderUuid] !== undefined) {
          nextFolderCounts[prevFolderUuid] = Math.max(0, nextFolderCounts[prevFolderUuid] - 1)
        }
        if (folder_id) {
          nextFolderCounts[folder_id] = (nextFolderCounts[folder_id] ?? 0) + 1
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
    onError: (_err: ApiError, { uuid }: IMoveNoteVars, ctx: INoteEditContext | undefined) => {
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
    onSettled: (_data: unknown, _err: ApiError | null, { uuid }: { uuid: UUID; folder_id: UUID | null; }) => {
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
  scope: Scope,
  query: string,
  params: Record<string, string | undefined>,
  enabled: boolean,
): UseQueryResult<notesApi.NotesPage> {
  return useQuery({
    queryKey: queryKeys.notes.filter(scope, query),
    queryFn:  (): Promise<notesApi.NotesPage> => notesApi.fetchNotes({ ...params, q: query }),
    enabled,
  })
}
