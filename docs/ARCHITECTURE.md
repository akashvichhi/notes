# Notes — Architecture

**Date:** 2026-10-11 · **Status:** design, pending approval

A cross-platform notes application. One React codebase ships as a web app and as
native apps for Windows, macOS, Linux, Android and iOS. Notes live in one of two
containers: **Cloud**, synced to the user's account across every device, or
**On This Device**, which never leaves the machine.

---

## 1 · The two containers

Modelled on Apple Notes' accounts. Each container is a **complete, independent world** —
its own folders, its own tags, its own Trash. Nothing is shared between them except
search, which spans both.

| | **Cloud** | **On This Device** |
|---|---|---|
| Where the data lives | MySQL, on the server | SQLite, on the machine |
| Visible on other devices | Yes | **No** |
| Works offline | **Yes** — cached and editable | Yes — it is always local |
| Survives uninstall | Yes | **No** |
| Survives disk loss | Yes | **No** |
| Needs an account | Yes | **No** |
| Can conflict | Yes — resolved by the user | Never — it exists in one place |
| Exists in the browser build | Yes | No |

**Cloud notes work offline.** They are cached locally, fully editable with no network,
and reconciled on reconnect. The container choice is about *where data lives and
whether it leaves the machine*, not about connectivity.

**The app works with no account.** Install it, write in **On This Device**, never sign
up. Signing in adds the Cloud container; it does not gate the app.

**New notes default to Cloud** when signed in, **On This Device** when not.

### Warning the user about uninstall

Local notes are the only copy, so the app says so in four places:

1. A one-time dismissible callout the first time a note lands in **On This Device**,
   with a **Move to Cloud** button in it.
2. Permanent helper text under the sidebar section: *Not backed up · stays on this computer*.
3. The status bar, whenever a local note is open: *On this device — not backed up*.
4. A confirmation when moving a note Cloud → On This Device: *"This note will stop
   syncing and will disappear from your other devices."*

No platform offers a reliable uninstall hook, so the warning has to land while the
data still matters.

---

## 2 · System architecture

```
┌──────────────────────── ONE REACT CODEBASE ────────────────────────┐
│  React 19 · TypeScript · Mantine 9 · TipTap 3 · TanStack Query     │
└────────────────────────────────┬───────────────────────────────────┘
                                 │  built three ways
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   ┌───────────┐         ┌──────────────┐        ┌──────────────┐
   │  BROWSER  │         │ TAURI DESKTOP│        │ TAURI MOBILE │
   │           │         │ Win·mac·Linux│        │ Android · iOS│
   │ Cloud only│         │ both         │        │ both         │
   │ online    │         │ containers   │        │ containers   │
   │ cookies   │         │ Bearer token │        │ Bearer token │
   └─────┬─────┘         └──────┬───────┘        └──────┬───────┘
         │                      │ SQLite                │ SQLite
         │                      │ (local store)         │
         └──────────────┬───────┴───────────────────────┘
                        ▼  HTTPS / JSON
              ┌──────────────────────┐
              │   LARAVEL 12 API     │
              │   Sanctum dual auth  │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │      MySQL 8.4       │
              │  cloud notes only    │
              └──────────────────────┘
```

**Local notes never appear in this diagram below the device line.** The server has no
table for them and no knowledge they exist.

### Read path

| Build | Where the UI reads from |
|---|---|
| Native | **Always SQLite.** The sync engine fills it in the background |
| Browser | The API directly |

Native is **local-first**: the UI never waits on the network, and offline is not a
special case. This is the single most important architectural decision here — the
alternative, network-when-online and cache-when-offline, means two data paths and a
class of bugs that only appear on a train.

---

## 3 · How data is saved locally

### Native apps — SQLite

A single database file, holding **both containers**, in the OS application-data
directory:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\com.notesapp\notes.db` |
| macOS | `~/Library/Application Support/com.notesapp/notes.db` |
| Linux | `~/.local/share/com.notesapp/notes.db` |
| Android / iOS | the app's private sandbox |

Included in Time Machine and File History automatically. Deleted when the app is
uninstalled — which is exactly why the warnings above exist.

**Why SQLite rather than IndexedDB:** for local notes this file is the *only copy*.
IndexedDB can be evicted by the browser engine under storage pressure, and eviction
would be real data loss. SQLite is a real file the OS backs up. It also gives
**FTS5 full-text search offline**, which no browser store can.

```sql
notes(
  uuid            TEXT PRIMARY KEY,         -- UUIDv7, minted client-side
  container       TEXT NOT NULL,            -- 'cloud' | 'local'
  folder_uuid     TEXT, title TEXT, body TEXT,   -- body = ProseMirror JSON
  plain_text      TEXT, excerpt TEXT,
  is_starred      INTEGER DEFAULT 0, word_count INTEGER DEFAULT 0,
  deleted_at      TEXT,                     -- local trash
  updated_at      TEXT NOT NULL,
  -- sync bookkeeping; NULL for container='local'
  server_version  INTEGER,                  -- last version the server confirmed
  server_revision INTEGER,                  -- account revision this row arrived at
  dirty           INTEGER DEFAULT 0         -- has unpushed local changes
)

