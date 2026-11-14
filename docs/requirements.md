# Notes App — Design Specification

**Date:** 2026-10-11 · **Status:** approved, ready for implementation
**Supersedes:** the PWA specification of 2026-10-09

A web notes application in the spirit of Apple Notes. A React single-page app talks to
a Laravel API on MySQL, which also exposes an MCP server for AI assistants. The app is
web-only (decision 1).

---

## 1 · Scope

### In scope

Multi-user accounts · notes CRUD · nested folders · tags · star · trash with 30-day
purge · rich-text editing with the full toolbar · autosave with conflict detection ·
global search · scoped list filter · editor tabs on wide screens · light/dark · full
responsive behaviour · personal access tokens and an MCP server.

### Explicitly deferred

| Deferred | Why |
|---|---|
| Import / export | Dropped by the product owner |
| Settings screen | Only theme is touched daily, and it is a header button |
| Version history UI | `note_versions` exists; nothing surfaces it yet |
| Attachments | Needs storage, signed URLs and an upload pipeline |
| Block-level auto-merge | Planned after real conflict rates are observable |
| Sharing, real-time collaboration | Conflict detection by version is the answer for now |
| End-to-end encryption | Server-side search requires readable text |

### Non-goals

Native desktop or mobile apps. A Progressive Web App. Offline editing. Markdown as the
typing surface.

---

## 2 · Stack

Exact versions are pinned in `web/package.json` and `api/composer.json`.

- **Frontend:** React 19, Vite, TypeScript (strict), Mantine (core, hooks, tiptap,
  spotlight, notifications, modals, form), TipTap 3 with the MIT extension set,
  TanStack Query 5, Zustand, React Router, axios, Tabler Icons, idb-keyval, dayjs.
  No TipTap Pro, no CKEditor.
- **Backend:** PHP 8.3+, Laravel (API-only), Laravel Sanctum, `laravel/mcp`,
  **MySQL 8.0+ only**, InnoDB, `utf8mb4` / `utf8mb4_0900_ai_ci`.
- **Testing:** Pest · Vitest + Testing Library.

---

## 3 · Architecture decisions

### 3.1 Authentication

The browser signs in with Sanctum's **stateful session cookie** (httpOnly,
`SameSite=Lax`): `statefulApi()` middleware, `SANCTUM_STATEFUL_DOMAINS`,
`supports_credentials`, and axios with **both** `withCredentials` and `withXSRFToken`.
JavaScript never sees a credential, and nothing auth-related is written to
`localStorage` or `sessionStorage`.

**Personal access tokens** exist only for MCP clients. They carry `notes:read` and/or
`notes:write`, never the `account` ability, so no token can reach a delete, trash,
restore, profile, password or token route.

### 3.2 Note body — ProseMirror JSON

The toolbar exposes highlight, text colour, subscript/superscript and text-align.
None can be represented in GFM markdown, so markdown cannot be canonical.

| Column | Type | Role |
|---|---|---|
| `body` | `JSON` | Canonical ProseMirror document |
| `plain_text` | `LONGTEXT` | **Derived server-side**; feeds `FULLTEXT` |
| `excerpt` | `VARCHAR(200)` | List snippet |

`plain_text` is never accepted from a client, or search drifts from content.

### 3.3 Storage in the browser

The browser reads the API directly; there is no local copy of the notes. IndexedDB
holds only the **draft buffer** — the in-progress document, written on every change so
a crash or reload never loses typing.

### 3.4 Saving and conflicts

Every body save carries the note's `version`. **Metadata writes carry no version** and
therefore can never conflict.

A 409 means the note was saved elsewhere — another tab, another browser, or an AI
assistant through the MCP server. The edit is **never discarded**; the conflict sheet
offers:

| Choice | Result |
|---|---|
| **Save mine as a copy** ← default | A new note holds your text; the original keeps theirs. Nothing is lost |
| Keep mine | Resends at the current version |
| Keep theirs | The edit is discarded and the server copy is shown |

Deliberately **not CRDTs**: Yjs would eliminate conflicts but replaces readable JSON
with binary blobs, needs compaction, makes server-side search and debugging much
harder, and deletes the version model — to solve conflicts a single user hits rarely.

