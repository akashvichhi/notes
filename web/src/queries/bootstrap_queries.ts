import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import { fetchBootstrap } from '@src/api/bootstrap_api'
import { BOOTSTRAP_KEY } from '@src/constants/query_keys'
import type { IBootstrap, INoteCounts, IFolder, INoteListItem, ITag, IUser } from '@src/types/api'
import { getFoldersArray, getTagsArray } from '@src/utils/bootstrap_lists'

export { BOOTSTRAP_KEY }

/** useBootstrap's query plus the lists it unwraps from the response. */
export type TBootstrapResult = UseQueryResult<IBootstrap, IApiError> & {
  user:         IUser | null
  folders:      IFolder[]
  tags:         ITag[]
  counts:       INoteCounts | null
  initialNotes: INoteListItem[]
}

const EMPTY_NOTES: INoteListItem[] = []

export function useBootstrap(): TBootstrapResult {
  const query: UseQueryResult<IBootstrap, IApiError> = useQuery({
    queryKey: BOOTSTRAP_KEY,
    queryFn:  fetchBootstrap,
  })
  const data: IBootstrap | undefined = query.data

  const user: IUser | null = useMemo<IUser | null>(() => data?.user ?? null, [data?.user])

  const folders: IFolder[] = useMemo(() => getFoldersArray(data?.folders), [data?.folders])
  const tags: ITag[] = useMemo(() => getTagsArray(data?.tags), [data?.tags])

  const counts: INoteCounts | null = useMemo(() => data?.counts ?? null, [data?.counts])

  const initialNotes: INoteListItem[] = useMemo<INoteListItem[]>(() => data?.notes ?? EMPTY_NOTES, [data?.notes])

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
