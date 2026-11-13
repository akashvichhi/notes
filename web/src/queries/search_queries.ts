import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseQueryResult } from '@tanstack/react-query'
import type Database from '@tauri-apps/plugin-sql'

import type { ApiError } from '@src/api/api_client'
import { search } from '@src/api/search_api'
import { MIN_SEARCH_QUERY_LENGTH } from '@src/constants/limits'
import { AUTH_KEY, queryKeys } from '@src/constants/query_keys'
import { getDb } from '@src/db/connection'
import { notesRepo } from '@src/db/notes_repo'
import { isNative } from '@src/platform/is_native'
import { useUiStore } from '@src/stores/ui_store'
import type { Scope, UiState } from '@src/stores/ui_store'
import type { Container, NoteListItem, SearchHit, SearchResults, Tag, UUID } from '@src/types/api'



/** MySQL's innodb_ft_min_token_size: below this the server cannot match anything. */
export const MIN_QUERY: number = MIN_SEARCH_QUERY_LENGTH

export function useSearch(q: string): UseQueryResult<SearchResults, ApiError> {
  const qc: QueryClient = useQueryClient()
  const trimmed: string = q.trim()
  const scope: Scope = useUiStore((s: UiState) => s.scope)
  const container: Container = scope.container ?? (isNative() ? 'local' : 'cloud')

  return useQuery({
    queryKey: queryKeys.search(trimmed, container),
    queryFn:  async ({ signal }: { signal: AbortSignal }): Promise<SearchResults> => {
      if (isNative()) {
        const terms: string[] = trimmed.split(/\s+/).filter(Boolean)
        const db: Database = await getDb()
        const likePattern: string = `%${trimmed.replace(/[%_]/g, '')}%`

        if (container === 'local') {
          // Strictly search local SQLite notes, folders, and tags
          const localNotes: NoteListItem[] = await notesRepo.search(trimmed, 'local')
          const notes: SearchHit[] = localNotes.map((n: NoteListItem) => ({
            uuid:    n.uuid,
            title:   n.title || 'Untitled note',
            snippet: n.excerpt || '',
            terms,
          }))

          const folders: { uuid: string; name: string; }[] = await db.select<{ uuid: string; name: string }[]>(
            'SELECT uuid, name FROM folders WHERE container = $1 AND name LIKE $2 AND deleted_at IS NULL LIMIT 10',
            ['local', likePattern],
          )
          const tags: Tag[] = await db.select<Tag[]>(
            'SELECT uuid, name, slug FROM tags WHERE container = $1 AND name LIKE $2 AND deleted_at IS NULL LIMIT 10',
            ['local', likePattern],
          )

          return { notes, folders, tags }
        }

        // Strictly cloud container
        const cloudCachedNotes: NoteListItem[] = await notesRepo.search(trimmed, 'cloud')
        const cloudHits: SearchHit[] = cloudCachedNotes.map((n: NoteListItem) => ({
          uuid:    n.uuid,
          title:   n.title || 'Untitled note',
          snippet: n.excerpt || '',
          terms,
        }))

        const cloudFoldersCached: { uuid: string; name: string; }[] = await db.select<{ uuid: string; name: string }[]>(
          'SELECT uuid, name FROM folders WHERE container = $1 AND name LIKE $2 AND deleted_at IS NULL LIMIT 10',
          ['cloud', likePattern],
        )
        const cloudTagsCached: Tag[] = await db.select<Tag[]>(
          'SELECT uuid, name, slug FROM tags WHERE container = $1 AND name LIKE $2 AND deleted_at IS NULL LIMIT 10',
          ['cloud', likePattern],
        )

        let cloudRemoteResults: SearchResults = { notes: [], folders: [], tags: [] }
        const user: unknown = qc.getQueryData(AUTH_KEY)
        if (user && navigator.onLine) {
          try {
            cloudRemoteResults = await search(trimmed, signal)
          } catch {
            // Server error or offline; return cloud SQLite results
          }
        }

        const seenNotes: Set<string> = new Set<string>()
        const notes: SearchHit[] = []
        for (const hit of [...cloudHits, ...cloudRemoteResults.notes]) {
          if (!seenNotes.has(hit.uuid)) {
            seenNotes.add(hit.uuid)
            notes.push(hit)
          }
        }

        const seenFolders: Set<string> = new Set<string>()
        const folders: { uuid: UUID; name: string }[] = []
        for (const f of [...cloudFoldersCached, ...cloudRemoteResults.folders]) {
          if (!seenFolders.has(f.uuid)) {
            seenFolders.add(f.uuid)
            folders.push(f)
          }
        }

        const seenTags: Set<string> = new Set<string>()
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
    placeholderData: keepPreviousData,
  })
}

