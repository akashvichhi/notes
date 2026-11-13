import { fetchBootstrap } from '@src/api/bootstrap_api'
import { fetchNotes } from '@src/api/notes_api'
import type { NotesPage } from '@src/api/notes_api'
import { foldersRepo } from '@src/db/folders_repo'
import { notesRepo } from '@src/db/notes_repo'
import type { DirtyCloudNote } from '@src/db/notes_repo'
import { tagsRepo } from '@src/db/tags_repo'
import type { OutboxItem } from '@src/sync/outbox'
import type { Bootstrap, Folder, LocalFolder, LocalNote, LocalTag, Note, NoteListItem, Tag } from '@src/types/api'
import { getFoldersArray, getTagsArray } from '@src/utils/bootstrap_lists'

import { outbox } from './outbox'

export async function pull(): Promise<{ applied: number }> {
  let applied: number = 0

  // 1. Fetch bootstrap to get folders and tags
  const boot: Bootstrap = await fetchBootstrap()
  const folders: Folder[] = getFoldersArray(boot.folders)
  const tags: Tag[] = getTagsArray(boot.tags)

  // Prune local cloud folders that were deleted on remote
  const remoteFolderUuids: Set<string> = new Set(folders.map((f: Folder) => f.uuid))
  const localCloudFolders: Folder[] = await foldersRepo.list('cloud')
  for (const lf of localCloudFolders) {
    if (!remoteFolderUuids.has(lf.uuid)) {
      await foldersRepo.hardDelete(lf.uuid, 'cloud')
    }
  }

  for (const f of folders) {
    const localFolder: LocalFolder = {
      uuid:            f.uuid,
      container:       'cloud',
      parent_uuid:     f.parent_uuid ?? null,
      name:            f.name,
      color:           f.color ?? null,
      position:        f.position ?? 0,
      deleted_at:      null,
      dirty:           false,
      server_revision: null,
    }
    await foldersRepo.upsert(localFolder)
    applied++
  }

  // Prune local cloud tags that were deleted on remote
  const remoteTagUuids: Set<string> = new Set(tags.map((t: Tag) => t.uuid))
  const localCloudTags: Tag[] = await tagsRepo.list('cloud')
  for (const lt of localCloudTags) {
    if (!remoteTagUuids.has(lt.uuid)) {
      await tagsRepo.hardDelete(lt.uuid, 'cloud')
    }
  }

  for (const t of tags) {
    const localTag: LocalTag = {
      uuid:            t.uuid,
      container:       'cloud',
      name:            t.name,
      slug:            t.slug,
      deleted_at:      null,
      dirty:           false,
      server_revision: null,
    }
    await tagsRepo.upsert(localTag)
    applied++
  }

  // 2. Fetch cloud notes (paginated)
  let currentPage: number = 1
  let lastPage: number = 1
  const allActiveNotes: NoteListItem[] = []

  // A failed page throws: pruning against a partial list would delete notes that still exist.
  do {
    const page: NotesPage = await fetchNotes({ per_page: '100', page: String(currentPage) })
    allActiveNotes.push(...(page.data ?? []))
    lastPage = page.meta?.last_page ?? 1
    currentPage++
  } while (currentPage <= lastPage)

  // Notes with changes not yet on the server keep their local copy.
  const unsent: Set<string> = new Set<string>([
    ...(await notesRepo.getDirtyCloudNotes()).map((n: DirtyCloudNote) => n.uuid),
    ...(await outbox.pending()).map((op: OutboxItem) => op.uuid),
  ])

  for (const n of allActiveNotes) {
    if (unsent.has(n.uuid)) continue
    const existing: Note | null = await notesRepo.get(n.uuid, 'cloud')
    const isRemoteUpdated: boolean | null = existing && existing.updated_at !== n.updated_at
    const localNote: LocalNote = {
      uuid:            n.uuid,
      container:       'cloud',
      folder_uuid:     n.folder?.uuid ?? null,
      title:           n.title,
      title_locked:    Boolean(existing?.title_locked),
      body:            isRemoteUpdated ? null : (existing?.body ?? null),
      plain_text:      isRemoteUpdated ? (n.excerpt ?? '') : (existing?.plain_text || n.excerpt || ''),
      excerpt:         n.excerpt,
      is_starred:      Boolean(n.is_starred),
      word_count:      isRemoteUpdated ? 0 : (existing?.word_count ?? 0),
      updated_at:      n.updated_at,
      deleted_at:      null,
      server_version:  isRemoteUpdated ? null : (existing?.version ?? null),
      server_revision: null,
      dirty:           false,
    }
    await notesRepo.upsert(localNote)
    applied++
  }

  // Sync note-tag associations
  for (const n of allActiveNotes) {
    if (n.tags) {
      await tagsRepo.setNoteTags(n.uuid, n.tags, 'cloud')
    }
  }

  // 3. Fetch trashed cloud notes (paginated) so trash counts and trash view are completely accurate
  let currentTrashPage: number = 1
  let lastTrashPage: number = 1
  const trashedNotes: NoteListItem[] = []

  do {
    const trashPage: NotesPage = await fetchNotes({ trashed: '1', per_page: '100', page: String(currentTrashPage) })
    trashedNotes.push(...(trashPage.data ?? []))
    lastTrashPage = trashPage.meta?.last_page ?? 1
    currentTrashPage++
  } while (currentTrashPage <= lastTrashPage)

  for (const n of trashedNotes) {
    if (unsent.has(n.uuid)) continue
    const existing: Note | null = await notesRepo.get(n.uuid, 'cloud')
    const localNote: LocalNote = {
      uuid:            n.uuid,
      container:       'cloud',
      folder_uuid:     n.folder?.uuid ?? null,
      title:           n.title,
      title_locked:    Boolean(existing?.title_locked),
      body:            existing?.body ?? null,
      plain_text:      existing?.plain_text || n.excerpt || '',
      excerpt:         n.excerpt,
      is_starred:      Boolean(n.is_starred),
      word_count:      existing?.word_count ?? 0,
      updated_at:      n.updated_at,
      deleted_at:      n.updated_at,
      server_version:  existing?.version ?? null,
      server_revision: null,
      dirty:           false,
    }
    await notesRepo.upsert(localNote)
    applied++
  }

  // 4. Prune local cloud notes that were permanently deleted on remote
  try {
    const remoteAllUuids: Set<string> = new Set([
      ...allActiveNotes.map((n: NoteListItem) => n.uuid),
      ...trashedNotes.map((n: NoteListItem) => n.uuid),
    ])
    const localActive: NoteListItem[] = await notesRepo.list('cloud')
    const localTrashed: NoteListItem[] = await notesRepo.list('cloud', { trashed: true })
    for (const ln of [...localActive, ...localTrashed]) {
      if (!remoteAllUuids.has(ln.uuid) && !unsent.has(ln.uuid)) {
        await notesRepo.hardDelete(ln.uuid, 'cloud')
      }
    }
  } catch {
    // Non-fatal
  }

  return { applied }
}

