import { notifications } from '@mantine/notifications'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as notesApi from '@/api/notes'
import { COPY_NOTE_SUFFIX, DEFAULT_NOTE_TITLE } from '@/constants/labels'
import { AUTH_KEY, BOOTSTRAP_KEY, LOCAL_SIDEBAR_KEY, NOTE_KEY, NOTES_KEY } from '@/constants/queryKeys'
import { notesSource } from '@/data/notesSource'
import { notesRepo } from '@/db/notesRepo'
import { tagsRepo } from '@/db/tagsRepo'
import { getFoldersArray, getTagsArray } from '@/lib/bootstrap'
import { slugify } from '@/lib/slugify'
import { isNative } from '@/platform/isNative'
import { useTabsStore } from '@/stores/tabsStore'
import { useUiStore, type Scope } from '@/stores/uiStore'
import { syncEngine } from '@/sync/engine'
import { outbox } from '@/sync/outbox'
import type { Bootstrap, Container, Counts, Folder, Note, NoteListItem, Tag, UUID } from '@/types/api'

export { NOTE_KEY, NOTES_KEY }

export function useNote(uuid?: UUID | null) {
  const closeTab = useTabsStore((s) => s.close)

  return useQuery({
    queryKey: [...NOTE_KEY, uuid],
    queryFn:  async () => {
      if (!uuid) return null

      if (isNative()) {
        const local = await notesRepo.get(uuid)
        const isLocalContainer = local?.container === 'local' || (!local && useUiStore.getState().scope.container === 'local')

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
            const remote = await notesApi.fetchNote(uuid)
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
            const error = err as { response?: { status?: number }; status?: number }
            if (error.response?.status === 404 || error.status === 404) {
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
        const error = err as { response?: { status?: number }; status?: number }
        if (error.response?.status === 404 || error.status === 404) {
          closeTab(uuid)
          return null
        }
        throw err
      }
    },
    enabled:        Boolean(uuid),
    staleTime:      0,
    refetchOnMount: 'always',
    retry:          (failureCount, err) => {
      const error = err as { response?: { status?: number }; status?: number }
      if (error.response?.status === 404 || error.status === 404) {
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

export function useNotes(scope: Scope) {
  const native = isNative()
  const container = scope.container ?? (native ? 'local' : 'cloud')

  return useInfiniteQuery({
    queryKey: [...NOTES_KEY, container, scopeKey(scope)],
    queryFn:  async ({ pageParam }) => {
      if (native) {
        const rows = await notesSource.list({ ...scope, container })
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
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page
        ? last.meta.current_page + 1
        : undefined,
    staleTime: Infinity,
  })
}

/** Optimistic star: update list, single note, and sidebar counts immediately */
export function useStarNote(_scope?: Scope) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ uuid, is_starred }: { uuid: string; is_starred: boolean }) => {
      if (isNative()) {
        const note = await notesRepo.get(uuid)
        const isLocal = !note || note.container === 'local'
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
    onMutate: async ({ uuid, is_starred }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: [...NOTE_KEY, uuid] })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote = qc.getQueryData<Note>([...NOTE_KEY, uuid])
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal = qc.getQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY)

      const noteContainer = prevSingleNote?.container ?? useUiStore.getState().scope.container ?? 'local'
      const isLocal = noteContainer === 'local'

      // 1. Update all cached note lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.map((n: NoteListItem) => (n.uuid === uuid ? { ...n, is_starred } : n)),
          })),
        }
      })

      // 2. Update single note query if open
      if (prevSingleNote) {
        qc.setQueryData<Note>([...NOTE_KEY, uuid], { ...prevSingleNote, is_starred })
      }

      // 3. Update sidebar starred count in matching container only
      const delta = is_starred ? 1 : -1
      if (isLocal) {
        qc.setQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY, (old) => {
          if (!old) return old
          const currentStarred = old.counts?.starred ?? 0
          return {
            ...old,
            counts: {
              ...old.counts,
              starred: Math.max(0, currentStarred + delta),
            },
          }
        })
      } else {
        qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
          if (!old) return old
          const currentStarred = old.counts?.starred ?? 0
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
    onError: (_e, { uuid }, ctx) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevSingleNote) {
        qc.setQueryData([...NOTE_KEY, uuid], ctx.prevSingleNote)
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      notifications.show({ color: 'red', message: "Couldn't update that note." })
    },
    onSettled: (_data, _err, { uuid }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: [...NOTE_KEY, uuid] })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useRenameNote() {
  const qc = useQueryClient()
  const setTitle = useTabsStore((s) => s.setTitle)

  return useMutation({
    mutationFn: async ({ uuid, title }: { uuid: string; title: string }) => {
      if (isNative()) {
        const note = await notesRepo.get(uuid)
        const isLocal = !note || note.container === 'local'
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
    onMutate: async ({ uuid, title }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: [...NOTE_KEY, uuid] })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote = qc.getQueryData<Note>([...NOTE_KEY, uuid])
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // 1. Instantly update tab title in UI
      setTitle(uuid, title || DEFAULT_NOTE_TITLE)

      // 2. Instantly update note lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.map((n: NoteListItem) => (n.uuid === uuid ? { ...n, title } : n)),
          })),
        }
      })

      // 3. Instantly update single note query
      if (prevSingleNote) {
        qc.setQueryData<Note>([...NOTE_KEY, uuid], { ...prevSingleNote, title })
      }

      return { prevNotes, prevSingleNote, prevBootstrap }
    },
    onError: (_err, { uuid }, ctx) => {
      if (ctx?.prevSingleNote) {
        setTitle(uuid, ctx.prevSingleNote.title || DEFAULT_NOTE_TITLE)
        qc.setQueryData([...NOTE_KEY, uuid], ctx.prevSingleNote)
      }
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      notifications.show({ color: 'red', message: "Couldn't rename note." })
    },
    onSettled: (_data, _err, { uuid }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: [...NOTE_KEY, uuid] })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  const openTab = useTabsStore((s) => s.open)

  return useMutation({
    mutationFn: async (payload: { folder_id?: UUID; uuid?: UUID; container?: Container }) => {
      const uuid = payload.uuid || crypto.randomUUID()
      const scope = useUiStore.getState().scope
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
        const created = await notesRepo.get(uuid)
        if (!created) throw new Error('Failed to create note')
        return created
      }

      return notesApi.createNote({ ...payload, uuid })
    },
    onMutate: async (payload) => {
      const uuid = payload.uuid || crypto.randomUUID()
      payload.uuid = uuid

      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal = qc.getQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY)

      const scope = useUiStore.getState().scope
      const container: Container = payload.container ?? scope.container ?? (isNative() ? 'local' : 'cloud')
      const isLocal = container === 'local'

      // 1. Open tab immediately
      openTab(uuid, DEFAULT_NOTE_TITLE)

      // 2. Populate single note cache optimistically
      let currentFolder: { uuid: UUID; name: string } | null = null
      if (payload.folder_id) {
        if (isLocal) {
          const localFoldersList = prevLocal?.folders ?? []
          const found = localFoldersList.find((f) => f.uuid === payload.folder_id)
          currentFolder = found ? { uuid: found.uuid, name: found.name } : null
        } else {
          const foldersList = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
          const found = foldersList.find((f) => f.uuid === payload.folder_id)
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
      qc.setQueryData([...NOTE_KEY, uuid], optimisticNote)

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
        const first = old.pages[0]
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
        qc.setQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY, (old) => {
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
        qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
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
    onError: (_err, _v, ctx) => {
      if (ctx?.uuid) {
        useTabsStore.getState().close(ctx.uuid)
      }
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      notifications.show({ color: 'red', message: "Couldn't create note." })
    },
    onSuccess: (newNote) => {
      qc.setQueryData([...NOTE_KEY, newNote.uuid], newNote)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useTrashNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (uuid: string) => {
      if (isNative()) {
        const note = await notesRepo.get(uuid)
        const currentContainer = note?.container ?? (useUiStore.getState().scope.container ?? 'local')
        const isLocal = currentContainer === 'local'
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

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal = qc.getQueryData(LOCAL_SIDEBAR_KEY)

      // Find note in cached pages to get starred / folder info
      let trashedItem: NoteListItem | undefined
      for (const [, queryData] of prevNotes) {
        const pagesData = queryData as { pages?: notesApi.NotesPage[] }
        const item = pagesData?.pages?.flatMap((p) => p.data).find((n) => n.uuid === uuid)
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
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.filter((n: NoteListItem) => n.uuid !== uuid),
          })),
        }
      })

      // Update counts strictly in matching container
      const noteContainer = trashedItem?.container ?? useUiStore.getState().scope.container ?? 'local'
      const isLocal = noteContainer === 'local'

      if (isLocal) {
        qc.setQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY, (old) => {
          if (!old) return old
          const nextFolderCounts = { ...old.counts?.folders }
          const folderUuid = trashedItem?.folder?.uuid
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
        qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
          if (!old) return old
          const nextFolderCounts = { ...old.counts?.folders }
          const folderUuid = trashedItem?.folder?.uuid
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
    onError: (_err, _v, ctx) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      notifications.show({ color: 'red', message: "Couldn't move note to trash." })
    },
    onSettled: (_data, _err, uuid) => {
      qc.removeQueries({ queryKey: [...NOTE_KEY, uuid] })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useRestoreNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (uuid: string) => {
      if (isNative()) {
        const note = await notesRepo.get(uuid)
        const currentContainer = note?.container ?? (useUiStore.getState().scope.container ?? 'local')
        const isLocal = currentContainer === 'local'
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

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal = qc.getQueryData(LOCAL_SIDEBAR_KEY)

      // Remove from trash list
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.filter((n: NoteListItem) => n.uuid !== uuid),
          })),
        }
      })

      // Update counts strictly in matching container
      const isLocal = useUiStore.getState().scope.container === 'local'

      if (isLocal) {
        qc.setQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY, (old) => {
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
        qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
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
    onError: (_err, _v, ctx) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      notifications.show({ color: 'red', message: "Couldn't restore note." })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useForceDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (uuid: string) => {
      if (isNative()) {
        const note = await notesRepo.get(uuid)
        const currentContainer = note?.container ?? (useUiStore.getState().scope.container ?? 'local')
        const isLocal = currentContainer === 'local'
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

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal = qc.getQueryData(LOCAL_SIDEBAR_KEY)

      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.filter((n: NoteListItem) => n.uuid !== uuid),
          })),
        }
      })

      // Update counts strictly in matching container
      const isLocal = useUiStore.getState().scope.container === 'local'

      if (isLocal) {
        qc.setQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY, (old) => {
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
        qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
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
    onError: (_err, _v, ctx) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      notifications.show({ color: 'red', message: "Couldn't permanently delete note." })
    },
    onSettled: (_data, _err, uuid) => {
      qc.removeQueries({ queryKey: [...NOTE_KEY, uuid] })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

export function useDuplicateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sourceUuid: string) => {
      if (isNative()) {
        const source = await notesRepo.get(sourceUuid)
        const isLocal = !source || source.container === 'local'
        if (isLocal) {
          const newUuid = crypto.randomUUID()
          const copyTitle = source?.title ? `${source.title}${COPY_NOTE_SUFFIX}` : `${DEFAULT_NOTE_TITLE}${COPY_NOTE_SUFFIX}`
          const now = new Date().toISOString()
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
          const created = await notesRepo.get(newUuid)
          if (!created) throw new Error('Failed to duplicate note')
          return created
        }
        const user = qc.getQueryData(AUTH_KEY)
        if (!user) throw new Error('Sign in required for cloud notes')
      }
      return notesApi.duplicateNote(sourceUuid)
    },
    onMutate: async (sourceUuid: string) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal = qc.getQueryData(LOCAL_SIDEBAR_KEY)
      const prevSingle = qc.getQueryData<Note>([...NOTE_KEY, sourceUuid])

      // Find the source note in cached queries if not in single query
      let sourceItem: NoteListItem | Note | undefined = prevSingle
      if (!sourceItem && prevNotes) {
        for (const [, data] of prevNotes) {
          const pages = (data as { pages?: notesApi.NotesPage[] })?.pages
          if (pages) {
            for (const page of pages) {
              const found = page.data.find((n) => n.uuid === sourceUuid)
              if (found) {
                sourceItem = found
                break
              }
            }
          }
          if (sourceItem) break
        }
      }

      const isLocal = sourceItem?.container === 'local' || (!sourceItem?.container && useUiStore.getState().scope.container === 'local')

      const tempUuid = crypto.randomUUID()
      const title = sourceItem
        ? (sourceItem.title === '' ? '' : `${sourceItem.title}${COPY_NOTE_SUFFIX}`)
        : `${DEFAULT_NOTE_TITLE}${COPY_NOTE_SUFFIX}`
      const folder = sourceItem?.folder ?? null
      const tags = sourceItem?.tags ?? []
      const excerpt = sourceItem?.excerpt ?? ''

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
        qc.setQueryData([...NOTE_KEY, tempUuid], optimisticNote)
      }

      // Prepend to note list queries
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length || !old.pages[0]) return old
        const first = old.pages[0]
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
        qc.setQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY, (old) => {
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
        qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
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
    onError: (_err, _v, ctx) => {
      if (ctx?.tempUuid) {
        qc.removeQueries({ queryKey: [...NOTE_KEY, ctx.tempUuid] })
      }
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      notifications.show({ color: 'red', message: "Couldn't duplicate note." })
    },
    onSuccess: async (realNote, _v, ctx) => {
      qc.setQueryData([...NOTE_KEY, realNote.uuid], realNote)
      if (isNative()) {
        const noteContainer = realNote.container ?? (useUiStore.getState().scope.container ?? 'local')
        const isLocal = noteContainer === 'local'
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
        qc.removeQueries({ queryKey: [...NOTE_KEY, ctx.tempUuid] })
        qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
          if (!old?.pages?.length) return old
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              data: p.data.map((n) => (n.uuid === ctx.tempUuid ? realNote : n)),
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
export function useSyncNoteTags() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ uuid, names }: { uuid: UUID; names: string[] }) => {
      if (isNative()) {
        const note = await notesRepo.get(uuid)
        const isLocal = !note || note.container === 'local'
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
    onMutate: async ({ uuid, names }) => {
      await qc.cancelQueries({ queryKey: [...NOTE_KEY, uuid] })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNote = qc.getQueryData<Note>([...NOTE_KEY, uuid])
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal = qc.getQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY)

      const isLocal = prevNote?.container === 'local' || (!prevNote?.container && useUiStore.getState().scope.container === 'local')

      // 1. Update single note query tags immediately
      if (prevNote) {
        qc.setQueryData<Note>([...NOTE_KEY, uuid], { ...prevNote, tags: names })
      }

      // 2. Update tags and tag counts strictly in matching container
      if (isLocal) {
        qc.setQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY, (old) => {
          if (!old) return old
          const currentTags = old.tags ?? []
          const currentNames = currentTags.map((t) => t.name)

          const addedTags: Tag[] = names
            .filter((name) => !currentNames.includes(name))
            .map((name) => ({
              uuid: crypto.randomUUID(),
              name,
              slug: slugify(name),
            }))

          const nextTags = [...currentTags, ...addedTags]
          const nextTagCounts = { ...old.counts?.tags }

          const prevNames = prevNote?.tags ?? []
          for (const added of names) {
            if (!prevNames.includes(added)) {
              const slug = slugify(added)
              nextTagCounts[slug] = (nextTagCounts[slug] ?? 0) + 1
            }
          }
          for (const removed of prevNames) {
            if (!names.includes(removed)) {
              const slug = slugify(removed)
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
        qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
          if (!old) return old
          const currentTags = getTagsArray(old.tags)
          const currentNames = currentTags.map((t) => t.name)

          const addedTags: Tag[] = names
            .filter((name) => !currentNames.includes(name))
            .map((name) => ({
              uuid: crypto.randomUUID(),
              name,
              slug: slugify(name),
            }))

          const nextTags = [...currentTags, ...addedTags]
          const nextTagCounts = { ...old.counts?.tags }

          const prevNames = prevNote?.tags ?? []
          for (const added of names) {
            if (!prevNames.includes(added)) {
              const slug = slugify(added)
              nextTagCounts[slug] = (nextTagCounts[slug] ?? 0) + 1
            }
          }
          for (const removed of prevNames) {
            if (!names.includes(removed)) {
              const slug = slugify(removed)
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
    onError: (_err, { uuid }, ctx) => {
      if (ctx?.prevNote) {
        qc.setQueryData([...NOTE_KEY, uuid], ctx.prevNote)
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      notifications.show({ color: 'red', message: "Couldn't update tags on note." })
    },
    onSettled: (_data, _err, { uuid }) => {
      qc.invalidateQueries({ queryKey: [...NOTE_KEY, uuid] })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

/** Optimistically move note to a folder or root */
export function useMoveNoteFolder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ uuid, folder_id }: { uuid: UUID; folder_id: UUID | null }) => {
      if (isNative()) {
        const note = await notesRepo.get(uuid)
        const isLocal = !note || note.container === 'local'
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
    onMutate: async ({ uuid, folder_id }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: [...NOTE_KEY, uuid] })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: LOCAL_SIDEBAR_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote = qc.getQueryData<Note>([...NOTE_KEY, uuid])
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevLocal = qc.getQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY)

      const noteContainer = prevSingleNote?.container ?? useUiStore.getState().scope.container ?? 'local'
      const isLocal = noteContainer === 'local'

      let targetFolder: { uuid: UUID; name: string } | null = null
      if (folder_id) {
        if (isLocal) {
          const localFoldersList = prevLocal?.folders ?? []
          const found = localFoldersList.find((f) => f.uuid === folder_id)
          targetFolder = found ? { uuid: found.uuid, name: found.name } : null
        } else {
          const cloudFoldersList = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
          const found = cloudFoldersList.find((f) => f.uuid === folder_id)
          targetFolder = found ? { uuid: found.uuid, name: found.name } : null
        }
      }

      const prevFolderUuid = prevSingleNote?.folder?.uuid

      // 1. Update single note query
      if (prevSingleNote) {
        qc.setQueryData<Note>([...NOTE_KEY, uuid], {
          ...prevSingleNote,
          folder: targetFolder,
        })
      }

      // 2. Update note lists
      qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: notesApi.NotesPage[] } | undefined) => {
        if (!old?.pages?.length) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.map((n: NoteListItem) => (n.uuid === uuid ? { ...n, folder: targetFolder } : n)),
          })),
        }
      })

      // 3. Update folder counts (strictly in matching container)
      if (isLocal) {
        qc.setQueryData<{ folders: Folder[]; tags: Tag[]; counts: Counts }>(LOCAL_SIDEBAR_KEY, (old) => {
          if (!old) return old
          const nextFolderCounts = { ...old.counts?.folders }
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
        qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
          if (!old) return old
          const nextFolderCounts = { ...old.counts?.folders }
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
    onError: (_err, { uuid }, ctx) => {
      if (ctx?.prevSingleNote) {
        qc.setQueryData([...NOTE_KEY, uuid], ctx.prevSingleNote)
      }
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      if (ctx?.prevLocal) {
        qc.setQueryData(LOCAL_SIDEBAR_KEY, ctx.prevLocal)
      }
      notifications.show({ color: 'red', message: "Couldn't move note to folder." })
    },
    onSettled: (_data, _err, { uuid }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: [...NOTE_KEY, uuid] })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    },
  })
}

