# Notes — Architecture

A web notes app. A React single-page app talks to a FastAPI API that stores every note
in Postgres. The same API exposes an MCP server, so AI assistants can read and write notes
with a personal access token. The app is web-only (decision 1).

---

## 1 · System architecture

```
┌──────────────── BROWSER ────────────────┐
│  React 19 · TypeScript · Mantine 9      │
│  TipTap 3 · TanStack Query · Zustand    │
│  IndexedDB: draft buffer only           │
└────────────────────┬────────────────────┘
                     │  HTTPS / JSON, session cookie
                     ▼
          ┌──────────────────────┐        ┌──────────────────┐
          │    CADDY (HTTPS)     │◄───────│  AI ASSISTANT    │
          └──────────┬───────────┘  /mcp  │  Bearer token    │
                     ▼                    └──────────────────┘
          ┌──────────────────────┐
          │   FASTAPI API        │
          │   /api/v1 · /mcp     │
          │   the web build      │
          └──────────┬───────────┘
                     ▼
          ┌──────────────────────┐
          │     Postgres 18      │
          └──────────────────────┘
```

- **One origin.** The API serves the built SPA from `web/dist`, so the app, `/api` and
  `/mcp` share one origin (decision 9). In development the Vite dev server proxies
  `/api` to the API, so the session cookie behaves as in production.
- **Reads go to the API.** TanStack Query caches server data in memory; there is no
  local copy of the notes.
- **Key case.** The API speaks snake_case and the app camelCase; the axios interceptors
  convert the keys (`web/src/utils/case_conversion.ts`). Note bodies pass through
  untouched.

---

## 2 · Where data is saved

### In the browser

| Store | Holds | Survives |
|---|---|---|
| IndexedDB (`idb-keyval`) | Draft buffer: the in-progress document of each open note | Reload, crash |
| `localStorage` | Open tabs, pane sizes, theme | Reload |
| Memory (TanStack Query) | Server data, the signed-in user | Nothing |

The draft buffer is written on every change, so a crash or reload never loses typing.
It is cleared once the API confirms the save, and on sign-out.

### On the server

Postgres 18, schema in `api/migrations/`:

```sql
users(id, uuid, name, email, password_hash, preferences JSON, created_at, updated_at)
sessions(id, user_id, token_hash, expires_at, created_at)
access_tokens(id, user_id, name, token_hash, abilities, last_used_at, expires_at, ...)
folders(id, uuid, user_id, parent_id, name, color, position, ...)
tags(id, uuid, user_id, name, slug, ...)
notes(id, uuid, user_id, folder_id, title, title_locked, body JSON, plain_text,
      excerpt, is_starred, version, word_count, deleted_at, created_at, updated_at,
      search_vector TSVECTOR GENERATED)
note_tag(note_id, tag_id)
```

- **Case- and accent-insensitive text.** Emails, folder and tag names, tag slugs and
  note titles use the ICU collation `case_insensitive`, so uniqueness and lookups
  ignore case and accents.
- **Bodies are stored as `json`, not `jsonb`**, because `jsonb` reorders keys.
- **Bodies are ProseMirror JSON.** The server derives `plain_text` from the body and
  never accepts it from the client; `search_vector` is generated from the title and
  `plain_text`.
- **Trash is a soft delete** (`deleted_at`). Every note query goes through the one
  helper that applies the Trash filter.
- **UUIDs are public ids.** The web app mints a note's UUID itself so it can show the
  note optimistically; `POST /notes` is idempotent on that UUID, so a retried create
  never makes a second note.

### Indexes

| Index | Why |
|---|---|
| `notes (user_id, deleted_at, updated_at)` | The All Notes and Trash lists: one user's notes, in or out of the Trash, newest first |
| `notes (user_id, folder_id, deleted_at)` | A folder's list and the per-folder counts |
| `notes (user_id, is_starred, deleted_at)` | The Starred list and its count |
| `notes (folder_id)` | Clearing a deleted folder from its notes (`ON DELETE SET NULL`) |
| `notes (search_vector)` GIN | Full-text search |
| `note_tag (tag_id)` | A tag's notes and counts; the primary key covers lookups by note |
| `folders (user_id, parent_id, name)` unique | No two sibling folders share a name, root folders included (`NULLS NOT DISTINCT`) |
| `folders (user_id, parent_id)` | One level of the folder tree |
| `folders (parent_id)` | A folder's children, when it is deleted or moved |
| `tags (user_id, slug)` unique | One tag per slug per user; tag lookups by slug |
| `users (email)` unique | Sign-in lookup; one account per email, whatever the case |
| `sessions (token_hash)`, `access_tokens (token_hash)` unique | Finding the session or token behind a request |
| `sessions (user_id)`, `access_tokens (user_id)` | Signing a user out everywhere; listing a user's tokens |
| `sessions (expires_at)`, `access_tokens (expires_at)` | The daily prune of expired credentials |
| `uuid` unique on users, folders, tags, notes | Public ids in URLs and request bodies |

---

## 3 · Saving and conflicts

**Autosave.** The editor saves the body after a pause in typing, and immediately on
⌘S / Ctrl+S, blur, `visibilitychange` and `beforeunload`. Every body save carries the
note `version` it was based on. **Metadata writes (star, move, tags) carry no version**,
so they never conflict with a save in flight.

**Conflicts.** If the note was saved elsewhere in between (another tab, another
browser, or an AI assistant through the MCP server), the API answers **409** with the
server's copy:

