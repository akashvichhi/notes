import { useCallback, useEffect, useRef, useState } from 'react'

import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/react'

import { normalizeError } from '@/api/client'
import * as notesApi from '@/api/notes'
import { type NotesPage, patchNote } from '@/api/notes'
import { BOOTSTRAP_KEY, NOTE_KEY, NOTES_KEY } from '@/constants/queryKeys'
import { notesRepo } from '@/db/notesRepo'
import { clearDraft, saveDraft } from '@/lib/drafts'
import { showErrorToast, showSuccessToast } from '@/lib/notifications'
import { isNative } from '@/platform/isNative'
import { useTabsStore } from '@/stores/tabsStore'
import { type SaveStatus, useUiStore } from '@/stores/uiStore'
import { syncEngine } from '@/sync/engine'
import { outbox } from '@/sync/outbox'
import type { Note, NoteListItem } from '@/types/api'

export type { SaveStatus }

const DEBOUNCE_MS = 5000 // 5 seconds debounce
const MIN_SAVING_MS = 400 // below this, "Saving…" strobes

export function useAutosave(note: Note, editor: Editor | null) {
  const qc = useQueryClient()
  const setDirty = useTabsStore((s) => s.setDirty)
  const setSaveStatus = useUiStore((s) => s.setSaveStatus)
  const setRetrySave = useUiStore((s) => s.setRetrySave)
  const setCancelPendingSave = useUiStore((s) => s.setCancelPendingSave)

  const [status, setStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [conflict, setConflict] = useState<Note | null>(null)

  const version = useRef(note.version)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retries = useRef(0)
  const saveRef = useRef<(isExplicit?: boolean) => Promise<void>>(async () => {})

  useEffect(() => {
    version.current = note.version
  }, [note.version, note.uuid])

  const save = useCallback(
    async (isExplicit = false) => {
      if (!editor) return

      const body = editor.getJSON() as Note['body']
      if (!body) return

      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }

      const startedAt = Date.now()
      setStatus('saving')
      setSaveStatus('saving')

      try {
        let updated: Note
        const isLocal = note.container === 'local' || (!note.container && isNative())

        if (isNative()) {
          const plainText = editor.getText()
          const excerpt = plainText.slice(0, 150)
          const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0
          const nowStr = new Date().toISOString()
          const existing = await notesRepo.get(note.uuid)
          const title = existing?.title ?? note.title

          await notesRepo.upsert({
            uuid:            note.uuid,
            container:       note.container ?? 'local',
            folder_uuid:     note.folder?.uuid ?? null,
            title,
            title_locked:    Boolean(note.title_locked),
            body,
            plain_text:      plainText,
            excerpt,
            is_starred:      Boolean(note.is_starred),
            word_count:      wordCount,
            updated_at:      nowStr,
            deleted_at:      null,
            server_version:  note.version,
            server_revision: null,
            dirty:           !isLocal,
          })

          if (!isLocal) {
            await outbox.enqueue({
              kind:      'body',
              uuid:      note.uuid,
              body,
              version:   version.current,
              container: 'cloud',
            })
            setTimeout(() => void syncEngine.run(), 2000)
            updated = {
              ...note,
              body,
              excerpt,
              word_count: wordCount,
              updated_at: nowStr,
            }
          } else {
            updated = {
              ...note,
              body,
              excerpt,
              word_count: wordCount,
              updated_at: nowStr,
            }
          }
        } else {
          updated = await patchNote(note.uuid, { body, version: version.current })
          version.current = updated.version
        }

        retries.current = 0

        await clearDraft(note.uuid)
        setDirty(note.uuid, false)

        qc.setQueryData([...NOTE_KEY, note.uuid], updated)
        if (updated.title) {
          useTabsStore.getState().setTitle(note.uuid, updated.title)
        }
        qc.setQueriesData({ queryKey: NOTES_KEY }, (old: { pages: NotesPage[] } | undefined) => {
          if (!old?.pages?.length) return old
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              data: p.data.map((n: NoteListItem) =>
                n.uuid === note.uuid
                  ? {
                    ...n,
                    title:      updated.title ?? n.title,
                    excerpt:    updated.excerpt ?? n.excerpt,
                    updated_at: updated.updated_at ?? n.updated_at,
                  }
                  : n
              ),
            })),
          }
        })
        qc.invalidateQueries({ queryKey: NOTES_KEY })

        // Hold "Saving…" long enough to be readable.
        const elapsed = Date.now() - startedAt
        const now = Date.now()
        setTimeout(() => {
          setStatus('saved')
          setSavedAt(now)
          setSaveStatus('saved', now)
        }, Math.max(0, MIN_SAVING_MS - elapsed))
      } catch (e) {
        const err = normalizeError(e)

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
            message:   "Couldn't save note.",
            color:     'red',
            autoClose: 2500,
          })
        }
        retries.current += 1
        const backoff = Math.min(30_000, 2 ** retries.current * 1000)
        timer.current = setTimeout(() => void saveRef.current(), backoff)
      }
    },
    [editor, note, qc, setDirty, setSaveStatus]
  )

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const onChange = useCallback(() => {
    if (!editor) return

    setDirty(note.uuid, true)
    void saveDraft(note.uuid, editor.getJSON() as Note['body'] as never)

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS)
  }, [editor, note.uuid, save, setDirty])

  // Flush on anything that can end the session. visibilitychange matters most:
  // mobile browsers discard backgrounded tabs without firing beforeunload.
  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
        void save()
      }
    }

    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('blur', flush)

    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('blur', flush)
    }
  }, [save])

  // ⌘S / Ctrl+S forces an immediate save with explicit acknowledgement.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    setRetrySave(() => save(true))
    return () => { setRetrySave(null) }
  }, [save, setRetrySave])

  const cancelPending = useCallback(() => {
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
    return () => { setCancelPendingSave(null) }
  }, [cancelPending, setCancelPendingSave])

  const clearConflict = useCallback(() => setConflict(null), [])

  const resolveKeepMine = useCallback(async () => {
    if (!conflict) return
    version.current = conflict.version
    setConflict(null)
    await save(true)
  }, [conflict, save])

  const resolveKeepTheirs = useCallback(() => {
    if (!conflict || !editor) return
    version.current = conflict.version
    editor.commands.setContent(conflict.body, { emitUpdate: false })
    void clearDraft(note.uuid)
    setDirty(note.uuid, false)
    qc.setQueryData([...NOTE_KEY, note.uuid], conflict)
    setStatus('saved')
    setSaveStatus('saved', Date.now())
    setConflict(null)
  }, [conflict, editor, note.uuid, qc, setDirty, setSaveStatus])

  const resolveSaveCopy = useCallback(async () => {
    if (!conflict || !editor) return
    const body = editor.getJSON() as Note['body']
    if (!body) return
    try {
      const newNote = await notesApi.createNote({ folder_id: note.folder?.uuid })
      await notesApi.patchNote(newNote.uuid, { body, version: newNote.version })
      resolveKeepTheirs()
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      showSuccessToast('Saved your changes as a new note.')
    } catch {
      showErrorToast("Couldn't save copy of note.")
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
    onChange,
    saveNow: save,
  }
}
