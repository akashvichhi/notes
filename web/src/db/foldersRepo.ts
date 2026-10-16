import type { Container, Folder, LocalFolder } from '@/types/api'

import { getDb } from './connection'

function rowToFolder(r: Record<string, unknown>): Folder {
  return {
    uuid:        r.uuid as string,
    name:        (r.name as string) ?? '',
    parent_uuid: (r.parent_uuid as string) ?? null,
    color:       (r.color as string) ?? null,
    position:    (r.position as number) ?? 0,
  }
}

export const foldersRepo = {
  async list(container: Container): Promise<Folder[]> {
    const db = await getDb()
    const rows = await db.select<Record<string, unknown>[]>(
      'SELECT * FROM folders WHERE container = $1 AND deleted_at IS NULL ORDER BY position ASC, name ASC',
      [container],
    )
    return rows.map(rowToFolder)
  },

  async get(uuid: string, container?: Container): Promise<Folder | null> {
    const db = await getDb()
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM folders WHERE uuid = $1 ${container ? 'AND container = $2' : ''} LIMIT 1`,
      container ? [uuid, container] : [uuid],
    )
    if (!rows[0]) return null
    return rowToFolder(rows[0])
  },

  async upsert(folder: LocalFolder): Promise<void> {
    const db = await getDb()
    await db.execute(
      `INSERT INTO folders (uuid, container, parent_uuid, name, color, position, deleted_at, dirty, server_revision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT(uuid) DO UPDATE SET
         container = excluded.container,
         parent_uuid = excluded.parent_uuid,
         name = excluded.name,
         color = excluded.color,
         position = excluded.position,
         deleted_at = excluded.deleted_at,
         dirty = excluded.dirty,
         server_revision = excluded.server_revision`,
      [
        folder.uuid,
        folder.container,
        folder.parent_uuid,
        folder.name,
        folder.color,
        folder.position,
        folder.deleted_at,
        folder.dirty ? 1 : 0,
        folder.server_revision,
      ],
    )
  },

  async softDelete(uuid: string, container?: Container): Promise<void> {
    const db = await getDb()
    const now = new Date().toISOString()
    if (container) {
      await db.execute(
        'UPDATE folders SET deleted_at = $1, dirty = 1 WHERE uuid = $2 AND container = $3',
        [now, uuid, container],
      )
    } else {
      await db.execute('UPDATE folders SET deleted_at = $1, dirty = 1 WHERE uuid = $2', [now, uuid])
    }
  },

  async hardDelete(uuid: string, container?: Container): Promise<void> {
    const db = await getDb()
    if (container) {
      await db.execute('DELETE FROM folders WHERE uuid = $1 AND container = $2', [uuid, container])
    } else {
      await db.execute('DELETE FROM folders WHERE uuid = $1', [uuid])
    }
  },
}
