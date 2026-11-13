import type { NoteListItem } from '@src/types/api'

export function filterNotes(notes: NoteListItem[], q: string): NoteListItem[] {
  const needle: string = q.trim().toLowerCase()
  if (!needle) return notes

  return notes.filter(
    (n: NoteListItem) =>
      n.title.toLowerCase().includes(needle) || n.excerpt.toLowerCase().includes(needle),
  )
}
