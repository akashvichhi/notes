import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'


import { fetchBootstrap } from '@/api/bootstrap'
import type { Folder, NoteListItem, Tag, User } from '@/types/api'

export const BOOTSTRAP_KEY = ['bootstrap'] as const

const EMPTY_FOLDERS: Folder[] = []
const EMPTY_TAGS: Tag[] = []
const EMPTY_NOTES: NoteListItem[] = []

export function useBootstrap() {
  const query = useQuery({ queryKey: BOOTSTRAP_KEY, queryFn: fetchBootstrap })
  const data = query.data

  const user = useMemo<User | null>(() => {
    const raw = data?.user
    if (!raw) return null
    return 'data' in raw ? raw.data : raw
  }, [data?.user])

  const folders = useMemo<Folder[]>(() => {
    const raw = data?.folders
    if (!raw) return EMPTY_FOLDERS
    return Array.isArray(raw) ? raw : raw.data ?? EMPTY_FOLDERS
  }, [data?.folders])

  const tags = useMemo<Tag[]>(() => {
    const raw = data?.tags
    if (!raw) return EMPTY_TAGS
    return Array.isArray(raw) ? raw : raw.data ?? EMPTY_TAGS
  }, [data?.tags])

  const counts = useMemo(() => data?.counts ?? null, [data?.counts])

  const initialNotes = useMemo<NoteListItem[]>(() => {
    const raw = data?.notes
    if (!raw) return EMPTY_NOTES
    return Array.isArray(raw) ? raw : raw.data ?? EMPTY_NOTES
  }, [data?.notes])

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