```
PATCH {body, version: 7}  →  server is at 9  →  409 + server copy
```

The edit is **not discarded**. The conflict sheet offers:

| Choice | Result |
|---|---|
| **Save mine as a copy** ← default | A new note holds your text; the original keeps theirs. Nothing is lost |
| Keep mine | Resends at the current version |
| Keep theirs | The edit is dropped and the server copy is shown |

If the note was moved to Trash in the meantime, the server rejects the body write with
409 too, and the sheet asks whether to **restore the note and keep the edit** or
**discard the edit**.

This is document-level conflict handling with copies, the model Dropbox and Obsidian
Sync use. CRDTs were rejected: one person rarely edits the same note in two places at
once, and a CRDT would replace readable JSON with binary state the server can't search.

---

## 4 · Authentication

| Client | Mechanism | Credential stored in |
|---|---|---|
| Browser | Server-side session; only a hash of its id is stored | httpOnly cookie; JavaScript never sees it |
| MCP client | Personal access token (`{id}|notes_pat_…`); only its SHA-256 is stored | The client's own configuration |

- **Browser.** axios sends `withCredentials`. CSRF protection is `SameSite=Lax` plus an
  origin check on every write (`ALLOWED_ORIGINS`). The signed-in user lives only in the
  TanStack Query cache. Sign-out clears the query cache, the open tabs and the draft
  buffer.
- **Personal access tokens** are created on the Access tokens page with `notes:read`
  and/or `notes:write` and an expiry. They work only at `/mcp`; every REST route takes
  the session cookie alone. Changing the password revokes every token.
- **Expired sessions and tokens** are rejected when used and removed every day at 23:00
  India time by the scheduler container (`api/scripts/prune_expired.py`, run by
  `docker/scripts/run_daily_at.sh`).
- **The demo account** (`DEMO_EMAIL`) is reset every day at 23:05 India time by the
  `demo-reset` container (`api/scripts/reset_demo.py`): its sessions end, its tokens go,
  and its notes, folders and tags are replaced by the sample content, in one
  transaction (decision 14).

---

## 5 · MCP server

The official `mcp` SDK serves the server at `/mcp` over Streamable HTTP, stateless,
with JSON responses (decision 8). A wrapper in front of it checks the Bearer token, its
expiry and abilities, and a rate limit of 120 requests a minute per token. Each tool
declares the scope it needs and checks it before doing anything. The tools call the
same services as the REST API (`api/app/mcp/`), so the MCP server has no data access
of its own. Bodies are converted to and from markdown at the MCP edge (decision 7);
formatting markdown can't express is kept as inline HTML. No tool deletes, trashes or
restores anything, and notes in the Trash are invisible to it.

---

## 6 · Technology stack

Exact versions are pinned in `web/package.json` and `api/pyproject.toml` (locked in
`api/uv.lock`).

### Frontend

| Technology | Role |
|---|---|
| React, TypeScript (strict), Vite | UI, types, build and dev server |
| Mantine | Components — core, hooks, spotlight, notifications, modals, form, tiptap |
| TipTap | Rich-text editor (ProseMirror) |
| TanStack Query | Server state, optimistic updates |
| Zustand | UI state — tabs, panes, scope |
| React Router | Routing |
| axios | HTTP |
| idb-keyval | IndexedDB draft buffer |
| Tabler Icons, dayjs | Icons, dates |
| react-error-boundary | Error boundaries (decision 3) |
| SCSS modules (sass) | Styles built on tokens (decision 4) |

### Errors and resilience (frontend)

- **One error shape.** The axios response interceptor rejects every failure as an
  `ApiError` (`status`, `message`, optional field `errors` and `serverCopy`); a network
  error is `status: 0`. React Query's `defaultError` is `ApiError`, so hooks and
  components read `error.status` and never a raw axios error.
- **No blank screens.** Error boundaries sit at four levels: root (plain HTML, outside
  every provider), app, route (around each lazy page, reset on navigation) and the
  editor (a bad note body leaves the list and sidebar working). Fallbacks never show
  error messages or stacks; `onError` logs only the error's name.
- **Stale deploys.** A failed lazy-chunk load reloads the page once through one helper,
  guarded in `sessionStorage`; inside the guard window the user sees "A new version is
  available" with a Reload button instead of a reload loop.
- **Stray errors.** A global `error` / `unhandledrejection` listener shows one throttled,
  generic notification and ignores chunk-load errors.

### Backend

| Technology | Role |
|---|---|
| Python, FastAPI, Pydantic | The API, input validation, response shapes |
| SQLAlchemy, Alembic, psycopg | Database access (synchronous) and migrations |
| Postgres 18 | Storage, full-text search, ICU collation |
| Argon2 | Password hashing |
| mcp | The MCP server (decision 8) |
| markdown-it-py, lxml | Markdown ↔ ProseMirror at the MCP edge (decision 7) |
| uvicorn | The ASGI server, one worker (the rate limits are counted in memory) |

### Testing and tooling

pytest against a real Postgres, ruff, mypy strict (API) · Vitest + React Testing
Library, ESLint, Stylelint (web) · Docker Compose (Postgres for local development, the
whole app on the server, decision 10).

---

## 7 · Deliberately deferred

Block-level auto-merge · CRDT/real-time collaboration · sharing notes between
accounts · attachments · end-to-end encryption · import/export · a settings screen.
