import { useQuery } from '@tanstack/react-query'

import { useMemo } from 'react'

import { fetchBootstrap } from '@/api/bootstrap'
import type { Folder, NoteListItem, Tag, User } from '@/types/api'

export const BOOTSTRAP_KEY = ['bootstrap'] as const

const EMPTY_FOLDERS: Folder[] = []
const EMPTY_TAGS: Tag[] = []
const EMPTY_NOTES: NoteListItem[] = []

export function useBootstrap() {
  const query = useQuery({ queryKey: BOOTSTRAP_KEY, queryFn: fetchBootstrap })

  const user = useMemo<User | null>(() => query.data?.user.data ?? null, [query.data?.user.data])
  const folders = useMemo<Folder[]>(() => query.data?.folders.data ?? EMPTY_FOLDERS, [query.data?.folders.data])
  const tags = useMemo<Tag[]>(() => query.data?.tags.data ?? EMPTY_TAGS, [query.data?.tags.data])
  const counts = useMemo(() => query.data?.counts ?? null, [query.data?.counts])
  const initialNotes = useMemo<NoteListItem[]>(
    () => query.data?.notes.data ?? EMPTY_NOTES,
    [query.data?.notes.data]
  )

  return useMemo(
    () => ({
      ...query,
      user,
      folders,
      tags,
      counts,
      initialNotes,
    }),
    [query, user, folders, tags, counts, initialNotes]
  )
}
