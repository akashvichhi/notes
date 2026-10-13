import { notifications } from '@mantine/notifications'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as notesApi from '@/api/notes'
import { useTabsStore } from '@/stores/tabsStore'
import type { Scope } from '@/stores/uiStore'
import type { Bootstrap, Folder, Note, NoteListItem, Tag, UUID } from '@/types/api'

import { BOOTSTRAP_KEY } from './useBootstrap'

export const NOTES_KEY = ['notes'] as const
export const NOTE_KEY = ['note'] as const

function getFoldersArray(folders: Bootstrap['folders'] | undefined): Folder[] {
  if (!folders) return []
  return Array.isArray(folders) ? folders : (folders.data ?? [])
}

function getTagsArray(tags: Bootstrap['tags'] | undefined): Tag[] {
  if (!tags) return []
  return Array.isArray(tags) ? tags : (tags.data ?? [])
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[\s\W-]+/g, '-')
}

export function useNote(uuid?: UUID | null) {
  const closeTab = useTabsStore((s) => s.close)

  return useQuery({
    queryKey: [...NOTE_KEY, uuid],
    queryFn:  async () => {
      if (!uuid) return null
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
    enabled: Boolean(uuid),
    retry:   (failureCount, err) => {
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

export function useNotes(scope: Scope) {
  return useInfiniteQuery({
    queryKey: [...NOTES_KEY, scope],
    queryFn:  ({ pageParam }) =>
      notesApi.fetchNotes({
        ...scopeParams(scope),
        page: pageParam ? String(pageParam) : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page
        ? last.meta.current_page + 1
        : undefined,
  })
}

/** Optimistic star: update list, single note, and sidebar counts immediately */
export function useStarNote(_scope?: Scope) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ uuid, is_starred }: { uuid: string; is_starred: boolean }) =>
      notesApi.patchNote(uuid, { is_starred }),
    onMutate: async ({ uuid, is_starred }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: [...NOTE_KEY, uuid] })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote = qc.getQueryData<Note>([...NOTE_KEY, uuid])
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

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

      // 3. Update sidebar starred count
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const currentStarred = old.counts?.starred ?? 0
        const delta = is_starred ? 1 : -1
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
      notifications.show({ color: 'red', message: "Couldn't update that note." })
    },
    onSettled: (_data, _err, { uuid }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: [...NOTE_KEY, uuid] })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useRenameNote() {
  const qc = useQueryClient()
  const setTitle = useTabsStore((s) => s.setTitle)

  return useMutation({
    mutationFn: ({ uuid, title }: { uuid: string; title: string }) =>
      notesApi.patchNote(uuid, { title }),
    onMutate: async ({ uuid, title }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: [...NOTE_KEY, uuid] })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote = qc.getQueryData<Note>([...NOTE_KEY, uuid])
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // 1. Instantly update tab title in UI
      setTitle(uuid, title || 'Untitled')

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
        setTitle(uuid, ctx.prevSingleNote.title || 'Untitled')
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
    },
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  const openTab = useTabsStore((s) => s.open)

  return useMutation({
    mutationFn: (payload: { folder_id?: UUID; uuid?: UUID }) => {
      const uuid = payload.uuid || crypto.randomUUID()
      return notesApi.createNote({ ...payload, uuid })
    },
    onMutate: async (payload) => {
      const uuid = payload.uuid || crypto.randomUUID()
      payload.uuid = uuid

      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // 1. Open tab immediately
      openTab(uuid, 'Untitled')

      // 2. Populate single note cache optimistically
      const foldersList = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
      const currentFolder = payload.folder_id
        ? foldersList.find((f) => f.uuid === payload.folder_id) ?? null
        : null

      const optimisticNote: Note = {
        uuid,
        title:        'Untitled',
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
        title:      'Untitled',
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

      // 4. Update bootstrap counts
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

      return { prevNotes, prevBootstrap, uuid }
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
      notifications.show({ color: 'red', message: "Couldn't create note." })
    },
    onSuccess: (newNote) => {
      qc.setQueryData([...NOTE_KEY, newNote.uuid], newNote)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useTrashNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.trashNote,
    onMutate:   async (uuid: string) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

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

      // Update bootstrap counts
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

      return { prevNotes, prevBootstrap }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      notifications.show({ color: 'red', message: "Couldn't move note to trash." })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useRestoreNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.restoreNote,
    onMutate:   async (uuid: string) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

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

      // Update bootstrap counts
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

      return { prevNotes, prevBootstrap }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      notifications.show({ color: 'red', message: "Couldn't restore note." })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useForceDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.forceDeleteNote,
    onMutate:   async (uuid: string) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

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

      return { prevNotes, prevBootstrap }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      notifications.show({ color: 'red', message: "Couldn't permanently delete note." })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useDuplicateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.duplicateNote,
    onMutate:   async (sourceUuid: string) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
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

      const tempUuid = crypto.randomUUID()
      const title = sourceItem ? (sourceItem.title === '' ? '' : `${sourceItem.title} (copy)`) : 'Untitled (copy)'
      const folder = sourceItem?.folder ?? null
      const tags = sourceItem?.tags ?? []
      const excerpt = sourceItem?.excerpt ?? ''

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

      // Update bootstrap counts
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

      return { prevNotes, prevBootstrap, tempUuid }
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
      notifications.show({ color: 'red', message: "Couldn't duplicate note." })
    },
    onSuccess: (realNote, _v, ctx) => {
      qc.setQueryData([...NOTE_KEY, realNote.uuid], realNote)
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
    },
  })
}

/** Optimistically sync/toggle tags on a note */
export function useSyncNoteTags() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ uuid, names }: { uuid: UUID; names: string[] }) =>
      notesApi.syncNoteTags(uuid, names),
    onMutate: async ({ uuid, names }) => {
      await qc.cancelQueries({ queryKey: [...NOTE_KEY, uuid] })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNote = qc.getQueryData<Note>([...NOTE_KEY, uuid])
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      // 1. Update single note query tags immediately
      if (prevNote) {
        qc.setQueryData<Note>([...NOTE_KEY, uuid], { ...prevNote, tags: names })
      }

      // 2. Update bootstrap tags and tag counts immediately
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const currentTags = getTagsArray(old.tags)
        const currentNames = currentTags.map((t) => t.name)

        // Add any brand new tags optimistically
        const addedTags: Tag[] = names
          .filter((name) => !currentNames.includes(name))
          .map((name) => ({
            uuid: crypto.randomUUID(),
            name,
            slug: slugify(name),
          }))

        const nextTags = [...currentTags, ...addedTags]
        const nextTagCounts = { ...old.counts?.tags }

        // Recalculate delta for old tags vs new tags on this note
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

      return { prevNote, prevBootstrap }
    },
    onError: (_err, { uuid }, ctx) => {
      if (ctx?.prevNote) {
        qc.setQueryData([...NOTE_KEY, uuid], ctx.prevNote)
      }
      if (ctx?.prevBootstrap) {
        qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      }
      notifications.show({ color: 'red', message: "Couldn't update tags on note." })
    },
    onSettled: (_data, _err, { uuid }) => {
      qc.invalidateQueries({ queryKey: [...NOTE_KEY, uuid] })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
    },
  })
}

