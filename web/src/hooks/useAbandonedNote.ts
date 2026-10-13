import type { Editor } from '@tiptap/react'

import type { Note } from '@/types/api'

/**
 * Disabled: Notes created by the user must never be deleted automatically
 * on unmount or tab switch.
 */
export function useAbandonedNote(_note: Note, _editor: Editor | null) {
  // No-op
}
