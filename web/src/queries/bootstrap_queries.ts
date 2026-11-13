import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'

import type { ApiError } from '@src/api/api_client'
import { fetchBootstrap } from '@src/api/bootstrap_api'
import { BOOTSTRAP_KEY, LOCAL_SIDEBAR_KEY } from '@src/constants/query_keys'
import { foldersRepo } from '@src/db/folders_repo'
import { notesRepo } from '@src/db/notes_repo'
import { tagsRepo } from '@src/db/tags_repo'
import { isNative } from '@src/platform/is_native'
import type { Bootstrap, Counts, Folder, NoteListItem, Tag, User } from '@src/types/api'
import type { ILocalSidebar } from '@src/types/mutation_context'
import { getFoldersArray, getTagsArray } from '@src/utils/bootstrap_lists'
import { slugify } from '@src/utils/slugify'

export { BOOTSTRAP_KEY, LOCAL_SIDEBAR_KEY }

/** useBootstrap's query plus the lists it unwraps from the response. */
export type TBootstrapResult = UseQueryResult<Bootstrap, ApiError> & {
  user:         User | null
  folders:      Folder[]
  tags:         Tag[]
  counts:       Counts | null
  initialNotes: NoteListItem[]
}

export function useLocalSidebar(): UseQueryResult<ILocalSidebar | null, ApiError> {
  const native: boolean = isNative()
  return useQuery<ILocalSidebar | null>({
    queryKey: LOCAL_SIDEBAR_KEY,
    queryFn:  async () => {
      if (!native) return null
      const [f, t, notes, trashed] = await Promise.all([
        foldersRepo.list('local'),
        tagsRepo.list('local'),
        notesRepo.list('local'),
        notesRepo.list('local', { trashed: true }),
      ])
      const folderCounts: Record<string, number> = {}
      notes.forEach((n: NoteListItem) => {
        if (n.folder?.uuid) {
          folderCounts[n.folder.uuid] = (folderCounts[n.folder.uuid] ?? 0) + 1
        }
      })
      const starred: number = notes.filter((n: NoteListItem) => n.is_starred).length
      const tagCounts: Record<string, number> = {}
      notes.forEach((n: NoteListItem) => {
        n.tags?.forEach((tagName: string) => {
          const slug: string = slugify(tagName)
          tagCounts[slug] = (tagCounts[slug] ?? 0) + 1
        })
      })
      return {
        folders: f,
        tags:    t,
        counts:  {
          all:     notes.length,
          starred,
          trashed: trashed.length,
          folders: folderCounts,
          tags:    tagCounts,
        },
      }
    },
    enabled: native,
  })
}

const EMPTY_NOTES: NoteListItem[] = []

export function useBootstrap(): TBootstrapResult {
  const query: UseQueryResult<Bootstrap, ApiError> = useQuery({
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
          cloudNotes.forEach((n: NoteListItem) => {
            if (n.folder?.uuid) {
              folderCounts[n.folder.uuid] = (folderCounts[n.folder.uuid] ?? 0) + 1
            }
          })
          const starred: number = cloudNotes.filter((n: NoteListItem) => n.is_starred).length
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
