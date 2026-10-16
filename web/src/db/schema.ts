export interface Migration {
  version: number
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql:     `
CREATE TABLE IF NOT EXISTS notes (
  uuid            TEXT PRIMARY KEY,
  container       TEXT NOT NULL CHECK(container IN ('cloud','local')),
  folder_uuid     TEXT,
  title           TEXT NOT NULL DEFAULT '',
  title_locked    INTEGER NOT NULL DEFAULT 0,
  body            TEXT,              -- ProseMirror JSON, serialised
  plain_text      TEXT NOT NULL DEFAULT '',
  excerpt         TEXT NOT NULL DEFAULT '',
  is_starred      INTEGER NOT NULL DEFAULT 0,
  word_count      INTEGER NOT NULL DEFAULT 0,
  deleted_at      TEXT,
  updated_at      TEXT NOT NULL,
  -- sync bookkeeping; NULL/0 for container='local'
  server_version  INTEGER,
  server_revision INTEGER,
  dirty           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notes_scope ON notes(container, deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(container, folder_uuid, deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_dirty ON notes(container, dirty);

CREATE TABLE IF NOT EXISTS folders (
  uuid TEXT PRIMARY KEY,
  container TEXT NOT NULL CHECK(container IN ('cloud','local')),
  parent_uuid TEXT, name TEXT NOT NULL, color TEXT,
  position INTEGER NOT NULL DEFAULT 0, deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 0, server_revision INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique
  ON folders(container, IFNULL(parent_uuid,''), name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS tags (
  uuid TEXT PRIMARY KEY,
  container TEXT NOT NULL CHECK(container IN ('cloud','local')),
  name TEXT NOT NULL, slug TEXT NOT NULL, deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 0, server_revision INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_unique ON tags(container, slug);

CREATE TABLE IF NOT EXISTS note_tag (
  note_uuid TEXT NOT NULL, tag_uuid TEXT NOT NULL,
  PRIMARY KEY (note_uuid, tag_uuid)
);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,              -- create | body | meta | tags | trash | force
  note_uuid TEXT NOT NULL,
  payload TEXT NOT NULL,           -- JSON
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  uuid UNINDEXED, title, plain_text, container UNINDEXED,
  tokenize = 'unicode61'
);
`,
  },
]