**A note trashed elsewhere while it is being edited:** the server **rejects a body write
to a trashed note with 409**, and the user is asked *"This note was moved to Trash —
restore it, or discard your changes?"* **Restore and keep mine** restores the note,
then saves the body over the server version. **Discard my changes** drops the draft and
closes the tab; the note stays in Trash.

### 3.5 Search

MySQL `MATCH … AGAINST` in boolean mode with a trailing wildcard. MySQL's
`innodb_ft_min_token_size` is 3, so terms under three characters are rejected by the
request layer and the UI says *"Type at least 3 characters"* rather than returning an
empty list that reads as "you have no notes".

### 3.6 New note lifecycle

Create immediately, discard silently if abandoned. The client mints the note's UUID, so
it can show the note before the server answers. `POST /notes` is **idempotent** — a
retried create returns the existing note rather than a twin.

If a note is still empty and untouched when it loses focus, it is hard-deleted with no
toast and no confirmation. A nightly job sweeps the ones a crash left behind.

### 3.7 Tabs

Wide screens only, persisted to `localStorage` in that browser. Window state, not user
data.

### 3.8 MCP server

`/mcp` serves the notes tools over Streamable HTTP to clients holding a personal access
token. Each tool checks the scope it needs. The tools call the same services and
policies as the REST API. Bodies are exchanged as markdown, with formatting markdown
can't express kept as inline HTML. No tool deletes anything, and notes in the Trash are
invisible to it.

---

## 4 · Data model

```sql
users(id, uuid, name, email UNIQUE, password, preferences JSON, timestamps)

folders(id, uuid, user_id, parent_id DEFAULT 0, name, color, position, timestamps)
  UNIQUE(user_id, parent_id, name)        -- parent_id 0 is the root sentinel: MySQL
                                          -- treats every NULL as distinct
tags(id, uuid, user_id, name, slug, timestamps)
  UNIQUE(user_id, slug)

notes(id, uuid CHAR(36) UNIQUE, user_id, folder_id,
      title, title_locked, body JSON, plain_text LONGTEXT, excerpt,
      is_starred, version, word_count, deleted_at, timestamps)
  KEY(user_id, deleted_at, updated_at)    KEY(user_id, folder_id, deleted_at)
  KEY(user_id, is_starred, deleted_at)
  FULLTEXT ft_notes(title, plain_text)

note_tag(note_id, tag_id, PRIMARY KEY(note_id, tag_id), KEY(tag_id))
note_versions(id, note_id, body JSON, version, created_at)
personal_access_tokens(…Sanctum…, type, abilities, expires_at)
```

**MySQL specifics that bite:** `JSON` columns cannot have a `DEFAULT`, so `body` is
nullable and the app writes an empty document. `FULLTEXT` accepts only text columns,
so it cannot include `user_id` — the optimiser filters after matching.

Sidebar counts are **two grouped queries**, never one per folder.

---

## 5 · API

Base `/api/v1`. Everything except auth sits behind `auth:sanctum` and a policy scoping
each record to the authenticated user. **Never accept `user_id` from a client.**

### Auth

| Method | Path | Notes |
|---|---|---|
| GET | `/sanctum/csrf-cookie` | Primes the CSRF cookie |
| POST | `/register` · `/login` · `/logout` | Cookie session. Register and login throttled 5/min per IP |
| POST | `/forgot-password` · `/reset-password` | Throttled 5/min per IP. A reset revokes every token |
| GET / PATCH | `/me` · `/me/password` | A password change revokes every token; the browser stays signed in |
| GET / POST / DELETE | `/me/access-tokens` | Personal access tokens for MCP clients |

### Bootstrap, notes, folders, tags

`GET /bootstrap`; `GET|POST /notes`, `GET|PATCH|DELETE /notes/{uuid}`,
`/notes/{uuid}/restore|duplicate|tags`, `DELETE /trash`; CRUD for `/folders` and
`/tags`; `PATCH /preferences`; `GET /search`.

Deleting a folder never deletes notes: its notes move to the root and its child folders
move to its parent. A child whose name is already taken there gets a " (2)" style suffix.

A missing record, or one belonging to another user, is a plain **404** `{ message: "Not found." }`
that never names the model or echoes the id.