folders(uuid, container, parent_uuid, name, color, position, deleted_at, dirty, server_revision)
tags(uuid, container, name, slug, deleted_at, dirty, server_revision)
note_tag(note_uuid, tag_uuid)

outbox(id INTEGER PRIMARY KEY, kind, note_uuid, payload, created_at)
meta(key PRIMARY KEY, value)                -- last_revision, account_uuid, schema_version
notes_fts                                   -- FTS5 over title + plain_text
```

`container = 'local'` rows are never read by the sync engine. The column is the whole
isolation mechanism.

### Browser build

No local database. Reads go to the API. IndexedDB holds only the **draft buffer** —
the in-progress document, written on every keystroke so a crash or reload never loses
typing. The browser build has no **On This Device** container and says so.

### Transient storage, everywhere

| Store | Holds | Survives |
|---|---|---|
| IndexedDB | Draft buffer (crash protection) | Reload, crash |
| OS secure store | The auth token | Restart |
| `localStorage` | Open tabs, pane sizes, theme | Reload |

The **auth token never touches `localStorage`.** It lives in the OS keychain —
Credential Manager on Windows, Keychain on macOS and iOS, libsecret on Linux,
Keystore on Android.

---

## 4 · How data is saved in the cloud

MySQL 8.4, as already specced, plus three additions for sync. **There is no
`container` column server-side** — the server only ever holds cloud notes.

```sql
-- existing, unchanged
notes(id, uuid, user_id, folder_id, title, title_locked, body JSON,
      plain_text LONGTEXT, excerpt, is_starred, version, word_count,
      deleted_at, created_at, updated_at,
      FULLTEXT ft_notes(title, plain_text))
folders(...)  tags(...)  note_tag(...)  note_versions(...)

-- NEW: a monotonic counter per account
user_sync_counters(user_id PK, last_revision BIGINT)

-- NEW: every syncable row carries the revision it was last written at
ALTER TABLE notes   ADD revision BIGINT, ADD INDEX (user_id, revision);
ALTER TABLE folders ADD revision BIGINT, ADD INDEX (user_id, revision);
ALTER TABLE tags    ADD revision BIGINT, ADD INDEX (user_id, revision);

-- NEW: hard deletes must still be discoverable by offline devices
tombstones(id, user_id, entity_type, uuid, revision, created_at,
           INDEX (user_id, revision))
```

**Why a revision counter and not `updated_at`.** Syncing on a timestamp fails subtly:
server clock adjustments, two rows written in the same millisecond, rows modified
*during* a sync window. You lose a note and never learn why. A per-account counter
bumped inside the write transaction is monotonic, cheap at a single user's write
volume, and removes the whole class.

**Why tombstones.** If a laptop deletes a note while a phone is offline, the phone must
learn about the deletion — otherwise it keeps a ghost copy and, worse, its queued edit
*resurrects* the note. Soft deletes are covered by the normal row sync; hard deletes
(empty trash, the 30-day purge, discarding an abandoned empty note) need a tombstone
row. **Tombstones are retained longer than the trash purge window**, and a client
asking for a revision older than the oldest tombstone is told to do a full resync.

---

## 5 · The sync protocol

Only **Cloud** notes sync. Only **two** endpoints are new.

### Push — reuses the existing REST API

The outbox replays through the endpoints already specced and tested:
`POST /notes` (idempotent, client UUID), `PATCH /notes/{uuid}`,
`PUT /notes/{uuid}/tags`, `DELETE /notes/{uuid}`. One operation at a time, in order —
a create must land before the edits that follow it.

**Body writes coalesce by note.** The outbox keeps only the most recent body per note,
so twenty minutes of offline typing replays as a single `PATCH`. **Metadata writes
carry no version** and therefore can never conflict.

### Pull — one new endpoint

```
GET /api/v1/sync?since=<revision>&limit=200
→ {
    revision: 1842,                    // the client's new high-water mark
    notes:    [ …full rows… ],
    folders:  [ … ], tags: [ … ],
    deletions:[ {type:'note', uuid:'…'} ],
    has_more: false
  }
