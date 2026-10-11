# Notes App — Design Specification

**Date:** 2026-10-11 · **Status:** approved, ready for implementation
**Supersedes:** the PWA specification of 2026-10-09

A cross-platform notes application in the spirit of Apple Notes. One React codebase
ships as a web app and as native apps; a Laravel API on MySQL is the cloud backend.
Notes live in one of two containers — **Cloud**, synced across every device, or
**On This Device**, which never leaves the machine.

---

## 1 · Scope

### Phase 1

Two containers · multi-user accounts · notes CRUD · nested folders · tags · star ·
trash with 30-day purge · rich-text editing with the full toolbar · autosave with
conflict detection · offline editing on native · cloud sync · global search · scoped
list filter · editor tabs on desktop · light/dark · full responsive behaviour ·
**Windows, macOS and Linux desktop apps** · the web app.

### Phase 2

Android and iOS, on the same Tauri project, reusing the responsive layout.

### Explicitly deferred

| Deferred | Why |
|---|---|
| Import / export | Dropped by the product owner |
| Settings screen | Only theme is touched daily, and it is a header button |
| Version history UI | `note_versions` is written on conflict resolution; nothing surfaces it yet |
| Attachments | Needs storage, signed URLs, an upload pipeline and sync of binaries |
| Block-level auto-merge | Planned after real conflict rates are observable |
| Sharing, real-time collaboration | Conflict detection by version is the Phase-1 answer |
| End-to-end encryption | Server-side search requires readable text |
| Background sync while closed | Restricted on mobile, not worth the platform work |

### Non-goals

A Progressive Web App. React Native or Flutter. Markdown as the typing surface.

---

## 2 · Platforms and builds

One `frontend/` source tree, built three ways.

| Build | Targets | Containers | Offline | Auth |
|---|---|---|---|---|
| **Web** | Any browser | Cloud only | No | Session cookie |
| **Desktop** | Windows, macOS, Linux | Both | Yes | Bearer token |
| **Mobile** (phase 2) | Android, iOS | Both | Yes | Bearer token |

---

## 3 · Stack

### Shell

| | Version | Role |
|---|---|---|
| **Tauri** | 2.x | One project for every native target; ~5–15 MB installers |
| **Rust** | stable | Tauri's core; required to build, no app code written in it |
| **tauri-plugin-sql** | 2.x | SQLite from the webview |
| **tauri-plugin-store** / keychain | 2.x | Token storage in the OS secure store |

Renderers: WebView2 (Windows), WKWebView (macOS, iOS), WebKitGTK (Linux),
Android System WebView.

### Frontend

| Package | Version |
|---|---|
| `react`, `react-dom` | 19.3.0 |
| `vite` | 8.3.4 |
| `typescript` | 7.0.2, strict |
| `@mantine/*` — core, hooks, tiptap, spotlight, notifications, modals, form | 9.7.1 |
| `@tiptap/*` — react, starter-kit and the MIT extension set | 3.31.4 |
| `@tanstack/react-query` | 5.104.1 |
| `zustand` | 5.0.15 |
| `react-router` | 8.4.0 |
| `axios` | 1.20.0 |
| `@tabler/icons-react` | 3.49.0 |
| `idb-keyval` | 6.2.2 |
| `uuid` | 14.0.2 |
| `dayjs` | 1.11.23 |

No TipTap Pro, no CKEditor. Every extension used is MIT.

### Backend

PHP 8.3 · Laravel 12, API-only · Laravel Sanctum · **MySQL 8.0+ only**, InnoDB,
`utf8mb4` / `utf8mb4_0900_ai_ci`.

### Testing

Pest · Vitest + Testing Library · Playwright.

---

## 4 · The two containers

Each container is a **complete, independent world**: its own folders, its own tags,
its own Trash. Nothing is shared except search, which spans both.

