# Notes App — Design Specification

**Date:** 2026-10-09
**Status:** Approved, ready for implementation

A multi-user notes web application in the spirit of macOS Notes, Windows Notepad and
GNOME Text Editor: multiple "files" in a three-pane workspace, edited in a rich-text
editor, usable on phone, tablet and desktop.

---

## 1. Product scope

### In scope (Phase 1)

Multi-user accounts · notes CRUD · nested folders · tags · star · trash with restore
and 30-day purge · rich-text editing with the full toolbar · autosave with conflict
detection · global search · scoped list filter · editor tabs (desktop) · light/dark
theme · full responsive behaviour across phone, tablet and desktop.

### Explicitly deferred

| Deferred | Why |
|---|---|
| Import / export (`.md`, `.zip`, PDF) | Dropped by the product owner; revisit when Settings exists |
| Settings dialog | Only theme is needed daily, and it is a header button |
| Version history | `note_versions` table is created, nothing surfaces it |
| Image attachments | Needs storage, signed URLs and an upload pipeline |
| Sharing, collaboration, realtime | Conflict detection by version number is the Phase-1 substitute |
| Background Sync API | Replay happens on an `online` event, not via the browser's background sync — it has patchy support and the app does not need to sync while closed |
| Push notifications | Nothing to notify about in a single-user notes app |
| Two-factor auth, sessions list | Not required for launch |

### Non-goals

Native apps. Markdown as the typing surface — users type rich text. Collaborative
editing. Syncing while the app is closed.

---

## 2. Stack (exact versions, verified 2026-10-09)

### Backend

| | |
|---|---|
| PHP | 8.3+ |
| Laravel | 12.x, **API-only** (`laravel new` then `php artisan install:api`) |
| Auth | **Laravel Sanctum, stateful cookie (SPA) mode** |
| Database | **MySQL 8.0+ only** — hard constraint. InnoDB, `utf8mb4` / `utf8mb4_0900_ai_ci` |
| Queue / scheduler | `database` driver |

### Frontend

| Package | Version |
|---|---|
| `react`, `react-dom` | 19.3.0 |
| `vite` | 8.3.4 |
| `typescript` | 7.0.2 (strict) |
| `@mantine/core` `@mantine/hooks` `@mantine/tiptap` `@mantine/spotlight` `@mantine/notifications` `@mantine/modals` `@mantine/form` | **9.7.1** |
| `@tiptap/react` `@tiptap/starter-kit` + extensions | 3.31.4 |
| `@tanstack/react-query` | 5.104.1 |
| `zustand` | 5.0.15 |
| `react-router` | 8.4.0 |
| `axios` | 1.20.0 |
| `@tabler/icons-react` | 3.49.0 |
| `dayjs` | 1.11.23 |

All TipTap extensions used are **MIT**. No TipTap Pro, no CKEditor licence.

---

## 3. Architecture decisions

### 3.1 Authentication — stateful session cookies

**Mechanism:** cookie-based stateful session auth ("Sanctum SPA authentication").
**Not** JWT. **Not** access/refresh tokens.

