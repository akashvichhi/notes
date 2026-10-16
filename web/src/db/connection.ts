import Database from '@tauri-apps/plugin-sql'

import { MIGRATIONS } from './schema'

let db: Database | null = null
let opening: Promise<Database> | null = null

async function applyMigrations(conn: Database): Promise<void> {
  await conn.execute(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)',
  )

  const rows = await conn.select<{ version: number }[]>(
    'SELECT COALESCE(MAX(version), 0) AS version FROM schema_version',
  )
  const current = rows[0]?.version ?? 0

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue
    await conn.execute(m.sql)
    await conn.execute('INSERT INTO schema_version (version) VALUES ($1)', [m.version])
  }
}

/** Opens the database once. Concurrent callers share one open promise. */
export async function getDb(): Promise<Database> {
  if (db) return db
  if (opening) return opening

  opening = (async () => {
    // Resolves to the OS app-data directory: %APPDATA%\com.notesapp.desktop,
    // ~/Library/Application Support/..., ~/.local/share/...
    const conn = await Database.load('sqlite:notes.db')
    await conn.execute('PRAGMA journal_mode = WAL')
    await conn.execute('PRAGMA foreign_keys = ON')
    await applyMigrations(conn)
    db = conn
    return conn
  })()

  return opening
}