| | **Cloud** | **On This Device** |
|---|---|---|
| Stored in | MySQL, on the server | SQLite, on the machine |
| Visible on other devices | Yes | **No** |
| Works offline | **Yes** — cached and editable | Yes |
| Survives uninstall | Yes | **No** |
| Needs an account | Yes | **No** |
| Can conflict | Yes | Never — one device by definition |
| Exists in the web build | Yes | No |

**The app works with no account.** Install, write in On This Device, never sign up.
Signing in adds the Cloud container; it does not gate the app.

**New notes default to Cloud** when signed in, **On This Device** when not.

**Moving between containers** is available from the note menu. Cloud → local warns
that the note stops syncing and disappears from other devices. Local → cloud uploads
it, keeping the same UUID.

### Warning about uninstall

Local notes are the only copy, so the app says so in four places:

1. A one-time dismissible callout the first time a note lands in On This Device, with
   a **Move to Cloud** button in it.
2. Permanent helper text under the sidebar section: *Not backed up · stays on this computer*.
3. The status bar, whenever a local note is open: *On this device — not backed up*.
4. A confirmation when moving Cloud → On This Device.

**The icon and the noun follow the hardware.** The container is always *named*
"On This Device" — it is a data concept and must read the same everywhere — but the
icon beside it and the noun in the helper text come from `platform()`:

| Platform | Icon | Helper text |
|---|---|---|
| Windows, macOS, Linux | laptop | *Not backed up · stays on this computer* |
| Android phone, iPhone | phone | *Not backed up · stays on this phone* |
| iPad, Android tablet | tablet | *Not backed up · stays on this tablet* |

The same noun is used in the status bar (*On this phone — not backed up*) and in the
move-to-local confirmation. A laptop icon on a phone undermines the one message this
container has to land.

No platform offers a reliable uninstall hook, so the warning lands while the data
still matters.

---

## 5 · Architecture decisions

### 5.1 Authentication — two mechanisms, one guard

A packaged app loads from `tauri://localhost`, a different origin from the API, so
SameSite cookies are never sent and there is no CSRF handshake. Sanctum runs both
mechanisms on the same `auth:sanctum` routes.

| Client | Mechanism | Credential stored in |
|---|---|---|
| Browser | Stateful session cookie | httpOnly cookie, `SameSite=Lax` |
| Native | **Bearer token** | **OS secure store** — Credential Manager, Keychain, libsecret, Keystore |

**The token never touches `localStorage`.** Web config is unchanged from before:
`statefulApi()` middleware, `SANCTUM_STATEFUL_DOMAINS`, `supports_credentials`, and
axios with **both** `withCredentials` and `withXSRFToken`.

Signing out revokes the token, wipes every Cloud row from SQLite, and **leaves
On This Device untouched**. Signing in as a different account wipes Cloud rows first.

### 5.2 Note body — ProseMirror JSON

The toolbar exposes highlight, text colour, subscript/superscript and text-align.
None can be represented in GFM markdown, so markdown cannot be canonical.

| Column | Type | Role |
|---|---|---|
| `body` | `JSON` | Canonical ProseMirror document |
| `plain_text` | `LONGTEXT` | **Derived server-side**; feeds `FULLTEXT` |
| `excerpt` | `VARCHAR(200)` | List snippet |

`plain_text` is never accepted from a client, or search drifts from content.

### 5.3 Local storage — SQLite, local-first

On native the UI **always reads SQLite**; the sync engine fills it in the background.
Offline is therefore not a special case, and there is one data path rather than two.

**Why not IndexedDB:** for On This Device notes the local file is the *only copy*, and
IndexedDB can be evicted under storage pressure. SQLite is a real file the OS backs
up, and FTS5 gives offline full-text search.

IndexedDB is still used, for the **draft buffer only** — the in-progress document,
written on every keystroke so a crash never loses typing.

The web build has no local database and reads the API directly.

### 5.4 Sync — document-level, with conflict copies

Only Cloud notes sync.

**Push reuses the existing REST endpoints.** The outbox replays `POST /notes`,
`PATCH /notes/{uuid}`, `PUT /notes/{uuid}/tags` and `DELETE /notes/{uuid}`, one
operation at a time in order — a create must land before the edits that follow it.

