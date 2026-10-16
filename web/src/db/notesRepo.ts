import type { Container, LocalNote, Note, NoteListItem } from '@/types/api'

import { getDb } from './connection'

function rowToListItem(r: Record<string, unknown>): NoteListItem {
  let tags: string[] = []
  if (typeof r.tags_json === 'string') {
    try {
      tags = JSON.parse(r.tags_json)
    } catch {
      tags = []
    }
  }

  return {
    uuid:       r.uuid as string,
    container:  (r.container as Container) ?? undefined,
    title:      (r.title as string) ?? '',
    excerpt:    (r.excerpt as string) ?? '',
    is_starred: Boolean(r.is_starred),
    folder:     r.folder_uuid ? { uuid: r.folder_uuid as string, name: (r.folder_name as string) ?? '' } : null,
    tags,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string) ?? null,
  }
}

function rowToNote(r: Record<string, unknown>): Note {
  let body = null
  if (typeof r.body === 'string' && r.body) {
    try {
      body = JSON.parse(r.body)
    } catch {
      body = null
    }
  }

  return {
    ...rowToListItem(r),
    body,
    version:      (r.server_version as number) ?? 1,
    word_count:   (r.word_count as number) ?? 0,
    title_locked: Boolean(r.title_locked),
    plain_text:   (r.plain_text as string) ?? '',
  }
}

