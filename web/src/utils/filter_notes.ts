import type { INoteListItem } from '@src/types/api'

export function filterNotes(notes: INoteListItem[], q: string): INoteListItem[] {
  const needle: string = q.trim().toLowerCase()
  if (!needle) return notes

  return notes.filter(
    (n: INoteListItem) =>
      n.title.toLowerCase().includes(needle) || n.excerpt.toLowerCase().includes(needle),
  )
}