```

Paginated by revision, so a first sync on a new device streams in pages with a
progress state rather than appearing frozen.

### Order of operations

**Push first, then pull.** Each push either lands or returns 409; the server, which
holds the truth, is what detects conflicts. Pulling first would mean reconciling
locally against changes not yet pushed — which is how people end up writing merge
engines.

### Conflict resolution

A 409 means another device changed that note while this one was away.

```
PATCH {body, version: 7}  →  server is at 9  →  409 + server copy
```

The local edit is **not discarded**. It goes into a conflict queue, surfaced as a
banner — *"3 notes need your attention"* — resolved one at a time, never as a stack of
modals. Three choices:

| Choice | Result |
|---|---|
| **Save mine as a copy** ← default | A new note holds your text; the original keeps theirs. **Nothing is lost** |
| Keep mine | Resends at the current version. The replaced body is written to `note_versions`, so it stays recoverable |
| Keep theirs | Local edit discarded; the server copy is adopted |

This is **document-level sync with conflict copies** — the model Dropbox and Obsidian
Sync ship. Deliberately *not* CRDTs: Yjs would eliminate conflicts automatically, but
it replaces readable JSON with binary blobs, needs a compaction job, makes
server-side search and debugging much harder, and deletes the version model entirely —
to solve conflicts that one person across several devices hits rarely. Revisit only if
real-time collaboration becomes a goal.

**Block-level auto-merge** (OneNote's model — merge silently when different paragraphs
changed, prompt only on the same one) is the planned next step, after real conflict
rates are observable.

### One case needing a server rule

A note trashed on device A while device B edits it offline. The server **rejects a body
write to a trashed note with 409**, and B is asked: *"This note was moved to Trash on
another device — restore it, or discard your changes?"* Without the rule, B's edit
lands silently on a trashed note nobody looks at.

### When sync runs

App launch · network regained · after any local write (debounced) · every few minutes
while the window is focused. Not while the app is closed.

---

## 6 · Authentication

A packaged app loads from `tauri://localhost`, a different origin from the API, so
SameSite cookies are never sent. Two mechanisms run side by side on the same routes —
exactly what Sanctum is designed for.

| Client | Mechanism | Credential stored in |
|---|---|---|
| Browser | Stateful session cookie | httpOnly cookie |
| Native apps | **Bearer token** | **OS keychain** |

New endpoints: `POST /api/v1/tokens` (email + password + device name → token, shown
once) and `DELETE /api/v1/tokens/current`. Both rate-limited.

**Signing out wipes every cloud row from the local database**, clears the token and
leaves the **On This Device** container untouched. Signing in as a different account
wipes cloud rows first.

---

## 7 · Technology stack

### Cross-platform shell

| Technology | Role |
|---|---|
| **Tauri 2** | One project → Windows, macOS, Linux (Phase 3); Android and iOS (Phase 4) |
| **Rust** (rustup, cargo) | Tauri's core. Required to build; no app code is written in it |
| **tauri-plugin-sql** | SQLite access from the webview |
| WebView2 / WKWebView / WebKitGTK / Android WebView | The renderer on each platform |

### Frontend — one codebase for every target

| Technology | Version | Role |
|---|---|---|
| React | 19.3 | UI |
| TypeScript | 7, strict | Types |
| Vite | 8.3 | Build and dev server |
| Mantine | 9.7.1 | Components — core, hooks, spotlight, notifications, modals, form |
| TipTap | 3.31.4 | Rich-text editor (ProseMirror) |
| @mantine/tiptap | 9.7.1 | Editor toolbar |
| TanStack Query | 5.104 | Server state, optimistic updates |
| Zustand | 5.0 | UI state — tabs, panes, container |
| React Router | 8.4 | Routing |
| axios | 1.20 | HTTP |
| idb-keyval | 6.2 | IndexedDB draft buffer |
| uuid | 14 | UUIDv7 for client-minted ids |
| Tabler Icons | 3.49 | Icons |
| dayjs | 1.11 | Dates |

### Backend

| Technology | Version | Role |
|---|---|---|
| PHP | 8.3 | Runtime |
| Laravel | 12, API-only | The API |
| Laravel Sanctum | — | Cookies for the browser, Bearer tokens for native |
| MySQL | 8.4 | Cloud storage, `FULLTEXT` search |

### Testing

Pest (api) · Vitest + Testing Library (web units) · Playwright (end-to-end,
including offline and sync scenarios).

### Build and distribution

| Technology | Role |
|---|---|
| Docker + Compose | Local PHP and MySQL |
| Node 20+ | Frontend tooling, on the host |
| GitHub Actions | CI, with **macOS runners** for Apple builds |
| Tauri updater | Desktop auto-update, with its own signing keypair |
| Apple Developer | $99/yr — macOS notarization, iOS |
| Windows code-signing cert | ~$200–400/yr, or SmartScreen warns on every install |
| Google Play Console | $25 once, for Phase 4 |

### Removed from the previous design

`vite-plugin-pwa`, `workbox-window`, the service worker, precache configuration and the
generated web manifest. The native shell replaces install-to-home-screen; Tauri's
updater replaces the service-worker update prompt.

---

## 8 · What changes from the current plan

**Unchanged — most of the work.** The whole editor, the responsive layout, the UI
components, the api's controller/service/query layering, every existing endpoint,
the MySQL schema as it stands, and the brand assets.

**Added.** A `container` concept in the sidebar and note model · the SQLite local store
and its migrations · the sync engine (outbox, pull, conflict queue) · revision counter
and tombstones on the api · the pull endpoint · token auth on both sides · the
Tauri shell, updater and CI matrix · move-between-containers · the uninstall warnings ·
merged search across containers.

**Removed.** The four PWA tasks.

**Phased.** Desktop (Windows, macOS, Linux) first. Android and iOS follow on the same
Tauri project, reusing the responsive layout already built.

---

## 9 · Deliberately deferred

Block-level auto-merge · CRDT/real-time collaboration · background sync while closed ·
sharing notes between accounts · attachments · end-to-end encryption · import/export ·
a settings screen.
