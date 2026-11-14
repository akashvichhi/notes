import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'

import type { ApiError } from '@src/api/api_client'
import { fetchBootstrap } from '@src/api/bootstrap_api'
import { BOOTSTRAP_KEY } from '@src/constants/query_keys'
import type { Bootstrap, Counts, Folder, NoteListItem, Tag, User } from '@src/types/api'
import { getFoldersArray, getTagsArray } from '@src/utils/bootstrap_lists'

export { BOOTSTRAP_KEY }

/** useBootstrap's query plus the lists it unwraps from the response. */
export type TBootstrapResult = UseQueryResult<Bootstrap, ApiError> & {
  user:         User | null
  folders:      Folder[]
  tags:         Tag[]
  counts:       Counts | null
  initialNotes: NoteListItem[]
}

const EMPTY_NOTES: NoteListItem[] = []

export function useBootstrap(): TBootstrapResult {
  const query: UseQueryResult<Bootstrap, ApiError> = useQuery({
    queryKey: BOOTSTRAP_KEY,
    queryFn:  fetchBootstrap,
  })
  const data: Bootstrap | undefined = query.data

  const user: User | null = useMemo<User | null>(() => {
    const raw: User | { data: User; } | undefined = data?.user
    if (!raw) return null
    return 'data' in raw ? raw.data : raw
  }, [data?.user])

  const folders: Folder[] = useMemo(() => getFoldersArray(data?.folders), [data?.folders])
  const tags: Tag[] = useMemo(() => getTagsArray(data?.tags), [data?.tags])

  const counts: Counts | null = useMemo(() => data?.counts ?? null, [data?.counts])

  const initialNotes: NoteListItem[] = useMemo<NoteListItem[]>(() => {
    const raw: NoteListItem[] | { data: NoteListItem[]; } | undefined = data?.notes
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
