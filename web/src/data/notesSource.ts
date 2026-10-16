import { fetchNotes } from '@/api/notes'
import { notesRepo } from '@/db/notesRepo'
import { isNative } from '@/platform/isNative'
import type { Scope } from '@/stores/uiStore'
import type { NoteListItem } from '@/types/api'

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
export const notesSource = {
  async list(scope: Scope): Promise<NoteListItem[]> {
    const container = scope.container ?? 'cloud'
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

    const page = await fetchNotes(scopeToParams(scope))
    return page.data
  },
}