| Part | Detail |
|---|---|
| Credential | Opaque session ID — random, unsigned, not decodable |
| Transport | `laravel_session` cookie: `HttpOnly`, `Secure`, `SameSite=Lax` |
| Server state | Session row in MySQL (`SESSION_DRIVER=database`) |
| CSRF | Double-submit cookie: `XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header |
| Expiry | Sliding, 7 days of inactivity. No refresh call |
| Revocation | Delete the session row |

**Why not JWT:** one API and one frontend, so stateless verification buys nothing while
costing refresh rotation, reuse detection and a revocation denylist. A JS-readable token
plus an app that renders user-authored rich text is the combination that turns one
sanitiser gap into account takeover.

**Requirement:** the SPA and the API must share a registrable domain
(`notes.example.com` + `api.notes.example.com`). If hosting ever forces unrelated
domains, fix it with a reverse proxy rather than switching to tokens.

**Required config:**
- `bootstrap/app.php`: `->withMiddleware(fn (Middleware $m) => $m->statefulApi())`
  — an API-only app has no session middleware on the `api` group without this, and
  cookie auth silently fails.
- `SANCTUM_STATEFUL_DOMAINS` lists both hosts; `SESSION_DOMAIN=.example.com`
- `config/cors.php`: `supports_credentials => true`, explicit `allowed_origins`
- axios: `withCredentials: true` **and `withXSRFToken: true`** — axios ≥1.6 stopped
  attaching the XSRF header cross-origin without the second flag. Missing it produces
  419 on every write and looks like a CORS bug.

### 3.2 Note body storage — ProseMirror JSON

The toolbar exposes highlight, text colour, subscript/superscript and text-align.
**None of these can be represented in GFM markdown**, so markdown cannot be the
canonical format.

| Column | Type | Role |
|---|---|---|
| `body` | `JSON` | Canonical ProseMirror document. Validated by MySQL on write and by the ProseMirror schema on load |
| `plain_text` | `LONGTEXT` | **Derived server-side** by walking the JSON for text nodes. Feeds `FULLTEXT` search |
| `excerpt` | `VARCHAR(200)` | First ~140 chars of `plain_text`, for the list snippet |

`plain_text` is never accepted from the client — otherwise search drifts from content.

**Security:** ProseMirror's schema is a strict node whitelist and drops anything it does
not recognise. The server never emits HTML built from note content.

### 3.3 Search — MySQL FULLTEXT

```sql
WHERE user_id = ? AND deleted_at IS NULL
  AND MATCH(title, plain_text) AGAINST (? IN BOOLEAN MODE)
```

Known limits versus Postgres, and the mitigations:

| Limit | Mitigation |
|---|---|
| No stemming (`release` ≠ `releases`) | Boolean mode with a trailing wildcard: `releas*` |
| `innodb_ft_min_token_size = 3` | Queries under 3 chars are rejected by FormRequest; client shows "Type at least 3 characters" and sends nothing |
| Built-in stopword list | Accepted |
| No `ts_headline` highlighting | Snippets built in PHP; the API returns **plain text + matched terms**, and the client applies the `<mark>`. The server never emits HTML |
| `FULLTEXT` cannot include `user_id` | Optimiser uses the FT index then filters. Re-check at ~1M rows |

If quality becomes a complaint, Laravel Scout + Meilisearch drops in behind the same
endpoint. Not needed for Phase 1.

### 3.4 Identifiers

`BIGINT UNSIGNED AUTO_INCREMENT` primary keys plus a `uuid CHAR(36)` unique column,
which is what the API exposes. Random UUIDs as a clustered InnoDB primary key cause
page splits.

### 3.5 New note lifecycle

Create on the server immediately, discard silently if abandoned:

1. **New note** → `POST /notes` with an empty body in the current folder.
2. Tab and list row appear **optimistically** with a temporary client id; TanStack Query
   swaps in the real UUID on response.
3. When the note loses focus — tab closed, another note opened, window closed — if
   `plain_text` is empty **and** nothing else changed (no tag, folder, star), issue a
   **hard `DELETE ?force=1`**, not a trash. A blank untouched note was never a note.
4. A nightly job hard-deletes empty untouched notes older than 24 h, because laptops
   get closed.
5. If the create fails, the row stays visible in an error state with Retry and the text
   stays in IndexedDB. Never silently discard typing.

Rejected: keeping new notes client-side until the first keystroke. Tagging, moving,
starring, autosave, conflict detection and tab restore all need an id, so that approach
special-cases "note without id" across the whole app.

### 3.6 Autosave and conflict

- Debounce **800 ms** idle, plus flush on tab switch, blur, `beforeunload`, and
  **`visibilitychange`** (mobile browsers discard backgrounded tabs).
- Every keystroke also writes to an **IndexedDB draft buffer**. On open, a local draft
  newer than the server copy offers *Restore / Discard*.
- `PATCH /notes/{uuid}` sends `{body, version}`. A stale `version` returns **409** with
  the server's copy; the client shows a conflict sheet: *Keep mine / Keep theirs /
  Save mine as a copy*.
- **The version check applies only when the payload contains `body`.** Starring or
  moving a note must never 409 against an in-flight autosave.

### 3.7 Offline and PWA

The app is an **installable Progressive Web App that works offline**.

**What works with no network**

| | Offline |
|---|---|
| Open the app (including a deep link) | ✅ from the precached shell |
| Read notes, folders and tags you have opened or listed before | ✅ from the response cache |
| Edit an existing note | ✅ queued, replayed on reconnect |
| Create a note | ✅ the client mints the UUID |
| Star, rename, move, trash | ✅ queued |
| Search | ❌ `FULLTEXT` lives in MySQL. Falls back to filtering cached titles, labelled as such |
| Register, sign in, change password | ❌ requires the server |

**Three caching strategies, by what the resource is**

| Resource | Strategy | Why |
|---|---|---|
| App shell — HTML, JS, CSS, fonts, icons | **Precache**, served cache-first | It never changes between deploys; a new build precaches new files |
| `GET /bootstrap`, `/notes`, `/notes/{uuid}` | **Network-first**, fall back to cache | Fresh when online, readable when not |
| Everything else, and every non-GET | **Never cached** | Auth and writes must not be served from a cache |

**The offline write queue, and why it is tractable**

Naively replaying queued writes is a mess: each `PATCH` carries a `version`, so
replaying five offline edits means the first succeeds and the next four `409`.

Two properties make it simple here:

1. **Coalesce by note.** Autosave is already last-write-wins per note from one device,
   so the queue keeps only the **most recent** body per note UUID. Twenty minutes of
   offline typing replays as **one** `PATCH`, carrying the last version the client
   successfully saw.
2. **Metadata writes carry no version** (§3.6), so star, rename, move and trash can
   never conflict. Only body writes can, and there is at most one per note.

So the only possible conflict is "another device edited this note while you were
offline" — which is exactly the case the existing **conflict sheet** already handles.
No CRDTs, no merge engine.

**Creating notes offline** needs an id before the server can assign one, so the client
mints a **UUIDv7** and `POST /notes` accepts it. The endpoint is **idempotent**: a
replayed create with a UUID that already exists for that user returns the existing
note rather than duplicating it. Without this, a flaky reconnect produces twins.

**Replay** is triggered by the `online` event and on app start, one request at a time
in queue order, with the status bar showing `Offline — 3 changes queued`.

**Updates.** A new service worker takes over only after every tab is closed, so the
app must detect a waiting worker and prompt: *"A new version is available — Reload."*
Without this, users sit on stale JavaScript for days and bug reports become unfalsifiable.

**Security.** Cached API responses live in Cache Storage, which is origin-scoped but
survives sign-out. On logout the app **must** unregister the service worker, delete
every cache and clear IndexedDB — otherwise the next person on a shared device can
read the previous user's notes offline.

### 3.8 Tabs

Desktop and tablet only. **Persisted in `localStorage`, per device** — window state, not
user data. No endpoint. Hidden entirely on phones.

---

## 4. Data model (MySQL 8)

All tables InnoDB, `utf8mb4` / `utf8mb4_0900_ai_ci`.

```
users             id, uuid, name, email UNIQUE, password, preferences JSON NULL,
                  email_verified_at, remember_token, timestamps

