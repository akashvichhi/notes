import { useCallback, useState } from 'react'

import { type Query, type QueryClient, useQueryClient } from '@tanstack/react-query'
import { HttpStatusCode } from 'axios'

import { normalizeError } from '@src/api/api_client'
import { fetchNote } from '@src/api/notes_api'
import { MESSAGES } from '@src/constants/messages'
import { BOOTSTRAP_KEY, NOTE_KEY, NOTES_KEY, queryKeys } from '@src/constants/query_keys'
import { clearDraft } from '@src/db/drafts_store'
import { type ITab, useTabsStore } from '@src/stores/tabs_store'
import { useUiStore } from '@src/stores/ui_store'
import type { INote, TUuid } from '@src/types/api'
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
      const tabs: ITab[] = useTabsStore.getState().tabs
      for (const t of tabs) {
        useTabsStore.getState().setDirty(t.uuid, false)
        void clearDraft(t.uuid)
      }

      // 2. Find all notes currently loaded and cached in React Query
      const cachedNoteQueries: Query[] = qc.getQueryCache().findAll({ queryKey: NOTE_KEY })
      const cachedNoteUuids: TUuid[] = cachedNoteQueries
        .map((q: Query): unknown => q.queryKey[1])
        .filter((u: unknown): u is TUuid => typeof u === 'string' && Boolean(u))

      if (!navigator.onLine) {
        showErrorToast(MESSAGES.REFRESH_OFFLINE)
        return
      }

      await Promise.all(
        cachedNoteUuids.map(async (uuid: TUuid): Promise<void> => {
          try {
            const remote: INote = await fetchNote(uuid)
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

      // Invalidate and refetch all lists, folders, tags, counts, and note queries
      await Promise.all([
        qc.refetchQueries({ queryKey: BOOTSTRAP_KEY, type: 'all' }),
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
