import { useCallback, useEffect, useRef, useState } from 'react'

import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { Editor, JSONContent } from '@tiptap/react'

import { normalizeError } from '@src/api/api_client'
import type { IApiError } from '@src/api/api_client'
import * as notesApi from '@src/api/notes_api'
import { type TNotesPage, patchNote } from '@src/api/notes_api'
import { MESSAGES } from '@src/constants/messages'
import { BOOTSTRAP_KEY, NOTES_KEY, queryKeys } from '@src/constants/query_keys'
import { clearDraft, saveDraft } from '@src/db/drafts_store'
import { type TNoteListMutation, useRestoreNote } from '@src/queries/notes_queries'
import { useTabsStore } from '@src/stores/tabs_store'
import type { ITabsState } from '@src/stores/tabs_store'
import { type TSaveStatus, type IUiState, useUiStore } from '@src/stores/ui_store'
import type { INote, INoteListItem, TUuid } from '@src/types/api'
import { showErrorToast, showSuccessToast } from '@src/utils/notifications'

export type { TSaveStatus }

const DEBOUNCE_MS: number = 5000 // 5 seconds debounce
const MIN_SAVING_MS: number = 400 // below this, "Saving…" strobes

export interface IAutosave {
  status:             TSaveStatus
  savedAt:            number | null
  conflict:           INote | null
  clearConflict:      () => void
  resolveKeepMine:    () => Promise<void>
  resolveKeepTheirs:  () => void
  resolveSaveCopy:    () => Promise<void>
  resolveRestoreMine: () => Promise<void>
  resolveDiscard:     () => void
  onChange:           () => void
  saveNow:            (isExplicit?: boolean) => Promise<void>
}