folders           id, uuid, user_id FK, parent_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
                  name VARCHAR(120), color CHAR(7) NULL, position INT DEFAULT 0, timestamps
                  UNIQUE (user_id, parent_id, name)          -- parent_id 0 = root sentinel
                  KEY (user_id, parent_id)

tags              id, uuid, user_id FK, name VARCHAR(60), slug VARCHAR(60), timestamps
                  UNIQUE (user_id, slug)

notes             id, uuid CHAR(36) UNIQUE, user_id FK, folder_id FK NULL,
                  title VARCHAR(255) DEFAULT '', title_locked TINYINT(1) DEFAULT 0,
                  body JSON NULL, plain_text LONGTEXT NULL, excerpt VARCHAR(200) DEFAULT '',
                  is_starred TINYINT(1) DEFAULT 0, version INT UNSIGNED DEFAULT 1,
                  word_count INT UNSIGNED DEFAULT 0, deleted_at TIMESTAMP NULL, timestamps
                  KEY (user_id, deleted_at, updated_at)       -- list pane, default sort
                  KEY (user_id, folder_id, deleted_at)        -- folder scope + counts
                  KEY (user_id, is_starred, deleted_at)       -- Starred
                  FULLTEXT KEY ft_notes (title, plain_text)

note_tag          note_id, tag_id, PRIMARY KEY (note_id, tag_id), KEY (tag_id)

note_versions     id, note_id FK, body JSON, version INT, created_at
                  -- created in Phase 1, nothing writes to it yet
