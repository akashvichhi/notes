import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'

import * as notesApi from '@/api/notes'
import { BOOTSTRAP_KEY } from './useBootstrap'
import type { Scope } from '@/stores/uiStore'
import type { NoteListItem, UUID } from '@/types/api'

export const NOTES_KEY = ['notes'] as const
export const NOTE_KEY = ['note'] as const

export function useNote(uuid?: UUID | null) {
  return useQuery({
    queryKey: [...NOTE_KEY, uuid],
    queryFn: () => (uuid ? notesApi.fetchNote(uuid) : null),
    enabled: Boolean(uuid),
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
    queryFn: ({ pageParam }) =>
      notesApi.fetchNotes({ ...scopeParams(scope), cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
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

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.createNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useTrashNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.trashNote,
    onSuccess: () => {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useForceDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.forceDeleteNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useDuplicateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.duplicateNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}
