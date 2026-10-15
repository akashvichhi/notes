import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'


import { fetchBootstrap } from '@/api/bootstrap'
import { BOOTSTRAP_KEY } from '@/constants/queryKeys'
import { getFoldersArray, getTagsArray } from '@/lib/bootstrap'
import type { NoteListItem, User } from '@/types/api'

export { BOOTSTRAP_KEY }

const EMPTY_NOTES: NoteListItem[] = []

export function useBootstrap() {
  const query = useQuery({ queryKey: BOOTSTRAP_KEY, queryFn: fetchBootstrap })
  const data = query.data

  const user = useMemo<User | null>(() => {
    const raw = data?.user
    if (!raw) return null
    return 'data' in raw ? raw.data : raw
  }, [data?.user])

  const folders = useMemo(() => getFoldersArray(data?.folders), [data?.folders])
  const tags = useMemo(() => getTagsArray(data?.tags), [data?.tags])

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
