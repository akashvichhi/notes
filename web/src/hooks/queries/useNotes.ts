import { notifications } from '@mantine/notifications'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as notesApi from '@/api/notes'
import { useTabsStore } from '@/stores/tabsStore'
import type { Scope } from '@/stores/uiStore'
import type { NoteListItem, UUID } from '@/types/api'

import { BOOTSTRAP_KEY } from './useBootstrap'

export const NOTES_KEY = ['notes'] as const
export const NOTE_KEY = ['note'] as const

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

/** Optimistic star: waiting on a round-trip to see a star fill feels slow. */
export function useStarNote(scope: Scope) {
  const qc = useQueryClient()
  const key = [...NOTES_KEY, scope]

  return useMutation({
    mutationFn: ({ uuid, is_starred }: { uuid: string; is_starred: boolean }) =>
      notesApi.patchNote(uuid, { is_starred }),
    onMutate: async ({ uuid, is_starred }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData(key)

      qc.setQueryData(key, (old: { pages: notesApi.NotesPage[] } | undefined) =>
        old && {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.map((n: NoteListItem) => (n.uuid === uuid ? { ...n, is_starred } : n)),
          })),
        })

      return { previous }
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      notifications.show({ color: 'red', message: "Couldn't update that note." })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useRenameNote() {
  const qc = useQueryClient()
  const setTitle = useTabsStore((s) => s.setTitle)

  return useMutation({
    mutationFn: ({ uuid, title }: { uuid: string; title: string }) =>
      notesApi.patchNote(uuid, { title }),
    onSuccess: (updated) => {
      setTitle(updated.uuid, updated.title || 'Untitled')
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: [...NOTE_KEY, updated.uuid] })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      notifications.show({ message: 'Note renamed' })
    },
    onError: () => {
      notifications.show({ color: 'red', message: "Couldn't rename note." })
    },
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  const openTab = useTabsStore((s) => s.open)

  return useMutation({
    mutationFn: notesApi.createNote,
    onSuccess:  (newNote) => {
      openTab(newNote.uuid, newNote.title || 'Untitled')
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useTrashNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.trashNote,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      notifications.show({ message: 'Moved to Trash' })
    },
  })
}

export function useRestoreNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.restoreNote,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useForceDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.forceDeleteNote,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useDuplicateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.duplicateNote,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}
