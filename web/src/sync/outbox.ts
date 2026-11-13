import type Database from '@tauri-apps/plugin-sql'

import { getDb } from '@src/db/connection'
import { isNative } from '@src/platform/is_native'
import type { Container, Note, UUID } from '@src/types/api'

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
let webNextId: number = 1

function serialize(item: OutboxItem): string {
  const op: Partial<OutboxItem> = { ...item }
  delete op.id
  return JSON.stringify(op)
}

function parseRow(row: { id: number; kind: string; note_uuid: string; payload: string }): OutboxItem {
  try {
    return { ...(JSON.parse(row.payload) as QueuedOp), id: row.id }
  } catch {
    return { id: row.id, kind: row.kind, uuid: row.note_uuid } as OutboxItem
  }
}

async function readOp(id: number): Promise<OutboxItem | null> {
  if (!isNative()) {
    return webOps.find((o: OutboxItem) => o.id === id) ?? null
  }
  const db: Database = await getDb()
  const rows: { id: number; kind: string; note_uuid: string; payload: string; }[] = await db.select<{ id: number; kind: string; note_uuid: string; payload: string }[]>(
    'SELECT id, kind, note_uuid, payload FROM outbox WHERE id = $1',
    [id],
  )
  return rows[0] ? parseRow(rows[0]) : null
}

async function writeOp(item: OutboxItem): Promise<void> {
  if (!isNative()) {
    webOps = webOps.map((o: OutboxItem) => (o.id === item.id ? item : o))
    return
  }
  const db: Database = await getDb()
  await db.execute('UPDATE outbox SET payload = $1 WHERE id = $2', [serialize(item), item.id])
}

async function deleteOp(id: number): Promise<void> {
  if (!isNative()) {
    webOps = webOps.filter((o: OutboxItem) => o.id !== id)
    return
  }
  const db: Database = await getDb()
  await db.execute('DELETE FROM outbox WHERE id = $1', [id])
}

export interface IOutbox {
  enqueue(op: QueuedOp): Promise<void>
  pending(): Promise<OutboxItem[]>
  complete(sent: OutboxItem, nextVersion?: number): Promise<boolean>
  remove(id: number): Promise<void>
  count(): Promise<number>
  clear(): Promise<void>
}

export const outbox: IOutbox = {
  async enqueue(op: QueuedOp): Promise<void> {
    if (op.container === 'local') {
      throw new Error('Refusing to enqueue a local note: it must never leave the device')
    }

    return withLock(async () => {
      if (!isNative()) {
        if (op.kind === 'body') {
          const at: number = webOps.findIndex((o: OutboxItem) => o.kind === 'body' && o.uuid === op.uuid)
          if (at > -1) {
            const existing: OutboxItem | undefined = webOps[at]
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

      const db: Database = await getDb()
      const nowStr: string = new Date().toISOString()

      if (op.kind === 'body') {
        const rows: { id: number; payload: string; }[] = await db.select<{ id: number; payload: string }[]>(
          "SELECT id, payload FROM outbox WHERE kind = 'body' AND note_uuid = $1 ORDER BY id ASC LIMIT 1",
          [op.uuid],
        )

        if (rows.length > 0 && rows[0]) {
          const existing: { id: number; payload: string; } = rows[0]
          let originalVersion: number | undefined = op.version
          try {
            const parsed: { version?: number; } = JSON.parse(existing.payload) as { version?: number }
            if (parsed.version !== undefined) {
              originalVersion = parsed.version
            }
          } catch {
            // keep op.version
          }

          const coalescedOp: { version: number | undefined; kind: 'body'; uuid: UUID; body: Note['body']; container?: Container; } = { ...op, version: originalVersion }
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

      const db: Database = await getDb()
      const rows: { id: number; kind: string; note_uuid: string; payload: string; }[] = await db.select<{ id: number; kind: string; note_uuid: string; payload: string }[]>(
        'SELECT id, kind, note_uuid, payload FROM outbox ORDER BY id ASC',
      )

      return rows.map(parseRow)
    })
  },

  /**
   * Marks a sent op done. A body edit can be merged into the same row while
   * its save is in flight; that row then holds newer text, so it stays,
   * rebased onto `nextVersion` (the version the server just returned).
   * Returns true when the row was removed.
   */
  async complete(sent: OutboxItem, nextVersion?: number): Promise<boolean> {
    return withLock(async () => {
      const current: OutboxItem | null = await readOp(sent.id)
      if (current === null) return true

      if (serialize(current) === serialize(sent)) {
        await deleteOp(sent.id)
        return true
      }

      if (current.kind === 'body' && nextVersion !== undefined) {
        await writeOp({ ...current, version: nextVersion })
      }
      return false
    })
  },

  /** Drops an op without sending it again (the server rejected it). */
  async remove(id: number): Promise<void> {
    return withLock(() => deleteOp(id))
  },

  async count(): Promise<number> {
    if (!isNative()) {
      return webOps.length
    }

    const db: Database = await getDb()
    const rows: { count: number; }[] = await db.select<{ count: number }[]>(
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

      const db: Database = await getDb()
      await db.execute('DELETE FROM outbox')
    })
  },
}
