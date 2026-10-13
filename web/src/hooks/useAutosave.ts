import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/react'

import { useCallback, useEffect, useRef, useState } from 'react'

import { normalizeError } from '@/api/client'
import { patchNote } from '@/api/notes'
import { NOTES_KEY } from '@/hooks/queries/useNotes'
import { clearDraft, saveDraft } from '@/lib/drafts'
import { useTabsStore } from '@/stores/tabsStore'
import type { Note } from '@/types/api'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 800
const MIN_SAVING_MS = 400   // below this, "Saving…" strobes

export function useAutosave(note: Note, editor: Editor | null) {
  const qc = useQueryClient()
  const setDirty = useTabsStore((s) => s.setDirty)

  const [status, setStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [conflict, setConflict] = useState<Note | null>(null)

  const version = useRef(note.version)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retries = useRef(0)
  const saveRef = useRef<() => void>(() => {})

  useEffect(() => { version.current = note.version }, [note.version, note.uuid])

  const save = useCallback(async () => {
    if (!editor) return

    const body = editor.getJSON() as Note['body']
    if (!body) return

    const startedAt = Date.now()
    setStatus('saving')

    try {
      const updated = await patchNote(note.uuid, { body, version: version.current })
      version.current = updated.version
      retries.current = 0

      await clearDraft(note.uuid)
      setDirty(note.uuid, false)
      qc.invalidateQueries({ queryKey: NOTES_KEY })

      // Hold "Saving…" long enough to be readable.
      const elapsed = Date.now() - startedAt
      setTimeout(() => {
        setStatus('saved')
        setSavedAt(Date.now())
      }, Math.max(0, MIN_SAVING_MS - elapsed))
    } catch (e) {
      const err = normalizeError(e)

      if (err.status === 409 && err.serverCopy) {
        // Never discard the user's text: hand it to the conflict sheet.
        setConflict(err.serverCopy)
        setStatus('error')
        return
      }

      setStatus('error')
      retries.current += 1
      const backoff = Math.min(30_000, 2 ** retries.current * 1000)
      timer.current = setTimeout(() => saveRef.current(), backoff)
    }
  }, [editor, note.uuid, qc, setDirty])

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const onChange = useCallback(() => {
    if (!editor) return

    setDirty(note.uuid, true)
    void saveDraft(note.uuid, editor.getJSON() as Note['body'] as never)

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, DEBOUNCE_MS)
  }, [editor, note.uuid, save, setDirty])

  // Flush on anything that can end the session. visibilitychange matters most:
  // mobile browsers discard backgrounded tabs without firing beforeunload.
  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current)
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

  // ⌘S forces a save: an explicit request earns an explicit acknowledgement.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (timer.current) clearTimeout(timer.current)
        void save()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  const clearConflict = useCallback(() => setConflict(null), [])

  return { status, savedAt, conflict, clearConflict, onChange, saveNow: save }
}