**Body writes coalesce by note:** the outbox keeps only the most recent body per note,
so twenty minutes offline replays as one `PATCH`. **Metadata writes carry no version**
and therefore can never conflict.

**Pull is one new endpoint**, paginated by revision.

**Push before pull.** The server holds the truth and detects conflicts; pulling first
would mean reconciling locally against unpushed changes.

**A per-account revision counter, not `updated_at`.** Timestamps lose notes to clock
adjustment, same-millisecond writes and rows modified during a sync window.

**Tombstones for hard deletes.** Without them an offline device keeps a ghost copy and
its queued edit resurrects the note. **Tombstones are retained longer than the 30-day
trash purge**; a client asking for a revision older than the oldest tombstone is told
to do a full resync.

**Conflict resolution** is per note, queued and surfaced as a banner — *"3 notes need
your attention"* — never a stack of modals.

| Choice | Result |
|---|---|
| **Save mine as a copy** ← default | A new note holds your text; the original keeps theirs. Nothing is lost |
| Keep mine | Resends at the current version. The replaced body is written to `note_versions` |
| Keep theirs | Local edit discarded |

Deliberately **not CRDTs**: Yjs would eliminate conflicts but replaces readable JSON
with binary blobs, needs compaction, makes server-side search and debugging much
harder, and deletes the version model — to solve conflicts a single user hits rarely.

**Sync runs** on app launch, when the network returns, after a local write (debounced),
and every few minutes while the window is focused. Never while the app is closed.

### 5.5 One server rule the sync model needs

A note trashed on device A while device B edits it offline: the server **rejects a body
write to a trashed note with 409**, and B is asked *"This note was moved to Trash on
another device — restore it, or discard your changes?"* Without the rule, B's edit
lands silently on a trashed note.

### 5.6 Search

| Source | Mechanism |
|---|---|
| Cloud, online | MySQL `MATCH … AGAINST` in boolean mode with a trailing wildcard |
| Cloud, offline | SQLite FTS5 over the local mirror |
| On This Device | SQLite FTS5 |

Results from both containers merge, each tagged with its container. MySQL's
`innodb_ft_min_token_size` is 3, so terms under three characters are rejected by the
request layer and the UI says *"Type at least 3 characters"* rather than returning an
empty list that reads as "you have no notes".

### 5.7 New note lifecycle

Create immediately, discard silently if abandoned. The client mints a **UUIDv7**, so
the id exists before the server sees it and offline creates work. `POST /notes` is
**idempotent** — a replayed create returns the existing note rather than a twin.

If a note is still empty and untouched when it loses focus, it is hard-deleted with no
toast and no confirmation. A nightly job sweeps the ones a crash left behind.

### 5.8 Tabs

Desktop and tablet only, persisted to `localStorage` **per device**. Window state, not
user data.

---

## 6 · Data model

### 6.1 MySQL — cloud only

There is **no `container` column server-side**. The server holds only Cloud notes and
has no knowledge that local ones exist.

```sql
users(id, uuid, name, email UNIQUE, password, preferences JSON, timestamps)

folders(id, uuid, user_id, parent_id DEFAULT 0, name, color, position, revision, timestamps)
  UNIQUE(user_id, parent_id, name)        -- parent_id 0 is the root sentinel: MySQL
                                          -- treats every NULL as distinct
tags(id, uuid, user_id, name, slug, revision, timestamps)
  UNIQUE(user_id, slug)

notes(id, uuid CHAR(36) UNIQUE, user_id, folder_id,
      title, title_locked, body JSON, plain_text LONGTEXT, excerpt,
      is_starred, version, word_count, revision, deleted_at, timestamps)
  KEY(user_id, deleted_at, updated_at)    KEY(user_id, folder_id, deleted_at)
  KEY(user_id, is_starred, deleted_at)    KEY(user_id, revision)
  FULLTEXT ft_notes(title, plain_text)

note_tag(note_id, tag_id, PRIMARY KEY(note_id, tag_id), KEY(tag_id))
note_versions(id, note_id, body JSON, version, created_at)

user_sync_counters(user_id PRIMARY KEY, last_revision BIGINT)
tombstones(id, user_id, entity_type, uuid, revision, created_at, KEY(user_id, revision))
personal_access_tokens(…Sanctum…, name = the device name)
```

