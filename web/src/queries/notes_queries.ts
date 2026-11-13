import { type InfiniteData, type QueryClient, useInfiniteQuery, type UseInfiniteQueryResult, useMutation, type UseMutationResult, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { HttpStatusCode } from 'axios'

import { normalizeError } from '@src/api/api_client'
import type { ApiError } from '@src/api/api_client'
import * as notesApi from '@src/api/notes_api'
import { COPY_NOTE_SUFFIX, DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import { MESSAGES } from '@src/constants/messages'
import { AUTH_KEY, BOOTSTRAP_KEY, LOCAL_SIDEBAR_KEY, NOTE_KEY, NOTES_KEY, queryKeys } from '@src/constants/query_keys'
import { notesSource } from '@src/data/notes_source'
import { notesRepo } from '@src/db/notes_repo'
import { tagsRepo } from '@src/db/tags_repo'
import { isNative } from '@src/platform/is_native'
import { useTabsStore } from '@src/stores/tabs_store'
import type { TabsState } from '@src/stores/tabs_store'
import { type Scope, useUiStore } from '@src/stores/ui_store'
import { syncEngine } from '@src/sync/engine'
import { outbox } from '@src/sync/outbox'
import type { Bootstrap, Container, Folder, Note, NoteListItem, Tag, UUID } from '@src/types/api'
import type {
  ICreateNoteContext, IDuplicateNoteContext, ILocalSidebar, INoteEditContext, INoteListContext, INoteTagsContext, IRenameNoteContext,
} from '@src/types/mutation_context'
import { getFoldersArray, getTagsArray } from '@src/utils/bootstrap_lists'
import { showErrorToast } from '@src/utils/notifications'
import { slugify } from '@src/utils/slugify'

export interface IStarNoteVars { uuid: string; is_starred: boolean }
export interface IRenameNoteVars { uuid: string; title: string }
export interface ICreateNoteVars { folder_id?: UUID; uuid?: UUID; container?: Container }
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

      if (isNative()) {
        const local: Note | null = await notesRepo.get(uuid)
        const isLocalContainer: boolean = local?.container === 'local' || (!local && useUiStore.getState().scope.container === 'local')

        // Local notes stay strictly on the local machine
        if (isLocalContainer) {
          if (!local) {
            closeTab(uuid)
            return null
          }
          return local
        }

        // For cloud notes: if online, always fetch latest note content from server
        if (navigator.onLine) {
          try {
            const remote: Note = await notesApi.fetchNote(uuid)
            if (remote) {
              await notesRepo.upsert({
                uuid:            remote.uuid,
                container:       'cloud',
                folder_uuid:     remote.folder?.uuid ?? null,
                title:           remote.title,
                title_locked:    Boolean(remote.title_locked),
                body:            remote.body,
                plain_text:      remote.plain_text ?? '',
                excerpt:         remote.excerpt,
                is_starred:      Boolean(remote.is_starred),
                word_count:      remote.word_count,
                updated_at:      remote.updated_at,
                deleted_at:      remote.deleted_at,
                server_version:  remote.version,
                server_revision: null,
                dirty:           false,
              })
              if (remote.tags) {
                await tagsRepo.setNoteTags(remote.uuid, remote.tags, 'cloud')
              }
              return remote
            }
          } catch (err: unknown) {
            if (normalizeError(err).status === HttpStatusCode.NotFound) {
              closeTab(uuid)
              return null
            }
            // If network fails (e.g. server down or timeout), fall back to local cached copy
            if (local) return local
            throw err
          }
        }

        // Offline: return local copy
        if (local) {
          return local
        }

        closeTab(uuid)
        return null
      }

      // Web platform (not native): fetch directly from API
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
  const native: boolean = isNative()
  const container: Container = scope.container ?? (native ? 'local' : 'cloud')

  return useInfiniteQuery({
    queryKey: queryKeys.notes.list(container, scopeKey(scope)),
    queryFn:  async ({ pageParam }: { pageParam: number }) => {
      if (native) {
        const rows: NoteListItem[] = await notesSource.list({ ...scope, container })
        return {
          data: rows,
          meta: {
            current_page: 1,
            from:         1,
            last_page:    1,
            path:         '',
            per_page:     rows.length,
            to:           rows.length,
            total:        rows.length,
          },
        }
      }
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
      if (isNative()) {
        const note: Note | null = await notesRepo.get(uuid)
        const isLocal: boolean = !note || note.container === 'local'
        if (note) {
          await notesRepo.upsert({
            ...note,
            container:       note.container ?? 'local',
            folder_uuid:     note.folder?.uuid ?? null,
            plain_text:      (note as { plain_text?: string }).plain_text ?? '',
            is_starred,
            updated_at:      new Date().toISOString(),
            server_version:  note.version,
            server_revision: null,
            dirty:           !isLocal,
          })
          if (!isLocal) {
            await outbox.enqueue({
              kind:      'meta',
              uuid,
              changes:   { is_starred },
              container: 'cloud',
            })
            void syncEngine.run()
          }
        }
        return note ? { ...note, is_starred } : null
      }
      return notesApi.patchNote(uuid, { is_starred })
    },
    onMutate: async ({ uuid, is_starred }: { uuid: string; is_starred: boolean; }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote: Note | undefined = qc.getQueryData<Note>(queryKeys.notes.detail(uuid))
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal: ILocalSidebar | undefined = qc.getQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY)

      const noteContainer: 'cloud' | 'local' = prevSingleNote?.container ?? useUiStore.getState().scope.container ?? 'local'
      const isLocal: boolean = noteContainer === 'local'

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

      // 3. Update sidebar starred count in matching container only
      const delta: 1 | -1 = is_starred ? 1 : -1
      if (isLocal) {
        qc.setQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY, (old: NoInfer<ILocalSidebar> | undefined) => {
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
      } else {
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
      }

      return { prevNotes, prevSingleNote, prevBootstrap, prevLocal }
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
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      showErrorToast(MESSAGES.NOTE_UPDATE_FAILED)
    },
    onSettled: (_data: Note | null | undefined, _err: ApiError | null, { uuid }: { uuid: string; is_starred: boolean; }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useRenameNote(): TRenameNoteMutation {
  const qc: QueryClient = useQueryClient()
  const setTitle: (uuid: UUID, title: string) => void = useTabsStore((s: TabsState) => s.setTitle)

  return useMutation({
    mutationFn: async ({ uuid, title }: { uuid: string; title: string }) => {
      if (isNative()) {
        const note: Note | null = await notesRepo.get(uuid)
        const isLocal: boolean = !note || note.container === 'local'
        if (note) {
          await notesRepo.upsert({
            ...note,
            container:       note.container ?? 'local',
            folder_uuid:     note.folder?.uuid ?? null,
            title,
            title_locked:    true,
            plain_text:      (note as { plain_text?: string }).plain_text ?? '',
            updated_at:      new Date().toISOString(),
            server_version:  note.version,
            server_revision: null,
            dirty:           !isLocal,
          })
          if (!isLocal) {
            await outbox.enqueue({
              kind:      'meta',
              uuid,
              changes:   { title, title_locked: true },
              container: 'cloud',
            })
            void syncEngine.run()
          }
        }
        return note ? { ...note, title, title_locked: true } : null
      }
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
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useCreateNote(): TCreateNoteMutation {
  const qc: QueryClient = useQueryClient()
  const openTab: (uuid: UUID, title: string) => void = useTabsStore((s: TabsState) => s.open)

  return useMutation({
    mutationFn: async (payload: { folder_id?: UUID; uuid?: UUID; container?: Container }) => {
      const uuid: string = payload.uuid || crypto.randomUUID()
      const scope: Scope = useUiStore.getState().scope
      const container: Container = payload.container ?? scope.container ?? (isNative() ? 'local' : 'cloud')

      if (isNative()) {
        await notesRepo.upsert({
          uuid,
          container,
          folder_uuid:     payload.folder_id ?? null,
          title:           DEFAULT_NOTE_TITLE,
          title_locked:    false,
          body:            { type: 'doc', content: [] },
          plain_text:      '',
          excerpt:         '',
          is_starred:      false,
          word_count:      0,
          updated_at:      new Date().toISOString(),
          deleted_at:      null,
          server_version:  null,
          server_revision: null,
          dirty:           container === 'cloud',
        })
        if (container === 'cloud') {
          await outbox.enqueue({
            kind:      'create',
            uuid,
            folder_id: payload.folder_id ?? undefined,
            container: 'cloud',
          })
          void syncEngine.run()
        }
        const created: Note | null = await notesRepo.get(uuid)
        if (!created) throw new Error('Failed to create note')
        return created
      }

      return notesApi.createNote({ ...payload, uuid })
    },
    onMutate: async (payload: { folder_id?: UUID; uuid?: UUID; container?: Container; }) => {
      const uuid: string = payload.uuid || crypto.randomUUID()
      payload.uuid = uuid

      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal: ILocalSidebar | undefined = qc.getQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY)

      const scope: Scope = useUiStore.getState().scope
      const container: Container = payload.container ?? scope.container ?? (isNative() ? 'local' : 'cloud')
      const isLocal: boolean = container === 'local'

      // 1. Open tab immediately
      openTab(uuid, DEFAULT_NOTE_TITLE)

      // 2. Populate single note cache optimistically
      let currentFolder: { uuid: UUID; name: string } | null = null
      if (payload.folder_id) {
        if (isLocal) {
          const localFoldersList: Folder[] = prevLocal?.folders ?? []
          const found: Folder | undefined = localFoldersList.find((f: Folder) => f.uuid === payload.folder_id)
          currentFolder = found ? { uuid: found.uuid, name: found.name } : null
        } else {
          const foldersList: Folder[] = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
          const found: Folder | undefined = foldersList.find((f: Folder) => f.uuid === payload.folder_id)
          currentFolder = found ? { uuid: found.uuid, name: found.name } : null
        }
      }

      const optimisticNote: Note = {
        uuid,
        container,
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
        container,
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

      // 4. Update counts strictly in matching container
      if (isLocal) {
        qc.setQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY, (old: NoInfer<ILocalSidebar> | undefined) => {
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
      } else {
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
      }

      return { prevNotes, prevBootstrap, prevLocal, uuid }
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
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      showErrorToast(MESSAGES.NOTE_CREATE_FAILED)
    },
    onSuccess: (newNote: Note) => {
      qc.setQueryData(queryKeys.notes.detail(newNote.uuid), newNote)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useTrashNote(): TNoteListMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: async (uuid: string) => {
      if (isNative()) {
        const note: Note | null = await notesRepo.get(uuid)
        const currentContainer: 'cloud' | 'local' = note?.container ?? (useUiStore.getState().scope.container ?? 'local')
        const isLocal: boolean = currentContainer === 'local'
        await notesRepo.softDelete(uuid, currentContainer)
        if (!isLocal) {
          await outbox.enqueue({
            kind:      'trash',
            uuid,
            container: 'cloud',
          })
          void syncEngine.run()
        }
        return
      }
      return notesApi.trashNote(uuid)
    },
    onMutate: async (uuid: string) => {
      // Close open tab immediately
      useTabsStore.getState().close(uuid)

      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal: unknown = qc.getQueryData(LOCAL_SIDEBAR_KEY)

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

      // Update counts strictly in matching container
      const noteContainer: 'cloud' | 'local' = trashedItem?.container ?? useUiStore.getState().scope.container ?? 'local'
      const isLocal: boolean = noteContainer === 'local'

      if (isLocal) {
        qc.setQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY, (old: NoInfer<ILocalSidebar> | undefined) => {
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
      } else {
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
      }

      return { prevNotes, prevBootstrap, prevLocal }
    },
    onError: (_err: ApiError, _v: string, ctx: INoteListContext | undefined | undefined) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      showErrorToast(MESSAGES.NOTE_TRASH_FAILED)
    },
    onSettled: (_data: void | undefined, _err: ApiError | null, uuid: string) => {
      qc.removeQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useRestoreNote(): TNoteListMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: async (uuid: string) => {
      if (isNative()) {
        const note: Note | null = await notesRepo.get(uuid)
        const currentContainer: 'cloud' | 'local' = note?.container ?? (useUiStore.getState().scope.container ?? 'local')
        const isLocal: boolean = currentContainer === 'local'
        await notesRepo.restore(uuid, currentContainer)
        if (!isLocal) {
          await outbox.enqueue({
            kind:      'restore',
            uuid,
            container: 'cloud',
          })
          void syncEngine.run()
        }
        return
      }
      return notesApi.restoreNote(uuid)
    },
    onMutate: async (uuid: string) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal: unknown = qc.getQueryData(LOCAL_SIDEBAR_KEY)

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

      // Update counts strictly in matching container
      const isLocal: boolean = useUiStore.getState().scope.container === 'local'

      if (isLocal) {
        qc.setQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY, (old: NoInfer<ILocalSidebar> | undefined) => {
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
      } else {
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
      }

      return { prevNotes, prevBootstrap, prevLocal }
    },
    onError: (_err: ApiError, _v: string, ctx: INoteListContext | undefined | undefined) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      showErrorToast(MESSAGES.NOTE_RESTORE_FAILED)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useForceDeleteNote(): TNoteListMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: async (uuid: string) => {
      if (isNative()) {
        const note: Note | null = await notesRepo.get(uuid)
        const currentContainer: 'cloud' | 'local' = note?.container ?? (useUiStore.getState().scope.container ?? 'local')
        const isLocal: boolean = currentContainer === 'local'
        await notesRepo.hardDelete(uuid, currentContainer)
        if (!isLocal) {
          await outbox.enqueue({
            kind:      'force',
            uuid,
            container: 'cloud',
          })
          void syncEngine.run()
        }
        return
      }
      return notesApi.forceDeleteNote(uuid)
    },
    onMutate: async (uuid: string) => {
      // Close open tab immediately
      useTabsStore.getState().close(uuid)

      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal: unknown = qc.getQueryData(LOCAL_SIDEBAR_KEY)

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

      // Update counts strictly in matching container
      const isLocal: boolean = useUiStore.getState().scope.container === 'local'

      if (isLocal) {
        qc.setQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY, (old: NoInfer<ILocalSidebar> | undefined) => {
          if (!old) return old
          return {
            ...old,
            counts: {
              ...old.counts,
              trashed: Math.max(0, (old.counts?.trashed ?? 1) - 1),
            },
          }
        })
      } else {
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
      }

      return { prevNotes, prevBootstrap, prevLocal }
    },
    onError: (_err: ApiError, _v: string, ctx: INoteListContext | undefined | undefined) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      showErrorToast(MESSAGES.NOTE_DELETE_FAILED)
    },
    onSettled: (_data: void | undefined, _err: ApiError | null, uuid: string) => {
      qc.removeQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useDuplicateNote(): TDuplicateNoteMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sourceUuid: string) => {
      if (isNative()) {
        const source: Note | null = await notesRepo.get(sourceUuid)
        const isLocal: boolean = !source || source.container === 'local'
        if (isLocal) {
          const newUuid: `${string}-${string}-${string}-${string}-${string}` = crypto.randomUUID()
          const copyTitle: string = source?.title ? `${source.title}${COPY_NOTE_SUFFIX}` : `${DEFAULT_NOTE_TITLE}${COPY_NOTE_SUFFIX}`
          const now: string = new Date().toISOString()
          if (source) {
            await notesRepo.upsert({
              uuid:            newUuid,
              container:       'local',
              folder_uuid:     source.folder?.uuid ?? null,
              title:           copyTitle,
              title_locked:    source.title_locked,
              body:            source.body,
              plain_text:      (source as { plain_text?: string }).plain_text ?? '',
              excerpt:         source.excerpt,
              is_starred:      false,
              word_count:      source.word_count,
              deleted_at:      null,
              updated_at:      now,
              server_version:  null,
              server_revision: null,
              dirty:           false,
            })
            if (source.tags?.length) {
              await tagsRepo.setNoteTags(newUuid, source.tags, 'local')
            }
          }
          const created: Note | null = await notesRepo.get(newUuid)
          if (!created) throw new Error('Failed to duplicate note')
          return created
        }
        const user: unknown = qc.getQueryData(AUTH_KEY)
        if (!user) throw new Error('Sign in required for cloud notes')
      }
      return notesApi.duplicateNote(sourceUuid)
    },
    onMutate: async (sourceUuid: string) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal: unknown = qc.getQueryData(LOCAL_SIDEBAR_KEY)
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

      const isLocal: boolean = sourceItem?.container === 'local' || (!sourceItem?.container && useUiStore.getState().scope.container === 'local')

      const tempUuid: `${string}-${string}-${string}-${string}-${string}` = crypto.randomUUID()
      const title: string = sourceItem
        ? (sourceItem.title === '' ? '' : `${sourceItem.title}${COPY_NOTE_SUFFIX}`)
        : `${DEFAULT_NOTE_TITLE}${COPY_NOTE_SUFFIX}`
      const folder: { uuid: UUID; name: string; } | null = sourceItem?.folder ?? null
      const tags: string[] = sourceItem?.tags ?? []
      const excerpt: string = sourceItem?.excerpt ?? ''

      const optimisticListItem: NoteListItem = {
        uuid:       tempUuid,
        container:  isLocal ? 'local' : 'cloud',
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
          container:    isLocal ? 'local' : 'cloud',
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

      // Update sidebar counts strictly in matching container
      if (isLocal) {
        qc.setQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY, (old: NoInfer<ILocalSidebar> | undefined) => {
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
      } else {
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
      }

      return { prevNotes, prevBootstrap, prevLocal, tempUuid }
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
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      showErrorToast(MESSAGES.NOTE_DUPLICATE_FAILED)
    },
    onSuccess: async (realNote: Note, _v: string, ctx: IDuplicateNoteContext | undefined) => {
      qc.setQueryData(queryKeys.notes.detail(realNote.uuid), realNote)
      if (isNative()) {
        const noteContainer: 'cloud' | 'local' = realNote.container ?? (useUiStore.getState().scope.container ?? 'local')
        const isLocal: boolean = noteContainer === 'local'
        await notesRepo.upsert({
          uuid:            realNote.uuid,
          container:       noteContainer,
          folder_uuid:     realNote.folder?.uuid ?? null,
          title:           realNote.title,
          title_locked:    Boolean(realNote.title_locked),
          body:            realNote.body,
          plain_text:      realNote.plain_text ?? '',
          excerpt:         realNote.excerpt,
          is_starred:      Boolean(realNote.is_starred),
          word_count:      realNote.word_count,
          updated_at:      realNote.updated_at,
          deleted_at:      realNote.deleted_at,
          server_version:  realNote.version,
          server_revision: null,
          dirty:           !isLocal,
        })
      }
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
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

/** Optimistically sync/toggle tags on a note */
export function useSyncNoteTags(): TNoteTagsMutation {
  const qc: QueryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ uuid, names }: { uuid: UUID; names: string[] }) => {
      if (isNative()) {
        const note: Note | null = await notesRepo.get(uuid)
        const isLocal: boolean = !note || note.container === 'local'
        if (note) {
          await tagsRepo.setNoteTags(uuid, names, note.container ?? 'local')
          await notesRepo.upsert({
            ...note,
            container:       note.container ?? 'local',
            folder_uuid:     note.folder?.uuid ?? null,
            plain_text:      (note as { plain_text?: string }).plain_text ?? '',
            updated_at:      new Date().toISOString(),
            server_version:  note.version,
            server_revision: null,
            dirty:           !isLocal,
          })
          if (!isLocal) {
            await outbox.enqueue({
              kind:      'tags',
              uuid,
              names,
              container: 'cloud',
            })
            void syncEngine.run()
          }
        }
        return
      }
      return notesApi.syncNoteTags(uuid, names)
    },
    onMutate: async ({ uuid, names }: { uuid: UUID; names: string[]; }) => {
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNote: Note | undefined = qc.getQueryData<Note>(queryKeys.notes.detail(uuid))
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal: ILocalSidebar | undefined = qc.getQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY)

      const isLocal: boolean = prevNote?.container === 'local' || (!prevNote?.container && useUiStore.getState().scope.container === 'local')

      // 1. Update single note query tags immediately
      if (prevNote) {
        qc.setQueryData<Note>(queryKeys.notes.detail(uuid), { ...prevNote, tags: names })
      }

      // 2. Update tags and tag counts strictly in matching container
      if (isLocal) {
        qc.setQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY, (old: NoInfer<ILocalSidebar> | undefined) => {
          if (!old) return old
          const currentTags: Tag[] = old.tags ?? []
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
      } else {
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
      }

      return { prevNote, prevBootstrap, prevLocal }
    },
    onError: (_err: ApiError, { uuid }: { uuid: UUID; names: string[]; }, ctx: { prevNote: Note | undefined; prevBootstrap: Bootstrap | undefined; prevLocal: ILocalSidebar | undefined; } | undefined) => {
      if (ctx?.prevNote) {
        qc.setQueryData(queryKeys.notes.detail(uuid), ctx.prevNote)
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      showErrorToast(MESSAGES.NOTE_TAGS_FAILED)
    },
    onSettled: (_data: unknown, _err: ApiError | null, { uuid }: { uuid: UUID; names: string[]; }) => {
      qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

/** Optimistically move note to a folder or root */
export function useMoveNoteFolder(): TMoveNoteMutation {
  const qc: QueryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ uuid, folder_id }: { uuid: UUID; folder_id: UUID | null }) => {
      if (isNative()) {
        const note: Note | null = await notesRepo.get(uuid)
        const isLocal: boolean = !note || note.container === 'local'
        if (note) {
          await notesRepo.upsert({
            ...note,
            container:       note.container ?? 'local',
            folder_uuid:     folder_id,
            plain_text:      (note as { plain_text?: string }).plain_text ?? '',
            updated_at:      new Date().toISOString(),
            server_version:  note.version,
            server_revision: null,
            dirty:           !isLocal,
          })
          if (!isLocal) {
            await outbox.enqueue({
              kind:      'meta',
              uuid,
              changes:   { folder_id },
              container: 'cloud',
            })
            void syncEngine.run()
          }
        }
        return
      }
      return notesApi.patchNote(uuid, { folder_id })
    },
    onMutate: async ({ uuid, folder_id }: { uuid: UUID; folder_id: UUID | null; }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: queryKeys.notes.detail(uuid) })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote: Note | undefined = qc.getQueryData<Note>(queryKeys.notes.detail(uuid))
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal: ILocalSidebar | undefined = qc.getQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY)

      const noteContainer: 'cloud' | 'local' = prevSingleNote?.container ?? useUiStore.getState().scope.container ?? 'local'
      const isLocal: boolean = noteContainer === 'local'

      let targetFolder: { uuid: UUID; name: string } | null = null
      if (folder_id) {
        if (isLocal) {
          const localFoldersList: Folder[] = prevLocal?.folders ?? []
          const found: Folder | undefined = localFoldersList.find((f: Folder) => f.uuid === folder_id)
          targetFolder = found ? { uuid: found.uuid, name: found.name } : null
        } else {
          const cloudFoldersList: Folder[] = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
          const found: Folder | undefined = cloudFoldersList.find((f: Folder) => f.uuid === folder_id)
          targetFolder = found ? { uuid: found.uuid, name: found.name } : null
        }
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

      // 3. Update folder counts (strictly in matching container)
      if (isLocal) {
        qc.setQueryData<ILocalSidebar>(LOCAL_SIDEBAR_KEY, (old: NoInfer<ILocalSidebar> | undefined) => {
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
      } else {
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
      }

      return { prevNotes, prevSingleNote, prevBootstrap, prevLocal }
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
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      showErrorToast(MESSAGES.NOTE_MOVE_FAILED)
    },
    onSettled: (_data: unknown, _err: ApiError | null, { uuid }: { uuid: UUID; folder_id: UUID | null; }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
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
