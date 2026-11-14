# Backend rules: Notes

@../docs/standards/fastapi.md

## Project-specific backend rules

- **Database:** Postgres 18 through SQLAlchemy 2.x and psycopg 3 (synchronous, so endpoints are plain `def`). Tests need a real Postgres (`TEST_DATABASE_URL`), because the ICU collation and full-text search have no in-memory stand-in.
- **Case- and accent-insensitive text:** `users.email`, folder and tag names, tag slugs and note titles use the ICU collation `case_insensitive` created by the first migration, so uniqueness and lookups ignore case and accents like the MySQL database before it.
- **Note bodies** are stored as `json`, not `jsonb`, because `jsonb` reorders keys.
- **Entities and their layer files:** user, session, access_token, folder, tag, note, search, bootstrap; health.
- **Content layer (`app/content/`):** the editor schema, Markdown → ProseMirror and ProseMirror → Markdown converters, note text derivation (title, excerpt, plain text, word count), slugs and search snippets. Pure functions, no database access. Golden fixtures in `tests/golden/` pin their output.
- **MCP (`app/mcp/`):** the MCP server at `/mcp`, its bearer-token authentication and one module per tool group. Tools are `async` and call the synchronous services in a worker thread.
- **Personal access tokens** keep the previous API's format (`{id}|notes_pat_…`, SHA-256 stored), so tokens created before the migration keep working.
- **Passwords** are Argon2. Hashes migrated from the previous API are bcrypt; they are verified once and rehashed to Argon2 on the next login.
- **Rate limits** are counted in memory, so the API runs one uvicorn worker.
- **Indexes:** see `docs/architecture.md`.
