import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/react'
import { useEffect, useRef } from 'react'

import { forceDeleteNote } from '@/api/notes'
import { BOOTSTRAP_KEY } from '@/hooks/queries/useBootstrap'
import { NOTES_KEY } from '@/hooks/queries/useNotes'
import { clearDraft } from '@/lib/drafts'
import { useTabsStore } from '@/stores/tabsStore'
import type { Note } from '@/types/api'

/**
 * A blank, untouched note was never a note. Discard it silently rather than
 * sending it to Trash, which would just move the litter. No toast, no confirm —
 * the user never asked for it to exist.
 */
export function useAbandonedNote(note: Note, editor: Editor | null) {
  const qc = useQueryClient()
  const closeTab = useTabsStore((s) => s.close)

  const latest = useRef({ note, editor })
  latest.current = { note, editor }

  useEffect(() => {
    return () => {
      const { note: n, editor: e } = latest.current

      const untouched =
        (e?.getText() ?? '').trim() === '' &&
        !n.is_starred &&
        n.tags.length === 0 &&
        n.folder === null &&
        !n.title_locked &&
        n.version === 1

      if (!untouched) return

      void clearDraft(n.uuid)
      void forceDeleteNote(n.uuid).then(() => {
        closeTab(n.uuid)
        qc.invalidateQueries({ queryKey: NOTES_KEY })
        qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      })
    }
  }, [note.uuid, qc, closeTab])
}
