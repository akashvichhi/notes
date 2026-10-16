import type { Container, LocalTag, Tag } from '@/types/api'

import { getDb } from './connection'

function rowToTag(r: Record<string, unknown>): Tag {
  return {
    uuid: r.uuid as string,
    name: (r.name as string) ?? '',
    slug: (r.slug as string) ?? '',
  }
}

export const tagsRepo = {
  async list(container: Container): Promise<Tag[]> {
    const db = await getDb()
    const rows = await db.select<Record<string, unknown>[]>(
      'SELECT * FROM tags WHERE container = $1 AND deleted_at IS NULL ORDER BY name ASC',
      [container],
    )
    return rows.map(rowToTag)
  },

  async upsert(tag: LocalTag): Promise<void> {
    const db = await getDb()
    await db.execute(
      `INSERT INTO tags (uuid, container, name, slug, deleted_at, dirty, server_revision)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(uuid) DO UPDATE SET
         container = excluded.container,
         name = excluded.name,
         slug = excluded.slug,
         deleted_at = excluded.deleted_at,
         dirty = excluded.dirty,
         server_revision = excluded.server_revision`,
      [
        tag.uuid,
        tag.container,
        tag.name,
        tag.slug,
        tag.deleted_at,
        tag.dirty ? 1 : 0,
        tag.server_revision,
      ],
    )
  },

  async softDelete(uuid: string, container?: Container): Promise<void> {
    const db = await getDb()
    const now = new Date().toISOString()
    if (container) {
      await db.execute(
        'UPDATE tags SET deleted_at = $1, dirty = 1 WHERE uuid = $2 AND container = $3',
        [now, uuid, container],
      )
    } else {
      await db.execute('UPDATE tags SET deleted_at = $1, dirty = 1 WHERE uuid = $2', [now, uuid])
    }
  },

  async hardDelete(uuid: string, container?: Container): Promise<void> {
    const db = await getDb()
    if (container) {
      await db.execute('DELETE FROM tags WHERE uuid = $1 AND container = $2', [uuid, container])
    } else {
      await db.execute('DELETE FROM tags WHERE uuid = $1', [uuid])
    }
    await db.execute('DELETE FROM note_tag WHERE tag_uuid = $1', [uuid])
  },

  async setNoteTags(noteUuid: string, tagNames: string[], container: Container): Promise<void> {
    const db = await getDb()
    await db.execute('DELETE FROM note_tag WHERE note_uuid = $1', [noteUuid])
    for (const name of tagNames) {
      const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const tagRows = await db.select<{ uuid: string }[]>(
        'SELECT uuid FROM tags WHERE slug = $1 AND container = $2 LIMIT 1',
        [slug, container],
      )
      let tagUuid: string
      if (tagRows[0]?.uuid) {
        tagUuid = tagRows[0].uuid
      } else {
        tagUuid = crypto.randomUUID()
        await this.upsert({
          uuid:            tagUuid,
          container,
          name,
          slug,
          deleted_at:      null,
          dirty:           container === 'cloud',
          server_revision: null,
        })
      }
      await db.execute('INSERT OR IGNORE INTO note_tag (note_uuid, tag_uuid) VALUES ($1, $2)', [noteUuid, tagUuid])
    }
  },

  async clearContainer(container: Container): Promise<void> {
    const db = await getDb()
    await db.execute(
      'DELETE FROM note_tag WHERE note_uuid IN (SELECT uuid FROM notes WHERE container = $1)',
      [container],
    )
    await db.execute('DELETE FROM tags WHERE container = $1', [container])
  },
}