`PATCH /notes/{uuid}` checks `version` **only when the payload contains `body`**, and
returns **409** with the server copy on a mismatch. It also returns **409** for a body
write to a trashed note.

---

## 6 · UI

### Layout

Three panes on wide screens — sidebar, note list, editor — collapsing to two with a
drawer at 768–1099px and to a single-pane stack below 768px. The document fills the
full editor width. The sidebar toggle sits at the far left. The header's right side
holds only the theme toggle and the avatar; the avatar menu has **Profile**,
**Access tokens** and **Sign out**.

### Sidebar

```
＋ New note

   All notes · Starred
   FOLDERS   Work · Releases · Personal
   TAGS      #todo #draft
   🗑 Trash
```

Folders use a **folder icon tinted with their colour**, under a FOLDERS label — a bare
coloured dot does not read as a folder.

### Two search controls, deliberately distinct

| | ⌘K Spotlight | List filter |
|---|---|---|
| Icon | Magnifier | **Funnel** |
| Scope | Every note | The visible list only |
| Result | Jumps to a note | Narrows in place |
| Placeholder | "Search all notes…" | "**Filter in Work**" — names the scope |

The filter is **hybrid**: instant on loaded rows, with a background scoped query when
the scope has more pages. Filtering only loaded rows silently hides notes. It clears
when the scope changes.

### Editor

The full `@mantine/tiptap` control set — marks, H1–H4, colour, lists, task lists,
sub/superscript, link, image, table, code block, details, alignment, history,
invisible characters. **Table controls live in a contextual bar** shown only while the
cursor is inside a table. BubbleMenu on wide screens only — it collides with iOS
Safari's selection handles.

### Status bar

```
● Saved just now   Selected 10 words · 43 characters │ 148 words · 892 characters   Work / Releases
```

Characters include spaces; words are whitespace-separated tokens. The selection
segment appears only when there is a selection. Totals come from TipTap's
`CharacterCount`; the selection is measured from the ProseMirror range, not the DOM.

### Loading rules

**Never a full-screen loader** for data. Skeletons shaped like the real layout on first
paint; skeleton rows in the list pane only when switching scope; a spinner inside the
button for button actions; a 2px top bar for anything else; **nothing at all** for
autosave and prefetch. **Every loader is delayed 250 ms** so fast requests show
nothing. Mutations get optimistic updates, not spinners. Stale results stay visible and
dimmed rather than vanishing.

### Saving

No spinner. The status bar is the indicator, with a 400 ms minimum display for
"Saving…" so it cannot strobe. Typing is never blocked. ⌘S is the exception — an
explicit save earns an explicit acknowledgement. Failure is loud and keeps the draft;
success is quiet.

### Responsive

≥1100px three panes · 768–1099px two panes with a drawer · ≤767px one pane with back
navigation, no tabs, a bottom scrollable toolbar, dropdowns as bottom sheets, 16px
inputs, `env(safe-area-inset-*)`, `100dvh`, and touch targets ≥44px.

---

## 7 · Acceptance criteria

**Accounts and auth**

1. Register, sign in, reload — still signed in.
2. Sign out — back on the sign-in page, with no open tabs or drafts left behind.

**Editing**

3. Create a note, type, wait a second, reload — the content is there.
4. Highlight, colour, subscript and alignment survive a save and reload.
5. Every toolbar control works; a table can be created, edited and deleted.
6. The status bar shows words and characters; selecting text adds the selection counts.

**Saving and conflicts**

7. Edit the same note in two tabs — the second save shows the conflict sheet;
   "Save mine as a copy" loses nothing.
8. Trash a note in one tab while editing it in another — the editor is asked to
   restore or discard.
9. Star a note while an autosave is in flight — no 409.
10. Lose the network mid-type — the status bar shows the failure, and the draft survives
    a reload.
11. A retried create does not duplicate the note.

**Search**

12. ⌘K finds a note by a word in its body; a term under three characters shows
    *"Type at least 3 characters"*.

**Access tokens and MCP**

13. A read-only token can search and read through `/mcp`, and a write tool returns an
    error naming the missing scope.
14. No token can delete, trash or restore anything, or reach the account routes.

**Web**

15. At 390px all three panes are reachable, with no horizontal page scroll and no zoom
    on input focus.
16. Both themes render every surface correctly.