export function useAutosave(note: INote, editor: Editor | null): IAutosave {
  const qc: QueryClient = useQueryClient()
  const setDirty: (uuid: TUuid, dirty: boolean) => void = useTabsStore((s: ITabsState) => s.setDirty)
  const setSaveStatus: (saveStatus: TSaveStatus, savedAt?: number | null) => void = useUiStore((s: IUiState) => s.setSaveStatus)
  const setRetrySave: (retrySave: (() => Promise<void> | void) | null) => void = useUiStore((s: IUiState) => s.setRetrySave)
  const setCancelPendingSave: (cancelPendingSave: (() => void) | null) => void = useUiStore((s: IUiState) => s.setCancelPendingSave)
  const closeTab: (uuid: TUuid) => void = useTabsStore((s: ITabsState) => s.close)
  const restoreNote: TNoteListMutation = useRestoreNote()

  const [status, setStatus] = useState<TSaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [conflict, setConflict] = useState<INote | null>(null)

  const version: React.RefObject<number> = useRef(note.version)
  const timer: React.RefObject<number | null> = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retries: React.RefObject<number> = useRef(0)
  const saveRef: React.RefObject<(isExplicit?: boolean) => Promise<void>> = useRef<(isExplicit?: boolean) => Promise<void>>(async () => {})

  useEffect(() => {
    version.current = note.version
  }, [note.version, note.uuid])

  const save: (isExplicit?: boolean) => Promise<void> = useCallback(
    async (isExplicit: boolean = false) => {
      if (!editor) return

      const body: JSONContent | null = editor.getJSON() as INote['body']
      if (!body) return

      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }

      const startedAt: number = Date.now()
      setStatus('saving')
      setSaveStatus('saving')

      try {
        const updated: INote = await patchNote(note.uuid, { body, version: version.current })
        version.current = updated.version

        retries.current = 0

        await clearDraft(note.uuid)
        setDirty(note.uuid, false)

        qc.setQueryData(queryKeys.notes.detail(note.uuid), updated)
        if (updated.title) {
          useTabsStore.getState().setTitle(note.uuid, updated.title)
        }
        qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: TNotesPage[] } | undefined) => {
          if (!old?.pages?.length) return old
          return {
            ...old,
            pages: old.pages.map((p: notesApi.TNotesPage) => ({
              ...p,
              data: p.data.map((n: INoteListItem) =>
                n.uuid === note.uuid
                  ? {
                    ...n,
                    title:      updated.title ?? n.title,
                    excerpt:    updated.excerpt ?? n.excerpt,
                    updatedAt: updated.updatedAt ?? n.updatedAt,
                  }
                  : n
              ),
            })),
          }
        })
        qc.invalidateQueries({ queryKey: NOTES_KEY })

        // Hold "Saving…" long enough to be readable.
        const elapsed: number = Date.now() - startedAt
        const now: number = Date.now()
        setTimeout(() => {
          setStatus('saved')
          setSavedAt(now)
          setSaveStatus('saved', now)
        }, Math.max(0, MIN_SAVING_MS - elapsed))
      } catch (e) {
        const err: IApiError = normalizeError(e)

        if (err.status === 409 && err.serverCopy) {
          // Never discard the user's text: hand it to the conflict sheet.
          setConflict(err.serverCopy)
          setStatus('error')
          setSaveStatus('error')
          return
        }

        setStatus('error')
        setSaveStatus('error')
        if (isExplicit) {
          notifications.show({
            id:        'explicit-save-error',
            message:   MESSAGES.NOTE_SAVE_FAILED,
            color:     'red',
            autoClose: 2500,
          })
        }
        retries.current += 1
        const backoff: number = Math.min(30_000, 2 ** retries.current * 1000)
        timer.current = setTimeout(() => void saveRef.current(), backoff)
      }
    },
    [editor, note, qc, setDirty, setSaveStatus]
  )

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const onChange: () => void = useCallback(() => {
    if (!editor) return

    setDirty(note.uuid, true)
    void saveDraft(note.uuid, editor.getJSON() as INote['body'] as never)

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS)
  }, [editor, note.uuid, save, setDirty])

  // Flush on anything that can end the session. visibilitychange matters most:
  // mobile browsers discard backgrounded tabs without firing beforeunload.
  useEffect(() => {
    const flush: () => void = (): void => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
        void save()
      }
    }

    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('blur', flush)

    return (): void => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('blur', flush)
    }
  }, [save])

  // ⌘S / Ctrl+S forces an immediate save with explicit acknowledgement.
  useEffect(() => {
    const onKey: (e: KeyboardEvent) => void = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) {
        e.preventDefault()
        e.stopPropagation()
        if (timer.current) {
          clearTimeout(timer.current)
          timer.current = null
        }
        void saveRef.current(true)
      }
    }

    window.addEventListener('keydown', onKey, true)
    return (): void => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    setRetrySave(() => save(true))
    return (): void => { setRetrySave(null) }
  }, [save, setRetrySave])

  const cancelPending: () => void = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    retries.current = 0
    setStatus('idle')
    setSaveStatus('idle')
    void clearDraft(note.uuid)
    setDirty(note.uuid, false)
  }, [note.uuid, setDirty, setSaveStatus])

  useEffect(() => {
    setCancelPendingSave(cancelPending)
    return (): void => { setCancelPendingSave(null) }
  }, [cancelPending, setCancelPendingSave])

  const clearConflict: () => void = useCallback(() => setConflict(null), [])

  const resolveKeepMine: () => Promise<void> = useCallback(async () => {
    if (!conflict) return
    version.current = conflict.version
    setConflict(null)
    await save(true)
  }, [conflict, save])

  const resolveKeepTheirs: () => void = useCallback(() => {
    if (!conflict || !editor) return
    version.current = conflict.version
    editor.commands.setContent(conflict.body, { emitUpdate: false })
    void clearDraft(note.uuid)
    setDirty(note.uuid, false)
    qc.setQueryData(queryKeys.notes.detail(note.uuid), conflict)
    setStatus('saved')
    setSaveStatus('saved', Date.now())
    setConflict(null)
  }, [conflict, editor, note.uuid, qc, setDirty, setSaveStatus])

  /** The note was trashed elsewhere: bring it back, then write the user's text over it. */
  const resolveRestoreMine: () => Promise<void> = useCallback(async (): Promise<void> => {
    if (!conflict) return
    try {
      await restoreNote.mutateAsync(note.uuid)
    } catch {
      return // useRestoreNote already told the user.
    }
    version.current = conflict.version
    setConflict(null)
    await save(true)
  }, [conflict, note.uuid, restoreNote, save])

  /** The note was trashed elsewhere and the user lets it go: drop the edit and close it. */
  const resolveDiscard: () => void = useCallback((): void => {
    void clearDraft(note.uuid)
    setDirty(note.uuid, false)
    setStatus('idle')
    setSaveStatus('idle')
    setConflict(null)
    closeTab(note.uuid)
    qc.removeQueries({ queryKey: queryKeys.notes.detail(note.uuid) })
  }, [closeTab, note.uuid, qc, setDirty, setSaveStatus])

  const resolveSaveCopy: () => Promise<void> = useCallback(async () => {
    if (!conflict || !editor) return
    const body: JSONContent | null = editor.getJSON() as INote['body']
    if (!body) return
    try {
      const newNote: INote = await notesApi.createNote({ folderId: note.folder?.uuid })
      await notesApi.patchNote(newNote.uuid, { body, version: newNote.version })
      resolveKeepTheirs()
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      showSuccessToast(MESSAGES.COPY_SAVED)
    } catch {
      showErrorToast(MESSAGES.COPY_SAVE_FAILED)
    }
  }, [conflict, editor, note.folder, qc, resolveKeepTheirs])

  return {
    status,
    savedAt,
    conflict,
    clearConflict,
    resolveKeepMine,
    resolveKeepTheirs,
    resolveSaveCopy,
    resolveRestoreMine,
    resolveDiscard,
    onChange,
    saveNow: save,
  }
}
