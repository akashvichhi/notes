import { useQuery, useQueryClient } from '@tanstack/react-query'

import { search } from '@/api/search'
import { MIN_SEARCH_QUERY_LENGTH } from '@/constants/limits'
import { AUTH_KEY, queryKeys } from '@/constants/queryKeys'
import { getDb } from '@/db/connection'
import { notesRepo } from '@/db/notesRepo'
import { isNative } from '@/platform/isNative'
import type { SearchHit, SearchResults, Tag, UUID } from '@/types/api'

/** MySQL's innodb_ft_min_token_size: below this the server cannot match anything. */
export const MIN_QUERY = MIN_SEARCH_QUERY_LENGTH

export function useSearch(q: string) {
  const qc = useQueryClient()
  const trimmed = q.trim()

  return useQuery({
    queryKey: queryKeys.search(trimmed),
    queryFn:  async ({ signal }): Promise<SearchResults> => {
      if (isNative()) {
        const terms = trimmed.split(/\s+/).filter(Boolean)
        const db = await getDb()

        // 1. Search local SQLite notes
        const localNotes = await notesRepo.search(trimmed)
        const localHits: SearchHit[] = localNotes.map((n) => ({
          uuid:    n.uuid,
          title:   n.title || 'Untitled note',
          snippet: n.excerpt || '',
          terms,
        }))

        // 2. Search local folders and tags
        const likePattern = `%${trimmed.replace(/[%_]/g, '')}%`
        const localFolders = await db.select<{ uuid: string; name: string }[]>(
          'SELECT uuid, name FROM folders WHERE name LIKE $1 AND deleted_at IS NULL LIMIT 10',
          [likePattern],
        )
        const localTags = await db.select<Tag[]>(
          'SELECT uuid, name, slug FROM tags WHERE name LIKE $1 AND deleted_at IS NULL LIMIT 10',
          [likePattern],
        )

        // 3. Search cloud notes if signed in
        let cloudResults: SearchResults = { notes: [], folders: [], tags: [] }
        const user = qc.getQueryData(AUTH_KEY)
        if (user) {
          try {
            cloudResults = await search(trimmed, signal)
          } catch {
            // Offline or server unreachable; return local results
          }
        }

        // 4. Merge and deduplicate results
        const seenNotes = new Set<string>()
        const notes: SearchHit[] = []
        for (const hit of [...localHits, ...cloudResults.notes]) {
          if (!seenNotes.has(hit.uuid)) {
            seenNotes.add(hit.uuid)
            notes.push(hit)
          }
        }

        const seenFolders = new Set<string>()
        const folders: { uuid: UUID; name: string }[] = []
        for (const f of [...localFolders, ...cloudResults.folders]) {
          if (!seenFolders.has(f.uuid)) {
            seenFolders.add(f.uuid)
            folders.push(f)
          }
        }

        const seenTags = new Set<string>()
        const tags: Tag[] = []
        for (const t of [...localTags, ...cloudResults.tags]) {
          if (!seenTags.has(t.slug)) {
            seenTags.add(t.slug)
            tags.push(t)
          }
        }

        return { notes, folders, tags }
      }

      return search(trimmed, signal)
    },
    enabled:         trimmed.length >= MIN_QUERY,
    placeholderData: (previous) => previous,
  })
}

