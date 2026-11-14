# Notes — Architecture

A web notes app. A React single-page app talks to a Laravel API that stores every note
in MySQL. The same API exposes an MCP server, so AI assistants can read and write notes
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
          │   LARAVEL API        │◄───────│  AI ASSISTANT    │
          │   /api/v1 (Sanctum)  │  /mcp  │  Bearer token    │
          │   /mcp (laravel/mcp) │        └──────────────────┘
          └──────────┬───────────┘
                     ▼
          ┌──────────────────────┐
          │      MySQL 8.4       │
          └──────────────────────┘
```

- **One origin.** Laravel serves the built SPA from `api/public`, so the app, `/api`,
  `/sanctum` and `/mcp` share one origin (decision 2). In development the Vite dev
  server proxies `/api` and `/sanctum` to the API, which keeps cookies and CSRF the same
  as in production.
- **Reads go to the API.** TanStack Query caches server data in memory; there is no
  local copy of the notes.

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

MySQL 8.4:

```sql
notes(id, uuid, user_id, folder_id, title, title_locked, body JSON,
      plain_text LONGTEXT, excerpt, is_starred, version, word_count,
      deleted_at, created_at, updated_at,
      FULLTEXT ft_notes(title, plain_text))
folders(...)  tags(...)  note_tag(...)  note_versions(...)
personal_access_tokens(...)   -- Sanctum, plus a `type` column
```

- **Bodies are ProseMirror JSON.** The server derives `plain_text` from the body for
  full-text search and never accepts it from the client.
- **Trash is a soft delete** (`deleted_at`). Every note query goes through the one
  helper that applies the Trash filter.
- **UUIDs are public ids.** The web app mints a note's UUID itself so it can show the
  note optimistically; `POST /notes` is idempotent on that UUID, so a retried create
  never makes a second note.

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
| Browser | Sanctum stateful session | httpOnly cookie; JavaScript never sees it |
| MCP client | Personal access token | The client's own configuration |

- **Browser.** axios sends `withCredentials` and `withXSRFToken`; a 419 is retried once
  after refreshing the CSRF cookie. The signed-in user lives only in the TanStack Query
  cache. Sign-out clears the query cache, the open tabs and the draft buffer.
- **Personal access tokens** are created on the Access tokens page with `notes:read`
  and/or `notes:write` and an expiry. They never carry the `account` ability, so every
  delete, trash, restore, profile, password and token route is out of their reach.
  Changing or resetting the password revokes every token.

---

## 5 · MCP server

`laravel/mcp` serves `NotesServer` at `/mcp` over Streamable HTTP, behind
`auth:sanctum`, the read ability and a rate limit of 120 requests a minute. Each tool
declares the scope it needs and checks it before doing anything. The tools call the
same services and policies as the REST API, so the MCP server has no data access of its
own. Bodies are converted to and from markdown at the MCP edge; formatting markdown
can't express is kept as inline HTML. No tool deletes, trashes or restores anything,
and notes in the Trash are invisible to it.

---

## 6 · Technology stack

Exact versions are pinned in `web/package.json` and `api/composer.json`.

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
| PHP, Laravel (API-only) | The API |
| Laravel Sanctum | Session cookies for the browser, personal access tokens for MCP |
| laravel/mcp | The MCP server |
| MySQL 8.4 | Storage, `FULLTEXT` search |

### Testing and tooling

Pest (API) · Vitest + React Testing Library (web) · ESLint · Stylelint · Docker Compose
(MySQL for local development).

---

## 7 · Deliberately deferred

Block-level auto-merge · CRDT/real-time collaboration · sharing notes between
accounts · attachments · end-to-end encryption · import/export · a settings screen.
