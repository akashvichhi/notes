import { HttpStatusCode } from 'axios'

import { normalizeError } from '@src/api/api_client'
import type { ApiError } from '@src/api/api_client'
import {
  createNote,
  fetchNote,
  forceDeleteNote,
  patchNote,
  restoreNote,
  syncNoteTags,
  trashNote,
} from '@src/api/notes_api'
import { notesRepo } from '@src/db/notes_repo'
import type { DirtyCloudNote } from '@src/db/notes_repo'
import { isNative } from '@src/platform/is_native'
import type { OutboxItem } from '@src/sync/outbox'
import type { LocalNote, Note } from '@src/types/api'

import { outbox } from './outbox'

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

export interface PushResult {
  pushed:    number
  conflicts: Note[]
  /** Notes whose change the server refused; that change was dropped. */
  rejected:  string[]
}

/** Worth another try on the next run: offline, signed out, throttled, or a server fault. */
function isRetryable(status: number): boolean {
  return status === 0
    || status === HttpStatusCode.Unauthorized
    || status === HttpStatusCode.RequestTimeout
    || status === HttpStatusCode.TooManyRequests
    || status >= HttpStatusCode.InternalServerError
}

export async function push(): Promise<PushResult> {
  const conflicts: Note[] = []
  const rejected: string[] = []
  let pushed: number = 0

  if (isNative()) {
    try {
      const dirtyNotes: DirtyCloudNote[] = await notesRepo.getDirtyCloudNotes()
      const initialPending: OutboxItem[] = await outbox.pending()
      const pendingUuids: Set<string> = new Set(initialPending.map((o: OutboxItem) => o.uuid))
      for (const dn of dirtyNotes) {
        if (!pendingUuids.has(dn.uuid)) {
          if (dn.deleted_at) {
            await outbox.enqueue({ kind: 'trash', uuid: dn.uuid, container: 'cloud' })
          } else if (dn.server_version === null) {
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

  const pendingOps: OutboxItem[] = await outbox.pending()

  for (const op of pendingOps) {
    try {
      if (op.kind === 'create') {
        let created: Note
        try {
          created = await createNote({ uuid: op.uuid, folder_id: op.folder_id ?? undefined })
        } catch (createErr) {
          const remote: Note | null = await fetchNote(op.uuid).catch(() => null)
          if (remote) {
            created = remote
          } else {
            throw createErr
          }
        }
        if (isNative()) {
          const existing: Note | null = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            const hasMoreOps: boolean = pendingOps.slice(pendingOps.indexOf(op) + 1).some((o: OutboxItem) => o.uuid === op.uuid)
            await notesRepo.upsert(toLocalNote(existing, {
              server_version: created.version,
              dirty:          hasMoreOps,
            }))
          }
        }
      } else if (op.kind === 'body') {
        const existing: Note | null = await notesRepo.get(op.uuid, 'cloud')
        const versionToPush: number = (op.version && op.version >= 1)
          ? op.version
          : (existing?.version && existing.version >= 1 ? existing.version : 1)
        const updated: Note = await patchNote(op.uuid, { body: op.body ?? undefined, version: versionToPush })
        // An edit merged in while this save was in flight keeps the row, and the note stays dirty.
        const done: boolean = await outbox.complete(op, updated.version)
        if (isNative()) {
          const current: Note | null = await notesRepo.get(op.uuid, 'cloud')
          if (current) {
            await notesRepo.upsert(toLocalNote(current, { server_version: updated.version, dirty: !done }))
          }
        }
        pushed++
        continue
      } else if (op.kind === 'meta') {
        if (op.changes && 'deleted_at' in op.changes && op.changes.deleted_at === null) {
          try {
            await restoreNote(op.uuid)
          } catch (err) {
            const norm: ApiError = normalizeError(err)
            if (norm.status !== HttpStatusCode.NotFound) throw err
          }
        } else {
          await patchNote(op.uuid, op.changes)
        }
        if (isNative()) {
          const existing: Note | null = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            await notesRepo.upsert(toLocalNote(existing, { dirty: false }))
          }
        }
      } else if (op.kind === 'restore') {
        try {
          await restoreNote(op.uuid)
        } catch (err) {
          const norm: ApiError = normalizeError(err)
          if (norm.status !== HttpStatusCode.NotFound) throw err
        }
        if (isNative()) {
          const existing: Note | null = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            await notesRepo.upsert(toLocalNote(existing, { dirty: false }))
          }
        }
      } else if (op.kind === 'tags') {
        await syncNoteTags(op.uuid, op.names)
        if (isNative()) {
          const existing: Note | null = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            await notesRepo.upsert(toLocalNote(existing, { dirty: false }))
          }
        }
      } else if (op.kind === 'trash') {
        try {
          await trashNote(op.uuid)
        } catch (err) {
          const norm: ApiError = normalizeError(err)
          if (norm.status !== HttpStatusCode.NotFound) throw err
        }
        if (isNative()) {
          const existing: Note | null = await notesRepo.get(op.uuid, 'cloud')
          if (existing) {
            await notesRepo.upsert(toLocalNote(existing, { dirty: false }))
          }
        }
      } else if (op.kind === 'force') {
        try {
          await forceDeleteNote(op.uuid)
        } catch (err) {
          const norm: ApiError = normalizeError(err)
          if (norm.status !== HttpStatusCode.NotFound) throw err
        }
        if (isNative()) {
          await notesRepo.hardDelete(op.uuid, 'cloud')
        }
      }

      await outbox.complete(op)
      pushed++
    } catch (e) {
      const err: ApiError = normalizeError(e)

      if (err.status === HttpStatusCode.Conflict && err.serverCopy) {
        conflicts.push(err.serverCopy)
        break // later ops may depend on this note
      }

      if (isRetryable(err.status)) {
        break
      }

      // Any other 4xx will fail the same way every time: drop it rather than block
      // the queue, and report it so the user hears that the change was not saved.
      await outbox.remove(op.id)
      if (isNative()) {
        // A dirty note is queued again by the recovery step above.
        await notesRepo.markDirty(op.uuid, false)
      }
      rejected.push(op.uuid)
    }
  }

  return { pushed, conflicts, rejected }
}
