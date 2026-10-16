import { normalizeError } from '@/api/client'
import {
  createNote,
  fetchNote,
  forceDeleteNote,
  patchNote,
  restoreNote,
  syncNoteTags,
  trashNote,
} from '@/api/notes'
import { notesRepo } from '@/db/notesRepo'
import { isNative } from '@/platform/isNative'
import { outbox } from '@/sync/outbox'
import type { LocalNote, Note } from '@/types/api'

function toLocalNote(n: Note, overrides: { server_version?: number | null; dirty: boolean }): LocalNote {
  return {
    uuid:            n.uuid,
    container:       n.container ?? 'cloud',
    folder_uuid:     n.folder?.uuid ?? null,
    title:           n.title,
    title_locked:    Boolean(n.title_locked),
    body:            n.body ?? null,
    plain_text:      n.plain_text ?? '',
    excerpt:         n.excerpt ?? '',
    is_starred:      Boolean(n.is_starred),
    word_count:      n.word_count ?? 0,
    deleted_at:      n.deleted_at ?? null,
    updated_at:      n.updated_at,
    server_version:  overrides.server_version !== undefined ? overrides.server_version : (n.version ?? null),
    server_revision: null,
    dirty:           overrides.dirty,
  }
}

export async function push(): Promise<{ pushed: number; conflicts: Note[] }> {
  const conflicts: Note[] = []
  let pushed = 0

  if (isNative()) {
    try {
      const dirtyNotes = await notesRepo.getDirtyCloudNotes()
      const initialPending = await outbox.pending()
      const pendingUuids = new Set(initialPending.map((o) => o.uuid))
      for (const dn of dirtyNotes) {
        if (!pendingUuids.has(dn.uuid)) {
          if (dn.deleted_at) {
            await outbox.enqueue({ kind: 'trash', uuid: dn.uuid, container: 'cloud' })
          } else if (dn.version === null) {
            await outbox.enqueue({ kind: 'create', uuid: dn.uuid, folder_id: dn.folder?.uuid ?? undefined, container: 'cloud' })
            if (dn.body) {
              await outbox.enqueue({ kind: 'body', uuid: dn.uuid, body: dn.body, version: 1, container: 'cloud' })
            }
          } else {
            if (dn.body) {
              await outbox.enqueue({ kind: 'body', uuid: dn.uuid, body: dn.body, version: dn.version, container: 'cloud' })
            }
            await outbox.enqueue({
              kind:      'meta',
              uuid:      dn.uuid,
              changes:   { title: dn.title, folder_id: dn.folder?.uuid ?? null, is_starred: dn.is_starred },
              container: 'cloud',
            })
          }
        }
      }
    } catch {
      // Ignore recovery errors
    }
  }

  const pendingOps = await outbox.pending()

  for (const op of pendingOps) {
    try {
      if (op.kind === 'create') {
        let created: Note
        try {
          created = await createNote({ uuid: op.uuid, folder_id: op.folder_id ?? undefined })
        } catch (createErr) {
          const remote = await fetchNote(op.uuid).catch(() => null)
          if (remote) {
            created = remote
          } else {
            throw createErr
          }
        }
        if (isNative()) {
          const existing = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            const hasMoreOps = pendingOps.slice(pendingOps.indexOf(op) + 1).some((o) => o.uuid === op.uuid)
            await notesRepo.upsert(toLocalNote(existing, {
              server_version: created.version,
              dirty:          hasMoreOps,
            }))
          }
        }
      } else if (op.kind === 'body') {
        const existing = await notesRepo.get(op.uuid, 'cloud')
        const versionToPush = (op.version && op.version >= 1)
          ? op.version
          : (existing?.version && existing.version >= 1 ? existing.version : 1)
        const updated = await patchNote(op.uuid, { body: op.body ?? undefined, version: versionToPush })
        if (isNative()) {
          const current = await notesRepo.get(op.uuid, 'cloud')
          if (current) {
            await notesRepo.upsert(toLocalNote(current, { server_version: updated.version, dirty: false }))
          }
        }
      } else if (op.kind === 'meta') {
        if (op.changes && 'deleted_at' in op.changes && op.changes.deleted_at === null) {
          try {
            await restoreNote(op.uuid)
          } catch (err) {
            const norm = normalizeError(err)
            if (norm.status !== 404) throw err
          }
        } else {
          await patchNote(op.uuid, op.changes)
        }
        if (isNative()) {
          const existing = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            await notesRepo.upsert(toLocalNote(existing, { dirty: false }))
          }
        }
      } else if (op.kind === 'restore') {
        try {
          await restoreNote(op.uuid)
        } catch (err) {
          const norm = normalizeError(err)
          if (norm.status !== 404) throw err
        }
        if (isNative()) {
          const existing = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            await notesRepo.upsert(toLocalNote(existing, { dirty: false }))
          }
        }
      } else if (op.kind === 'tags') {
        await syncNoteTags(op.uuid, op.names)
        if (isNative()) {
          const existing = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            await notesRepo.upsert(toLocalNote(existing, { dirty: false }))
          }
        }
      } else if (op.kind === 'trash') {
        try {
          await trashNote(op.uuid)
        } catch (err) {
          const norm = normalizeError(err)
          if (norm.status !== 404) throw err
        }
        if (isNative()) {
          const existing = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            await notesRepo.upsert(toLocalNote(existing, { dirty: false }))
          }
        }
      } else if (op.kind === 'force') {
        try {
          await forceDeleteNote(op.uuid)
        } catch (err) {
          const norm = normalizeError(err)
          if (norm.status !== 404) throw err
        }
        if (isNative()) {
          await notesRepo.hardDelete(op.uuid, 'cloud')
        }
      }

      await outbox.shift()
      pushed++
    } catch (e) {
      const err = normalizeError(e)

      if (err.status === 409 && err.serverCopy) {
        conflicts.push(err.serverCopy)
        break // later ops may depend on this note
      }

      // If the client error is unrecoverable (4xx, except 409 conflict and 401 unauth),
      // discard the op rather than blocking the queue indefinitely.
      if (err.status >= 400 && err.status < 500 && err.status !== 401) {
        await outbox.shift()
        continue
      }

      // Network error, 401 unauthenticated, or server 5xx: halt and retry next sync run
      break
    }
  }

  return { pushed, conflicts }
}