```

**MySQL gotchas that are easy to miss**

1. `JSON` columns **cannot have a `DEFAULT`**. `body` is nullable; the app writes an
   empty ProseMirror doc on create.
2. `UNIQUE (user_id, parent_id, name)` would **not** prevent duplicate root folders if
   `parent_id` were `NULL`, because MySQL treats each `NULL` as distinct. Hence the
   `parent_id = 0` sentinel, not `NULL`.
3. `FULLTEXT` indexes accept only `CHAR`/`VARCHAR`/`TEXT` columns.

**Sidebar counts are two grouped queries, never N queries:**

```sql
SELECT folder_id, COUNT(*) FROM notes
 WHERE user_id = ? AND deleted_at IS NULL GROUP BY folder_id;

SELECT nt.tag_id, COUNT(*) FROM note_tag nt JOIN notes n ON n.id = nt.note_id
 WHERE n.user_id = ? AND n.deleted_at IS NULL GROUP BY nt.tag_id;
```

---

## 5. API

Base path `/api/v1`. All routes except auth are behind `auth:sanctum` and a policy that
scopes every record to the authenticated user. **Never accept `user_id` from the client.**
Public identifiers are UUIDs.

### Auth

| Method | Path | Notes |
|---|---|---|
| GET | `/sanctum/csrf-cookie` | Primed once on app boot |
| POST | `/api/v1/register` | |
| POST | `/api/v1/login` | Throttled 5/min per email+IP, generic errors |
| POST | `/api/v1/logout` | |
| POST | `/api/v1/forgot-password` · `/reset-password` | |
| GET | `/api/v1/me` | User + preferences |
| PATCH | `/api/v1/me` | name, email |
| PUT | `/api/v1/me/password` | |

### Bootstrap

| GET | `/api/v1/bootstrap` |
|---|---|

Returns `{ user, preferences, folders[], tags[], counts{}, notes: <first page> }`.
**One request renders the app.** Without it the first paint needs six round-trips and
nothing serves the nine sidebar counts.

### Notes

| Method | Path | Notes |
|---|---|---|
| GET | `/notes?folder_id=&tag=&starred=&trashed=&q=&sort=&cursor=` | **Cursor** pagination — `updated_at` changes constantly, so offset pagination duplicates and skips rows |
| POST | `/notes` | |
| GET | `/notes/{uuid}` | |
| PATCH | `/notes/{uuid}` | `{body, version}` → **409**; or `{title}` / `{folder_id}` / `{is_starred}` with **no** version check |
| POST | `/notes/{uuid}/duplicate` | |
| PUT | `/notes/{uuid}/tags` | `{names: [...]}` — **by name, not id**. Server upserts missing tags and returns the resolved set, so the picker's type-and-create is one request |
| DELETE | `/notes/{uuid}` | Soft delete → trash |
| POST | `/notes/{uuid}/restore` | Optional `{folder_id}` |
| DELETE | `/notes/{uuid}?force=1` | Hard delete. Serves two paths: "Delete permanently", and the silent discard of an abandoned empty note (no toast, no confirm) |
| DELETE | `/trash` | Empty trash |

### Folders, tags, preferences, search

| Method | Path | Notes |
|---|---|---|
| POST/PATCH/DELETE | `/folders` · `/folders/{uuid}` | **Deleting a folder moves its notes to root — it never deletes notes** |
| POST/PATCH/DELETE | `/tags` · `/tags/{uuid}` | Deleting a tag detaches it; notes survive |
| PATCH | `/preferences` | theme, sort, group-by-date, show-snippets |
| GET | `/search?q=` | **Separate from `/notes?q=`** — returns mixed types (notes, folders, tags) with snippets, not homogeneous paginated notes |

---

## 6. UI

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ☰  Notes     🔍 Search notes and actions…  ⌘K      ☀  AV     │
├───────────┬──────────────┬───────────────────────────────────┤
│ ＋ New    │ All notes ⇅  │ ┌ Release plan ●─┬ Meeting ─┬ ＋ ┐│
│           │ ▽ Filter in… │ ├─────────────────────────────────┤│
│ All notes │ ┌──────────┐ │ │ B I U S Tx H ⟨⟩ H1-H4 A̲ • 1. ✓ ││
│ Recent    │ │ Release  │ │ │ ❝ X₂ X² 🔗 🖼 ▦ {} ▸ — ≡ ↶ ↷ ¶ ││
│ Starred   │ │ Ship r34 │ │ ├─────────────────────────────────┤│
│ FOLDERS ＋│ └──────────┘ │ │ #todo #release  ＋ Add tag      ││
│  • Work ⋯ │              │ │ # Release plan — r34            ││
│ TAGS    ＋│              │ │ …full width, no max-width…      ││
│ 🗑 Trash  │              │ └─────────────────────────────────┘│
├───────────┴──────────────┴───────────────────────────────────┤
│ ● Saved · 2 min ago   148 words   Work/Releases   Autosave on │
└──────────────────────────────────────────────────────────────┘
```

