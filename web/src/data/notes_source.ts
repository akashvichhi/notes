import { fetchNotes } from '@src/api/notes_api'
import type { NotesPage } from '@src/api/notes_api'
import { notesRepo } from '@src/db/notes_repo'
import { isNative } from '@src/platform/is_native'
import type { Scope } from '@src/stores/ui_store'
import type { Container, NoteListItem } from '@src/types/api'

function scopeToParams(scope: Scope): Record<string, string | undefined> {
  if (scope.kind === 'folder') return { folder_uuid: scope.uuid }
  if (scope.kind === 'tag') return { tag: scope.slug }
  if (scope.kind === 'starred') return { starred: '1' }
  if (scope.kind === 'trash') return { trashed: '1' }
  if (scope.kind === 'search') return { q: scope.q }
  return {}
}

/**
 * The only module in the app that knows whether it is running natively.
 * Everything above it just asks for notes.
 */
export const notesSource: { list(scope: Scope): Promise<NoteListItem[]>; } = {
  async list(scope: Scope): Promise<NoteListItem[]> {
    const container: Container = scope.container ?? 'cloud'
    if (isNative()) {
      if (scope.kind === 'search') {
        return notesRepo.search(scope.q, container)
      }
      return notesRepo.list(container, {
        folderUuid: scope.kind === 'folder' ? scope.uuid : undefined,
        tag:        scope.kind === 'tag' ? scope.slug : undefined,
        starred:    scope.kind === 'starred',
        trashed:    scope.kind === 'trash',
      })
    }

    // The browser build has no local container.
    if (container === 'local') return []

    const page: NotesPage = await fetchNotes(scopeToParams(scope))
    return page.data
  },
}
