import type { NoteListItem } from '@/types/api'

export function filterNotes(notes: NoteListItem[], q: string): NoteListItem[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return notes

  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(needle) || n.excerpt.toLowerCase().includes(needle),
  )
}