- Sidebar toggle is at the **far left**, next to what it controls.
- The document fills the **full width** of the editor pane — no centred max-width column.
- Header right is **theme toggle + avatar only**. There is no gear icon.
- Avatar menu has exactly two items: **Profile** and **Sign out**.

### 6.2 Two search controls, deliberately different

| | **⌘K Spotlight** | **Funnel filter** |
|---|---|---|
| Icon | Magnifier | **Funnel** |
| Scope | Every note, any folder | Only the visible list |
| Searches | Title + body + folders + tags + commands | Title + snippet |
| Result | **Jumps** to a note, closes | **Narrows in place**, stays |
| Placeholder | "Search notes and actions…" | "**Filter in Work**" — names the scope |

The funnel is **hybrid**: it filters loaded rows instantly with no loader, and if the
scope has more pages it fires a scoped server query in the background. Client-side-only
filtering silently misses notes beyond the loaded page.

**Handoff:** in Spotlight, `⌘↵` / "See all results" switches the list pane to a
`Search results for "…"` scope with a Clear button. The filter then narrows within it.
The filter clears automatically when the scope changes — a sticky filter makes notes
look deleted.

### 6.3 Editor

Full `@mantine/tiptap` control set, all MIT:

**Marks** Bold · Italic · Underline · Strikethrough · ClearFormatting · Highlight · Code
**Headings** H1–H4
**Colour** text colour · clear colour
**Blocks** bullet · ordered · task list · blockquote · subscript · superscript
**Insert** link · unlink · image · table · code block · details · horizontal rule
**Align** left · centre · right · justify
**History** undo · redo
**Extras** invisible characters · Rich text ⇄ Source
**Menus** BubbleMenu (desktop only) · sticky toolbar

**Table controls live in a contextual bar** shown only while the cursor is inside a
table — add/delete row and column, merge, split, header row, header column, delete
table. Eleven more buttons in the permanent toolbar would be unusable.

**Title derivation:** first `# heading`, else the first non-empty line, truncated to 120
chars — until renamed explicitly, after which `title_locked = 1` and it never
auto-changes.

### 6.4 Dropdowns (12)

Account · Note actions · Folder actions · **Tag actions (Rename / Delete only)** ·
Sort & view · Tab actions · Move to folder · Tag picker · Trash actions · Text colour ·
Insert table (drag-to-size grid) · Link.

Destructive items state what **survives**: "Notes inside move to All notes — nothing is
deleted"; "Removed from 4 notes. The notes stay." Trash rows show "Auto-deleted 23 days
from now".

### 6.5 Loading rules

**Never a full-screen loader.** A loader covers only the region whose data is missing.

| Situation | Treatment |
|---|---|
| First boot | **Skeleton of the real layout** — sidebar, list rows, editor lines |
| Switch folder / search | Skeleton rows **in the list pane only** |
| Open a note | Tab appears instantly with the known title; skeleton lines in the body |
| Button actions | Spinner **inside the button**, button disabled |
| ⌘K search | 2px indeterminate bar under the input; **stale results stay visible, dimmed** |
| Funnel filter | Inline spinner in the input → result count `4 of 24` |
| Find in note | **None** — the document is in memory |
| Autosave / prefetch | **None** |
| Anything else | 2px top-of-window bar driven by `useIsFetching()` |

Two rules that matter more than they sound:

1. **Delay every loader by 250 ms.** Most requests return in under 100 ms; a one-frame
   spinner reads as jank.
2. **Mutations get optimistic updates, not spinners.** Star, move, rename and delete
   apply instantly and roll back with a toast + Retry.

