import { useQuery, useQueryClient } from '@tanstack/react-query'

import { search } from '@/api/search'
import { MIN_SEARCH_QUERY_LENGTH } from '@/constants/limits'
import { AUTH_KEY, queryKeys } from '@/constants/queryKeys'
import { getDb } from '@/db/connection'
import { notesRepo } from '@/db/notesRepo'
import { isNative } from '@/platform/isNative'
import { useUiStore } from '@/stores/uiStore'
import type { Container, SearchHit, SearchResults, Tag, UUID } from '@/types/api'

/** MySQL's innodb_ft_min_token_size: below this the server cannot match anything. */
export const MIN_QUERY = MIN_SEARCH_QUERY_LENGTH

export function useSearch(q: string) {
  const qc = useQueryClient()
  const trimmed = q.trim()
  const scope = useUiStore((s) => s.scope)
  const container: Container = scope.container ?? (isNative() ? 'local' : 'cloud')

  return useQuery({
    queryKey: [...queryKeys.search(trimmed), container],
    queryFn:  async ({ signal }): Promise<SearchResults> => {
      if (isNative()) {
        const terms = trimmed.split(/\s+/).filter(Boolean)
        const db = await getDb()
        const likePattern = `%${trimmed.replace(/[%_]/g, '')}%`

        if (container === 'local') {
          // Strictly search local SQLite notes, folders, and tags
          const localNotes = await notesRepo.search(trimmed, 'local')
          const notes: SearchHit[] = localNotes.map((n) => ({
            uuid:    n.uuid,
            title:   n.title || 'Untitled note',
            snippet: n.excerpt || '',
            terms,
          }))

          const folders = await db.select<{ uuid: string; name: string }[]>(
            'SELECT uuid, name FROM folders WHERE container = $1 AND name LIKE $2 AND deleted_at IS NULL LIMIT 10',
            ['local', likePattern],
          )
          const tags = await db.select<Tag[]>(
            'SELECT uuid, name, slug FROM tags WHERE container = $1 AND name LIKE $2 AND deleted_at IS NULL LIMIT 10',
            ['local', likePattern],
          )

          return { notes, folders, tags }
        }

        // Strictly cloud container
        const cloudCachedNotes = await notesRepo.search(trimmed, 'cloud')
        const cloudHits: SearchHit[] = cloudCachedNotes.map((n) => ({
          uuid:    n.uuid,
          title:   n.title || 'Untitled note',
          snippet: n.excerpt || '',
          terms,
        }))

        const cloudFoldersCached = await db.select<{ uuid: string; name: string }[]>(
          'SELECT uuid, name FROM folders WHERE container = $1 AND name LIKE $2 AND deleted_at IS NULL LIMIT 10',
          ['cloud', likePattern],
        )
        const cloudTagsCached = await db.select<Tag[]>(
          'SELECT uuid, name, slug FROM tags WHERE container = $1 AND name LIKE $2 AND deleted_at IS NULL LIMIT 10',
          ['cloud', likePattern],
        )

        let cloudRemoteResults: SearchResults = { notes: [], folders: [], tags: [] }
        const user = qc.getQueryData(AUTH_KEY)
        if (user && navigator.onLine) {
          try {
            cloudRemoteResults = await search(trimmed, signal)
          } catch {
            // Server error or offline; return cloud SQLite results
          }
        }

        const seenNotes = new Set<string>()
        const notes: SearchHit[] = []
        for (const hit of [...cloudHits, ...cloudRemoteResults.notes]) {
          if (!seenNotes.has(hit.uuid)) {
            seenNotes.add(hit.uuid)
            notes.push(hit)
          }
        }

        const seenFolders = new Set<string>()
        const folders: { uuid: UUID; name: string }[] = []
        for (const f of [...cloudFoldersCached, ...cloudRemoteResults.folders]) {
          if (!seenFolders.has(f.uuid)) {
            seenFolders.add(f.uuid)
            folders.push(f)
          }
        }

        const seenTags = new Set<string>()
        const tags: Tag[] = []
        for (const t of [...cloudTagsCached, ...cloudRemoteResults.tags]) {
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

