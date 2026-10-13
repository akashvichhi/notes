import { useCallback, useEffect, useRef, useState } from 'react'

import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/react'

import { normalizeError } from '@/api/client'
import { patchNote } from '@/api/notes'
import { NOTES_KEY } from '@/hooks/queries/useNotes'
import { clearDraft, saveDraft } from '@/lib/drafts'
import { useTabsStore } from '@/stores/tabsStore'
import { type SaveStatus, useUiStore } from '@/stores/uiStore'
import type { Note } from '@/types/api'

export type { SaveStatus }

const DEBOUNCE_MS = 800
const MIN_SAVING_MS = 400 // below this, "Saving…" strobes

export function useAutosave(note: Note, editor: Editor | null) {
  const qc = useQueryClient()
  const setDirty = useTabsStore((s) => s.setDirty)
  const setSaveStatus = useUiStore((s) => s.setSaveStatus)

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
        const updated = await patchNote(note.uuid, { body, version: version.current })
        version.current = updated.version
        retries.current = 0

        await clearDraft(note.uuid)
        setDirty(note.uuid, false)
        qc.invalidateQueries({ queryKey: NOTES_KEY })

        // Hold "Saving…" long enough to be readable.
        const elapsed = Date.now() - startedAt
        const now = Date.now()
        setTimeout(() => {
          setStatus('saved')
          setSavedAt(now)
          setSaveStatus('saved', now)
        }, Math.max(0, MIN_SAVING_MS - elapsed))

        if (isExplicit) {
          notifications.show({
            id:        'explicit-save',
            message:   'Note saved',
            color:     'teal',
            autoClose: 1500,
          })
        }
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
    [editor, note.uuid, qc, setDirty, setSaveStatus]
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

  const clearConflict = useCallback(() => setConflict(null), [])

  return { status, savedAt, conflict, clearConflict, onChange, saveNow: save }
}
