import { useCallback, useState } from 'react'

import { type Query, type QueryClient, useQueryClient } from '@tanstack/react-query'
import { HttpStatusCode } from 'axios'

import { MESSAGES } from '@src/constants/messages'
import { normalizeError } from '@src/api/api_client'
import { fetchNote } from '@src/api/notes_api'
import { BOOTSTRAP_KEY, LOCAL_SIDEBAR_KEY, NOTE_KEY, NOTES_KEY, queryKeys } from '@src/constants/query_keys'
import { clearDraft } from '@src/db/drafts_store'
import { notesRepo } from '@src/db/notes_repo'
import { tagsRepo } from '@src/db/tags_repo'
import { isNative } from '@src/platform/is_native'
import { type Tab, useTabsStore } from '@src/stores/tabs_store'
import { useUiStore } from '@src/stores/ui_store'
import { type OutboxItem, outbox } from '@src/sync/outbox'
import { pull } from '@src/sync/pull'
import type { Note, UUID } from '@src/types/api'
import { showErrorToast, showSuccessToast } from '@src/utils/notifications'

export interface IRefreshFromServer {
  isRefreshing: boolean
  refresh:      () => Promise<void>
}

/** The header's refresh: drops unsaved edits of open notes and reloads everything from the server. */
export function useRefreshFromServer(): IRefreshFromServer {
  const qc: QueryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  const refresh: () => Promise<void> = useCallback(async (): Promise<void> => {
    try {
      setIsRefreshing(true)

      // 1. Cancel pending editor autosave or debounce to accept risk of losing unsaved edits
      const cancelSave: (() => void) | null = useUiStore.getState().cancelPendingSave
      if (cancelSave) {
        cancelSave()
      }

      // Mark all tabs as not dirty and clear any localStorage drafts
      const tabs: Tab[] = useTabsStore.getState().tabs
      for (const t of tabs) {
        useTabsStore.getState().setDirty(t.uuid, false)
        void clearDraft(t.uuid)
      }

      // 2. Find all notes currently loaded and cached in React Query
      const cachedNoteQueries: Query[] = qc.getQueryCache().findAll({ queryKey: NOTE_KEY })
      const cachedNoteUuids: UUID[] = cachedNoteQueries
        .map((q: Query): unknown => q.queryKey[1])
        .filter((u: unknown): u is UUID => typeof u === 'string' && Boolean(u))

      if (isNative()) {
        if (!navigator.onLine) {
          showErrorToast(MESSAGES.REFRESH_OFFLINE)
          return
        }

        // Discard pending unpushed outbox ops for cached notes so unsaved edits do not overwrite server
        const pendingOps: OutboxItem[] = await outbox.pending()
        const cachedSet: Set<UUID> = new Set<UUID>(cachedNoteUuids)
        for (const op of pendingOps) {
          if (cachedSet.has(op.uuid)) {
            await outbox.remove(op.id)
          }
        }

        // Pull full remote bootstrap, folders, tags, active notes list, trashed notes, and prune deleted items
        await pull()

        // Fetch fresh note details for every note that was opened and cached in React Query
        await Promise.all(
          cachedNoteUuids.map(async (uuid: UUID): Promise<void> => {
            try {
              const local: Note | null = await notesRepo.get(uuid)
              if (local?.container === 'local') {
              // Local notes refresh directly from SQLite
                const freshLocal: Note | null = await notesRepo.get(uuid, 'local')
                if (freshLocal) {
                  qc.setQueryData(queryKeys.notes.detail(uuid), freshLocal)
                  useTabsStore.getState().setTitle(uuid, freshLocal.title)
                }
                return
              }

              // Cloud note: fetch latest from server
              const remote: Note = await fetchNote(uuid)
              if (remote) {
                await notesRepo.upsert({
                  uuid:            remote.uuid,
                  container:       'cloud',
                  folder_uuid:     remote.folder?.uuid ?? null,
                  title:           remote.title,
                  title_locked:    Boolean(remote.title_locked),
                  body:            remote.body,
                  plain_text:      remote.plain_text ?? '',
                  excerpt:         remote.excerpt,
                  is_starred:      Boolean(remote.is_starred),
                  word_count:      remote.word_count,
                  updated_at:      remote.updated_at,
                  deleted_at:      remote.deleted_at,
                  server_version:  remote.version,
                  server_revision: null,
                  dirty:           false,
                })
                if (remote.tags) {
                  await tagsRepo.setNoteTags(remote.uuid, remote.tags, 'cloud')
                }
                qc.setQueryData(queryKeys.notes.detail(uuid), remote)
                useTabsStore.getState().setTitle(uuid, remote.title)
              }
            } catch (err: unknown) {
              if (normalizeError(err).status === HttpStatusCode.NotFound) {
                useTabsStore.getState().close(uuid)
                qc.removeQueries({ queryKey: queryKeys.notes.detail(uuid) })
                await notesRepo.hardDelete(uuid, 'cloud')
              }
            }
          })
        )
      } else {
      // Web platform: fetch latest from server for all cached notes
        if (!navigator.onLine) {
          showErrorToast(MESSAGES.REFRESH_OFFLINE)
          return
        }

        await Promise.all(
          cachedNoteUuids.map(async (uuid: UUID): Promise<void> => {
            try {
              const remote: Note = await fetchNote(uuid)
              if (remote) {
                qc.setQueryData(queryKeys.notes.detail(uuid), remote)
                useTabsStore.getState().setTitle(uuid, remote.title)
              }
            } catch (err: unknown) {
              if (normalizeError(err).status === HttpStatusCode.NotFound) {
                useTabsStore.getState().close(uuid)
                qc.removeQueries({ queryKey: queryKeys.notes.detail(uuid) })
              }
            }
          })
        )
      }

      // Invalidate and refetch all lists, folders, tags, counts, and note queries
      await Promise.all([
        qc.refetchQueries({ queryKey: BOOTSTRAP_KEY, type: 'all' }),
        qc.refetchQueries({ queryKey: LOCAL_SIDEBAR_KEY, type: 'all' }),
        qc.refetchQueries({ queryKey: NOTES_KEY, type: 'all' }),
        qc.refetchQueries({ queryKey: NOTE_KEY, type: 'all' }),
      ])

      showSuccessToast(MESSAGES.REFRESH_DONE)
    } catch {
      showErrorToast(MESSAGES.REFRESH_FAILED)
    } finally {
      setIsRefreshing(false)
    }
  }, [qc])

  return { isRefreshing, refresh }
}