**Never clear results while loading** — dim them. Clearing makes the list jump.
Skeletons only when there is nothing to keep.

### 6.6 Saving

No spinner. The status bar is the indicator:

```
●  Saved · 2 min ago     ●  Saving…     ●  Saved
▲  Couldn't save · retrying in 4s   [Retry]
```

1. **Never block the editor.** Typing continues during a save.
2. **"Saving…" has a 400 ms minimum display time**, or it strobes.
3. **⌘S is the exception** — an explicit save earns an explicit acknowledgement.
4. **Failure is loud, success is quiet.** Amber status, exponential backoff, draft kept
   in IndexedDB, persistent banner after ~3 failures.

### 6.7 Responsive — three layouts, not one layout with things hidden

| Width | Layout |
|---|---|
| **≥ 1100px** desktop | Three panes. Sidebar collapses with ⌘1 |
| **768–1099px** tablet | Two panes (list + editor). Sidebar is a **slide-in drawer** with a scrim |
| **≤ 767px** phone | **One pane at a time**: Folders → Notes → Editor, with a back chevron |

Phone specifics:

- **No tabs.** A mouse metaphor; eight of them on a 390px screen is unusable.
- **Toolbar moves to the bottom**, horizontally scrollable, above the keyboard.
- **Dropdowns become bottom sheets**, full width, 15px text, 12px padding.
- **BubbleMenu disabled** below 768px — it collides with iOS selection handles.
- **Inputs are 16px.** Under 16px, Safari zooms the page on focus and never zooms back.
- **`@media (hover:none)`** makes row actions permanently visible; hover-only affordances
  do not exist on touch.
- **`env(safe-area-inset-bottom)`** on toolbar, status bar and toasts.
- **`100dvh`, never `100vh`.**
- **iOS keyboard:** a sticky bottom toolbar still gets covered in some cases. Use the
  **`visualViewport` API** — translate the toolbar by
  `window.innerHeight - visualViewport.height` on `resize`/`scroll`.

Touch targets ≥ 44×44 everywhere.

### 6.8 Keyboard shortcuts

| Keys | Action |
|---|---|
| ⌘N / ⌘⇧N | New note / new folder |
| ⌘K | Spotlight |
| ⌘⇧F | Global search |
| ⌘F | Find in note |
| ⌘S | Force save |
| ⌘W / ⌘⇧T | Close tab / reopen closed tab |
| ⌘B ⌘I ⌘U | Bold, italic, underline |
| ⌘1 / ⌘2 | Toggle sidebar / list |
| ⌘D | Star |
| ⌫ | Move to trash (undo toast) |
| F2 | Rename |

---

## 7. Acceptance criteria

1. Register, log in, reload the page and stay signed in. Log out everywhere invalidates.
2. Create a note, type, wait 1 s, reload — content is there.
3. Open the same note in two tabs, edit both, save the stale one → conflict sheet, no
   data loss.
4. Star a note **while an autosave is in flight** → no 409.
5. Create a note, click away without typing → it disappears from the list.
6. Delete a folder with notes in it → the notes appear in All notes.
7. Search a word present only in a note's body → that note is found, with a snippet.
8. Search a 2-character term → no request is sent; the hint appears.
9. Filter a folder with more notes than one page → results include notes from later pages.
10. Toolbar: every listed control works, and a table can be created, edited and deleted.
11. Highlight, colour, subscript and align survive a save and reload.
12. At 390px: all three panes reachable, toolbar scrolls at the bottom, no horizontal
    page scroll, no zoom on input focus.
13. At 800px: sidebar opens as a drawer over a scrim.
14. Dark and light themes both render every surface correctly.
15. Kill the network mid-type: status goes amber, the draft survives a reload.
16. Load the app, go offline, reload — the app still opens and previously loaded notes
    are readable.
17. Offline: edit a note for several minutes, create a second note, star a third.
    Reconnect. All three land, the edited note produces exactly **one** `PATCH`, and
    the created note is **not** duplicated.
18. Offline on another device, edit the same note on a second device, then reconnect
    the first — the conflict sheet appears rather than silently overwriting.
19. Chrome offers to install the app, and the installed window opens without browser
    chrome.
20. Deploy a new build with the app open — the update prompt appears, and reloading
    loads the new version.
21. Sign out, then go offline and reload — no notes from the previous session are
    readable.
