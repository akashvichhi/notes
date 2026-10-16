import { fetchBootstrap } from '@/api/bootstrap'
import { fetchNotes } from '@/api/notes'
import { foldersRepo } from '@/db/foldersRepo'
import { notesRepo } from '@/db/notesRepo'
import { tagsRepo } from '@/db/tagsRepo'
import { getFoldersArray, getTagsArray } from '@/lib/bootstrap'
import type { LocalFolder, LocalNote, LocalTag, NoteListItem } from '@/types/api'

export async function pull(): Promise<{ applied: number }> {
  let applied = 0

  // 1. Fetch bootstrap to get folders and tags
  const boot = await fetchBootstrap()
  const folders = getFoldersArray(boot.folders)
  const tags = getTagsArray(boot.tags)

  // Prune local cloud folders that were deleted on remote
  const remoteFolderUuids = new Set(folders.map((f) => f.uuid))
  const localCloudFolders = await foldersRepo.list('cloud')
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
  const remoteTagUuids = new Set(tags.map((t) => t.uuid))
  const localCloudTags = await tagsRepo.list('cloud')
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
  let currentPage = 1
  let lastPage = 1
  const allActiveNotes: NoteListItem[] = []

  do {
    try {
      const page = await fetchNotes({ per_page: '100', page: String(currentPage) })
      const activeNotes: NoteListItem[] = page.data ?? []
      allActiveNotes.push(...activeNotes)
      lastPage = page.meta?.last_page ?? 1
      currentPage++
    } catch {
      break
    }
  } while (currentPage <= lastPage)

  for (const n of allActiveNotes) {
    const existing = await notesRepo.get(n.uuid, 'cloud')
    const isRemoteUpdated = existing && existing.updated_at !== n.updated_at
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
  let currentTrashPage = 1
  let lastTrashPage = 1
  const trashedNotes: NoteListItem[] = []

  do {
    try {
      const trashPage = await fetchNotes({ trashed: '1', per_page: '100', page: String(currentTrashPage) })
      const notes: NoteListItem[] = trashPage.data ?? []
      trashedNotes.push(...notes)
      lastTrashPage = trashPage.meta?.last_page ?? 1
      currentTrashPage++
    } catch {
      break
    }
  } while (currentTrashPage <= lastTrashPage)

  for (const n of trashedNotes) {
    const existing = await notesRepo.get(n.uuid, 'cloud')
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
    const remoteAllUuids = new Set([
      ...allActiveNotes.map((n) => n.uuid),
      ...trashedNotes.map((n) => n.uuid),
    ])
    const localActive = await notesRepo.list('cloud')
    const localTrashed = await notesRepo.list('cloud', { trashed: true })
    for (const ln of [...localActive, ...localTrashed]) {
      if (!remoteAllUuids.has(ln.uuid)) {
        await notesRepo.hardDelete(ln.uuid, 'cloud')
      }
    }
  } catch {
    // Non-fatal
  }

  return { applied }
}

