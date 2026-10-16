import { getDb } from '@/db/connection'
import { isNative } from '@/platform/isNative'
import type { Container, Note, UUID } from '@/types/api'

export type QueuedOp =
  | { kind: 'create'; uuid: UUID; folder_id?: UUID | null; container?: Container }
  | { kind: 'body'; uuid: UUID; body: Note['body']; version?: number; container?: Container }
  | { kind: 'meta'; uuid: UUID; changes: Partial<Pick<Note, 'is_starred' | 'title' | 'title_locked' | 'deleted_at'>> & { folder_id?: UUID | null }; container?: Container }
  | { kind: 'tags'; uuid: UUID; names: string[]; container?: Container }
  | { kind: 'trash'; uuid: UUID; container?: Container }
  | { kind: 'restore'; uuid: UUID; container?: Container }
  | { kind: 'force'; uuid: UUID; container?: Container }

export type OutboxItem = QueuedOp & { id: number }

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('notes-outbox', fn)
  }
  return fn()
}

// In-memory fallback for web environment
let webOps: OutboxItem[] = []
let webNextId = 1

export const outbox = {
  async enqueue(op: QueuedOp): Promise<void> {
    if (op.container === 'local') {
      throw new Error('Refusing to enqueue a local note: it must never leave the device')
    }

    return withLock(async () => {
      if (!isNative()) {
        if (op.kind === 'body') {
          const at = webOps.findIndex((o) => o.kind === 'body' && o.uuid === op.uuid)
          if (at > -1) {
            const existing = webOps[at]
            if (existing && existing.kind === 'body') {
              webOps[at] = {
                ...op,
                id:      existing.id,
                version: existing.version,
              }
              return
            }
          }
        }
        webOps.push({ ...op, id: webNextId++ })
        return
      }

      const db = await getDb()
      const nowStr = new Date().toISOString()

      if (op.kind === 'body') {
        const rows = await db.select<{ id: number; payload: string }[]>(
          "SELECT id, payload FROM outbox WHERE kind = 'body' AND note_uuid = $1 ORDER BY id ASC LIMIT 1",
          [op.uuid],
        )

        if (rows.length > 0 && rows[0]) {
          const existing = rows[0]
          let originalVersion = op.version
          try {
            const parsed = JSON.parse(existing.payload) as { version?: number }
            if (parsed.version !== undefined) {
              originalVersion = parsed.version
            }
          } catch {
            // keep op.version
          }

          const coalescedOp = { ...op, version: originalVersion }
          await db.execute(
            'UPDATE outbox SET payload = $1, created_at = $2 WHERE id = $3',
            [JSON.stringify(coalescedOp), nowStr, existing.id],
          )
          return
        }
      }

      await db.execute(
        'INSERT INTO outbox (kind, note_uuid, payload, created_at) VALUES ($1, $2, $3, $4)',
        [op.kind, op.uuid, JSON.stringify(op), nowStr],
      )
    })
  },

  async pending(): Promise<OutboxItem[]> {
    return withLock(async () => {
      if (!isNative()) {
        return [...webOps]
      }

      const db = await getDb()
      const rows = await db.select<{ id: number; kind: string; note_uuid: string; payload: string }[]>(
        'SELECT id, kind, note_uuid, payload FROM outbox ORDER BY id ASC',
      )

      return rows.map((r) => {
        try {
          const parsed = JSON.parse(r.payload) as QueuedOp
          return { ...parsed, id: r.id }
        } catch {
          return {
            id:   r.id,
            kind: r.kind,
            uuid: r.note_uuid,
          } as OutboxItem
        }
      })
    })
  },

  async shift(): Promise<OutboxItem | null> {
    return withLock(async () => {
      if (!isNative()) {
        const item = webOps.shift()
        return item ?? null
      }

      const db = await getDb()
      const rows = await db.select<{ id: number; kind: string; note_uuid: string; payload: string }[]>(
        'SELECT id, kind, note_uuid, payload FROM outbox ORDER BY id ASC LIMIT 1',
      )

      if (rows.length === 0 || !rows[0]) return null
      const first = rows[0]

      await db.execute('DELETE FROM outbox WHERE id = $1', [first.id])

      try {
        const parsed = JSON.parse(first.payload) as QueuedOp
        return { ...parsed, id: first.id }
      } catch {
        return {
          id:   first.id,
          kind: first.kind,
          uuid: first.note_uuid,
        } as OutboxItem
      }
    })
  },

  async count(): Promise<number> {
    if (!isNative()) {
      return webOps.length
    }

    const db = await getDb()
    const rows = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM outbox',
    )
    return rows[0]?.count ?? 0
  },

  async clear(): Promise<void> {
    return withLock(async () => {
      if (!isNative()) {
        webOps = []
        return
      }

      const db = await getDb()
      await db.execute('DELETE FROM outbox')
    })
  },
}
