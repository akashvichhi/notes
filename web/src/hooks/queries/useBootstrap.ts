import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'


import { fetchBootstrap } from '@/api/bootstrap'
import { BOOTSTRAP_KEY } from '@/constants/queryKeys'
import { foldersRepo } from '@/db/foldersRepo'
import { notesRepo } from '@/db/notesRepo'
import { tagsRepo } from '@/db/tagsRepo'
import { getFoldersArray, getTagsArray } from '@/lib/bootstrap'
import { isNative } from '@/platform/isNative'
import type { Bootstrap, Counts, NoteListItem, User } from '@/types/api'

export { BOOTSTRAP_KEY }

const EMPTY_NOTES: NoteListItem[] = []

export function useBootstrap() {
  const query = useQuery({
    queryKey: BOOTSTRAP_KEY,
    queryFn:  async () => {
      if (isNative()) {
        try {
          const [cloudFolders, cloudTags, cloudNotes, cloudTrashed] = await Promise.all([
            foldersRepo.list('cloud'),
            tagsRepo.list('cloud'),
            notesRepo.list('cloud'),
            notesRepo.list('cloud', { trashed: true }),
          ])
          const folderCounts: Record<string, number> = {}
          cloudNotes.forEach((n) => {
            if (n.folder?.uuid) {
              folderCounts[n.folder.uuid] = (folderCounts[n.folder.uuid] ?? 0) + 1
            }
          })
          const starred = cloudNotes.filter((n) => n.is_starred).length
          const counts: Counts = {
            all:     cloudNotes.length,
            starred,
            trashed: cloudTrashed.length,
            folders: folderCounts,
            tags:    {},
          }
          return {
            user:    null,
            folders: cloudFolders,
            tags:    cloudTags,
            counts,
            notes:   cloudNotes,
          } as unknown as Bootstrap
        } catch {
          return {
            user:    null,
            folders: [],
            tags:    [],
            counts:  { all: 0, starred: 0, trashed: 0, folders: {}, tags: {} },
            notes:   [],
          } as unknown as Bootstrap
        }
      }
      return fetchBootstrap()
    },
  })
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