/** Optimistically move note to a folder or root */
export function useMoveNoteFolder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ uuid, folder_id }: { uuid: UUID; folder_id: UUID | null }) =>
      notesApi.patchNote(uuid, { folder_id }),
    onMutate: async ({ uuid, folder_id }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      await qc.cancelQueries({ queryKey: [...NOTE_KEY, uuid] })
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })

      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })
      const prevSingleNote = qc.getQueryData<Note>([...NOTE_KEY, uuid])
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)

      const foldersList = prevBootstrap ? getFoldersArray(prevBootstrap.folders) : []
      const targetFolder = folder_id ? foldersList.find((f) => f.uuid === folder_id) ?? null : null
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

      // 3. Update bootstrap counts
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const nextFolderCounts = { ...old.counts?.folders }
        if (prevFolderUuid && nextFolderCounts[prevFolderUuid] !== undefined) {
          nextFolderCounts[prevFolderUuid] = Math.max(0, nextFolderCounts[prevFolderUuid] - 1)
        }
        if (folder_id && nextFolderCounts[folder_id] !== undefined) {
          nextFolderCounts[folder_id] = nextFolderCounts[folder_id] + 1
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
      notifications.show({ color: 'red', message: "Couldn't move note to folder." })
    },
    onSettled: (_data, _err, { uuid }) => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: [...NOTE_KEY, uuid] })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