**MySQL specifics that bite:** `JSON` columns cannot have a `DEFAULT`, so `body` is
nullable and the app writes an empty document. `FULLTEXT` accepts only text columns,
so it cannot include `user_id` — the optimiser filters after matching.

Sidebar counts are **two grouped queries**, never one per folder.

### 6.2 SQLite — on device, both containers

One file in the OS application-data directory: `%APPDATA%\com.notesapp\notes.db`,
`~/Library/Application Support/com.notesapp/notes.db`,
`~/.local/share/com.notesapp/notes.db`, or the app sandbox on mobile.

```sql
notes(uuid PRIMARY KEY, container, folder_uuid, title, body, plain_text, excerpt,
      is_starred, word_count, deleted_at, updated_at,
      server_version, server_revision, dirty)
folders(uuid PRIMARY KEY, container, parent_uuid, name, color, position,
        deleted_at, dirty, server_revision)
tags(uuid PRIMARY KEY, container, name, slug, deleted_at, dirty, server_revision)
note_tag(note_uuid, tag_uuid, PRIMARY KEY(note_uuid, tag_uuid))
outbox(id INTEGER PRIMARY KEY AUTOINCREMENT, kind, note_uuid, payload, created_at)
meta(key PRIMARY KEY, value)              -- last_revision, account_uuid, schema_version
notes_fts                                 -- FTS5 over title + plain_text
```

`container = 'local'` rows are never read by the sync engine. **That column is the
entire isolation mechanism.** `server_version`, `server_revision` and `dirty` are NULL
or 0 for local rows.

---

## 7 · API

Base `/api/v1`. Everything except auth sits behind `auth:sanctum` and a policy scoping
each record to the authenticated user. **Never accept `user_id` from a client.**

### Auth

| Method | Path | Notes |
|---|---|---|
| GET | `/sanctum/csrf-cookie` | Web only |
| POST | `/register` · `/login` · `/logout` | Web, cookie session |
| POST | **`/tokens`** | **Native.** email + password + `device_name` → token, shown once. Throttled 5/min |
| DELETE | **`/tokens/current`** | **Native** sign-out |
| POST | `/forgot-password` · `/reset-password` | |
| GET / PATCH | `/me` · `/me/password` | |

### Bootstrap, notes, folders, tags

Unchanged from the previous specification: `GET /bootstrap`; `GET|POST /notes`,
`GET|PATCH|DELETE /notes/{uuid}`, `/notes/{uuid}/restore|duplicate|tags`,
`DELETE /trash`; CRUD for `/folders` and `/tags`; `PATCH /preferences`; `GET /search`.

`PATCH /notes/{uuid}` checks `version` **only when the payload contains `body`**, and
returns **409** with the server copy on a mismatch. It also returns **409** for a body
write to a trashed note.

### Sync — one new endpoint

```
GET /api/v1/sync?since=<revision>&limit=200
→ { revision, notes[], folders[], tags[], deletions[{type,uuid}], has_more }
```

`since=0` is a full sync. A `since` older than the oldest tombstone returns
`{ full_resync_required: true }`.

---

## 8 · UI

### Layout

Three panes on desktop — sidebar, note list, editor — collapsing to two with a drawer
at 768–1099px and to a single-pane stack below 768px. The document fills the full
editor width. The sidebar toggle sits at the far left. The header's right side holds
only the theme toggle and the avatar; the avatar menu has exactly **Profile** and
**Sign out**.

### Sidebar — two accounts

```
＋ New note

☁ CLOUD                        ● Synced
   All notes · Starred
   FOLDERS   Work · Releases · Personal
   TAGS      #todo #draft
   🗑 Trash

💻 ON THIS DEVICE
   Not backed up · stays on this computer
   All notes
   FOLDERS   Quick notes
   TAGS      #private
   🗑 Trash
```