export const notesRepo = {
  async list(
    container: Container,
    opts: {
      folderUuid?: string
      tag?: string
      starred?: boolean
      trashed?: boolean
    } = {},
  ): Promise<NoteListItem[]> {
    const db = await getDb()
    const where = ['n.container = $1', opts.trashed ? 'n.deleted_at IS NOT NULL' : 'n.deleted_at IS NULL']
    const args: unknown[] = [container]

    if (opts.folderUuid) {
      args.push(opts.folderUuid)
      where.push(`n.folder_uuid = $${args.length}`)
    }

    if (opts.starred) {
      where.push('n.is_starred = 1')
    }

    if (opts.tag) {
      args.push(opts.tag)
      where.push(`EXISTS (
        SELECT 1 FROM note_tag nt
        JOIN tags t ON t.uuid = nt.tag_uuid
        WHERE nt.note_uuid = n.uuid AND (t.name = $${args.length} OR t.slug = $${args.length})
      )`)
    }

    const query = `
      SELECT n.*, f.name AS folder_name,
        (SELECT json_group_array(t.name) FROM note_tag nt JOIN tags t ON t.uuid = nt.tag_uuid WHERE nt.note_uuid = n.uuid) AS tags_json
      FROM notes n
      LEFT JOIN folders f ON f.uuid = n.folder_uuid
      WHERE ${where.join(' AND ')}
      ORDER BY n.updated_at DESC
    `

    const rows = await db.select<Record<string, unknown>[]>(query, args)
    return rows.map(rowToListItem)
  },

  async get(uuid: string, container?: Container): Promise<Note | null> {
    const db = await getDb()
    const where = ['n.uuid = $1']
    const args: unknown[] = [uuid]

    if (container) {
      args.push(container)
      where.push(`n.container = $${args.length}`)
    }

    const query = `
      SELECT n.*, f.name AS folder_name,
        (SELECT json_group_array(t.name) FROM note_tag nt JOIN tags t ON t.uuid = nt.tag_uuid WHERE nt.note_uuid = n.uuid) AS tags_json
      FROM notes n
      LEFT JOIN folders f ON f.uuid = n.folder_uuid
      WHERE ${where.join(' AND ')}
      LIMIT 1
    `

    const rows = await db.select<Record<string, unknown>[]>(query, args)
    if (!rows[0]) return null
    return rowToNote(rows[0])
  },

  async upsert(note: LocalNote): Promise<void> {
    const db = await getDb()
    const bodyStr = note.body ? JSON.stringify(note.body) : null

    await db.execute(
      `INSERT INTO notes (
        uuid, container, folder_uuid, title, title_locked, body,
        plain_text, excerpt, is_starred, word_count, deleted_at,
        updated_at, server_version, server_revision, dirty
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT(uuid) DO UPDATE SET
        folder_uuid = excluded.folder_uuid,
        title = excluded.title,
        title_locked = excluded.title_locked,
        body = excluded.body,
        plain_text = excluded.plain_text,
        excerpt = excluded.excerpt,
        is_starred = excluded.is_starred,
        word_count = excluded.word_count,
        deleted_at = excluded.deleted_at,
        updated_at = excluded.updated_at,
        server_version = excluded.server_version,
        server_revision = excluded.server_revision,
        dirty = excluded.dirty`,
      [
        note.uuid,
        note.container,
        note.folder_uuid,
        note.title,
        note.title_locked ? 1 : 0,
        bodyStr,
        note.plain_text,
        note.excerpt,
        note.is_starred ? 1 : 0,
        note.word_count,
        note.deleted_at,
        note.updated_at,
        note.server_version,
        note.server_revision,
        note.dirty ? 1 : 0,
      ],
    )

    // Keep the search index in step with the row it mirrors.
    await db.execute('DELETE FROM notes_fts WHERE uuid = $1', [note.uuid])
    if (!note.deleted_at) {
      await db.execute(
        'INSERT INTO notes_fts (uuid, title, plain_text, container) VALUES ($1,$2,$3,$4)',
        [note.uuid, note.title, note.plain_text, note.container],
      )
    }
  },

  async softDelete(uuid: string, container?: Container): Promise<void> {
    const db = await getDb()
    const now = new Date().toISOString()
    if (container) {
      await db.execute(
        'UPDATE notes SET deleted_at = $1, dirty = 1, updated_at = $1 WHERE uuid = $2 AND container = $3',
        [now, uuid, container],
      )
    } else {
      await db.execute(
        'UPDATE notes SET deleted_at = $1, dirty = 1, updated_at = $1 WHERE uuid = $2',
        [now, uuid],
      )
    }
    await db.execute('DELETE FROM notes_fts WHERE uuid = $1', [uuid])
  },

  async restore(uuid: string, container?: Container): Promise<void> {
    const db = await getDb()
    const now = new Date().toISOString()
    if (container) {
      await db.execute(
        'UPDATE notes SET deleted_at = NULL, dirty = 1, updated_at = $1 WHERE uuid = $2 AND container = $3',
        [now, uuid, container],
      )
    } else {
      await db.execute(
        'UPDATE notes SET deleted_at = NULL, dirty = 1, updated_at = $1 WHERE uuid = $2',
        [now, uuid],
      )
    }
    const note = await this.get(uuid, container)
    if (note) {
      await db.execute(
        'INSERT OR REPLACE INTO notes_fts (uuid, title, plain_text, container) VALUES ($1,$2,$3,$4)',
        [note.uuid, note.title, note.plain_text ?? note.title, note.container ?? 'local'],
      )
    }
  },

  async hardDelete(uuid: string, container?: Container): Promise<void> {
    const db = await getDb()
    if (container) {
      await db.execute('DELETE FROM notes WHERE uuid = $1 AND container = $2', [uuid, container])
    } else {
      await db.execute('DELETE FROM notes WHERE uuid = $1', [uuid])
    }
    await db.execute('DELETE FROM note_tag WHERE note_uuid = $1', [uuid])
    await db.execute('DELETE FROM notes_fts WHERE uuid = $1', [uuid])
  },

  async markDirty(uuid: string, dirty = true): Promise<void> {
    const db = await getDb()
    await db.execute('UPDATE notes SET dirty = $1 WHERE uuid = $2', [dirty ? 1 : 0, uuid])
  },

  /** Offline full-text search. Spans both containers when none is given. */
  async search(query: string, container?: Container): Promise<NoteListItem[]> {
    const db = await getDb()
    const rawTrim = query.trim()
    if (!rawTrim) return []

    // 1. Try FTS5 first
    try {
      const match = rawTrim
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => `"${t.replace(/[*"]/g, '')}"*`)
        .join(' ')

      if (match) {
        const rows = await db.select<Record<string, unknown>[]>(
          `SELECT n.*, fld.name AS folder_name,
            (SELECT json_group_array(t.name) FROM note_tag nt JOIN tags t ON t.uuid = nt.tag_uuid WHERE nt.note_uuid = n.uuid) AS tags_json
           FROM notes_fts f
           JOIN notes n ON n.uuid = f.uuid
           LEFT JOIN folders fld ON fld.uuid = n.folder_uuid
           WHERE notes_fts MATCH $1 ${container ? 'AND n.container = $2' : ''}
             AND n.deleted_at IS NULL
           ORDER BY rank
           LIMIT 50`,
          container ? [match, container] : [match],
        )
        if (rows.length > 0) {
          return rows.map(rowToListItem)
        }
      }
    } catch {
      // FTS syntax error or missing table, fallback to LIKE below
    }

    // 2. Fallback to LIKE substring search on title and plain_text
    const likePattern = `%${rawTrim.replace(/[%_]/g, '')}%`
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT n.*, f.name AS folder_name,
        (SELECT json_group_array(t.name) FROM note_tag nt JOIN tags t ON t.uuid = nt.tag_uuid WHERE nt.note_uuid = n.uuid) AS tags_json
       FROM notes n
       LEFT JOIN folders f ON f.uuid = n.folder_uuid
       WHERE (n.title LIKE $1 OR n.plain_text LIKE $1)
         AND n.deleted_at IS NULL
         ${container ? 'AND n.container = $2' : ''}
       ORDER BY n.updated_at DESC
       LIMIT 50`,
      container ? [likePattern, container] : [likePattern],
    )
    return rows.map(rowToListItem)
  },

  async getDirtyCloudNotes(): Promise<Note[]> {
    const db = await getDb()
    const query = `
      SELECT n.*, f.name AS folder_name,
        (SELECT json_group_array(t.name) FROM note_tag nt JOIN tags t ON t.uuid = nt.tag_uuid WHERE nt.note_uuid = n.uuid) AS tags_json
      FROM notes n
      LEFT JOIN folders f ON f.uuid = n.folder_uuid
      WHERE n.container = 'cloud' AND n.dirty = 1
    `
    const rows = await db.select<Record<string, unknown>[]>(query)
    return rows.map(rowToNote)
  },

  async clearContainer(container: Container): Promise<void> {
    const db = await getDb()
    try {
      await db.execute('DELETE FROM notes_fts WHERE container = $1', [container])
    } catch {
      // Ignore if FTS table does not exist
    }
    await db.execute('DELETE FROM notes WHERE container = $1', [container])
  },
}