Folders use a **folder icon tinted with their colour**, under a FOLDERS label — a bare
coloured dot does not read as a folder.

### Two search controls, deliberately distinct

| | ⌘K Spotlight | List filter |
|---|---|---|
| Icon | Magnifier | **Funnel** |
| Scope | Every note, both containers | The visible list only |
| Result | Jumps to a note | Narrows in place |
| Placeholder | "Search all notes…" | "**Filter in Work**" — names the scope |

The filter is **hybrid**: instant on loaded rows, with a background scoped query when
the scope has more pages. Filtering only loaded rows silently hides notes. It clears
when the scope changes.

### Editor

The full `@mantine/tiptap` control set — marks, H1–H4, colour, lists, task lists,
sub/superscript, link, image, table, code block, details, alignment, history,
invisible characters. **Table controls live in a contextual bar** shown only while the
cursor is inside a table. BubbleMenu on desktop only — it collides with iOS selection
handles.

### Status bar

```
● Synced just now   Selected 10 words · 43 characters │ 148 words · 892 characters   Cloud · Work / Releases
```

Characters include spaces; words are whitespace-separated tokens. The selection
segment appears only when there is a selection. Totals come from TipTap's
`CharacterCount`; the selection is measured from the ProseMirror range, not the DOM.

Sync states: `Synced just now` · `Syncing… 12 of 30` · `Offline — 3 changes pending` ·
`3 notes need your attention`. **Local notes show no sync state at all**, only
*On this device — not backed up*.

### Loading rules

**Never a full-screen loader.** Skeletons shaped like the real layout on first paint;
skeleton rows in the list pane only when switching scope; a spinner inside the button
for button actions; a 2px top bar for anything else; **nothing at all** for autosave
and prefetch. **Every loader is delayed 250 ms** so fast requests show nothing.
Mutations get optimistic updates, not spinners. Stale results stay visible and dimmed
rather than vanishing.

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

## 9 · Acceptance criteria

**Accounts and auth**

1. Register, sign in on the web, reload — still signed in.
2. Sign in on the desktop app; close and reopen it — still signed in, with the token
   in the OS secure store and **not** in `localStorage`.
3. Sign out on desktop: Cloud notes disappear from the app, On This Device notes remain.
4. Use the desktop app with **no account at all** — On This Device works fully.

**Editing**

5. Create a note, type, wait a second, reload — the content is there.
6. Highlight, colour, subscript and alignment survive a save and reload.
7. Every toolbar control works; a table can be created, edited and deleted.
8. The status bar shows words and characters; selecting text adds the selection counts.

**Containers**

9. A note created in On This Device never appears on a second device.
10. Moving a note Cloud → On This Device warns, then it disappears from the other device.
11. The first note placed in On This Device triggers the one-time callout.
12. Search returns results from both containers, each tagged with its container.

**Offline and sync**

13. Go offline on desktop: Cloud notes are still readable and editable.
14. Edit offline for several minutes, reconnect — exactly **one** `PATCH` per note.
15. Create a note offline, reconnect — it appears on the other device and is **not** duplicated.
16. Edit the same note offline on two devices, reconnect both — the second shows the
    conflict sheet; "Save mine as a copy" loses nothing.
17. Delete a note on device A while B is offline — it disappears on B after sync, and
    B's queued edit does not resurrect it.
18. Trash a note on A while B edits it offline — B is asked to restore or discard.
19. Star a note while an autosave is in flight — no 409.
20. A fresh device signs in and pulls everything, with visible progress.

**Platforms**

21. Installers build for Windows, macOS and Linux, and the app opens on each.
22. The Linux build renders the editor correctly on Ubuntu LTS.
23. At 390px all three panes are reachable, with no horizontal page scroll and no zoom
    on input focus.
24. Both themes render every surface correctly.
25. A new desktop release triggers the updater, and the app updates after a restart.
