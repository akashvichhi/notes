# Project context — read this first

**Purpose:** everything decided so far, and why. If you are starting a fresh session,
read this file, then `ARCHITECTURE.md`, then `SPEC.md` and `PLAN.md`.

**Last updated:** 2026-10-11

---

## 1 · What we are building

A cross-platform notes application in the spirit of Apple Notes. Rich-text editing,
folders, tags, search, trash. Multi-user accounts with notes synced across every
device, plus a device-only container that never leaves the machine.

**One React codebase** ships as a web app and as native apps for Windows, macOS,
Linux, Android and iOS. A **Laravel API on MySQL** is the cloud backend.

---

## 2 · Where everything lives

**All work stays inside `~/Downloads/notes-app`.** The developer asked for this
explicitly; do not create files anywhere else.

| Path | What it is |
|---|---|
| `docs/CONTEXT.md` | This file |
| `docs/ARCHITECTURE.md` | **Current** design: containers, local/cloud storage, sync, stack |
| `docs/SPEC.md` | Product spec — **predates the cross-platform pivot, needs rewriting** |
| `docs/PLAN.md` | 34-task implementation plan — **predates the pivot, needs rewriting** |
| `docs/GETTING-STARTED.md` | Step-by-step runbook and the agent prompt |
| `docs/SETUP-WINDOWS.md` | Docker environment reference |
| `mockup/index.html` | Interactive UI mockup — open in a browser |
| `assets/brand/` | 14 icon and logo files, all generated, plus a README |
| `docker-compose.yml`, `docker/php/Dockerfile` | PHP 8.3 + MySQL 8.4 for local dev |

**`SPEC.md` and `PLAN.md` are stale.** They describe the PWA design. `ARCHITECTURE.md`
supersedes them on anything that disagrees. Rewriting them is the next task.

---

## 3 · The developer's environment and preferences

- **Windows machine with Docker.** PHP and MySQL run in containers; only Node is
  installed on the host. Every PHP command is `docker compose exec app …`.
- **`DB_HOST=mysql`**, the compose service name — never `127.0.0.1`.
- The implementation will be executed by **Google Antigravity**, an agentic IDE, from
  `PLAN.md`. The plan must therefore be literal and self-contained — real code at every
  step, no "implement X here".
- **The developer scaffolds `backend/` and `frontend/` themselves.** The agent must
  never run `laravel new`, `composer create-project` or `npm create vite`.
- They prefer **decisions and deliverables over questions**. Offer a recommendation and
  proceed under stated assumptions rather than asking a sequence of questions.
- They read the mockup carefully and catch real UI problems. Take their UI feedback at
  face value — it has been right every time.

---

## 4 · The product

### Two containers, Apple Notes style

| | **Cloud** | **On This Device** |
|---|---|---|
| Stored in | MySQL, on the server | SQLite, on the machine |
| On other devices | Yes | No |
| Works offline | **Yes** — cached, editable | Yes |
| Survives uninstall | Yes | **No** |
| Needs an account | Yes | **No** |
| Can conflict | Yes | Never |

Each container is a complete world: its own folders, tags and Trash. The app works
with **no account at all** — sign-in only adds the Cloud container.

### Core features

Rich-text editor with the full toolbar · nested folders · tags · star · trash with
30-day purge · ⌘K global search · scoped list filter · editor tabs (desktop) ·
light/dark · responsive across phone, tablet and desktop · offline editing with sync.

### Deliberately out of scope

Import/export · a settings screen · version-history UI · attachments · sharing ·
real-time collaboration · end-to-end encryption · background sync while closed.

---

## 5 · Decision log

### Frontend

| Decision | Why | Rejected |
|---|---|---|
| **React 19 + Vite + TypeScript** | Developer's stack | — |
| **Mantine 9.7.1** | `AppShell`, Spotlight (⌘K), hotkeys, dark mode, and `@mantine/tiptap` ship the editor toolbar | Ant Design (form-heavy look), shadcn/ui (more assembly) |
| **TipTap 3.31.4** | WYSIWYG, as the developer asked for after seeing CKEditor. MIT, React-first, markdown input rules | CKEditor 5 (paid for closed source), Lexical (0.x, hand-built toolbar), Milkdown, Quill, Monaco, CodeMirror |
| **Full toolbar**, every `@mantine/tiptap` control | Developer's explicit request | A reduced GFM-safe set |
| **TanStack Query + Zustand** | Server state vs UI state, cleanly split | Redux |

### Backend

| Decision | Why |
|---|---|
| **Laravel 12, API-only** | Developer's stack. `php artisan install:api` |
| **MySQL 8.0+ only** | Hard constraint from the developer |
| **No logic in controllers** | Developer's explicit rule. One action per service class under `app/Services/<Domain>`, queries in `app/Queries`, stateless helpers in `app/Support`, models hold relations and one scope. An `ArchitectureTest` greps controllers for `DB::`, `->where(`, `if (` and fails the build |
| **Dual auth** — cookies for browser, Bearer tokens for native | A packaged app is a different origin; SameSite cookies are never sent. Sanctum runs both on the same routes |
| **Cursor pagination** | `updated_at` changes constantly; offset pagination duplicates and skips rows |
| **Idempotent note create with a client-minted UUIDv7** | Offline creates need an id before the server sees one, and a flaky reconnect must not produce twins |

### Storage and sync

| Decision | Why |
|---|---|
| **ProseMirror JSON**, not markdown | Highlight, colour, sub/superscript and text-align cannot be expressed in GFM. `plain_text` is derived server-side for `FULLTEXT` |
| **SQLite on native** for both containers | For local notes this is the only copy; IndexedDB can be evicted under storage pressure. Also gives FTS5 offline search |
| **Local-first on native** — UI always reads SQLite | Avoids two data paths and the bugs that only appear offline |
| **Per-account revision counter**, not `updated_at`, for sync | Clock skew and same-millisecond writes silently lose notes |
| **Tombstones** for hard deletes | Otherwise an offline device keeps a ghost copy and its queued edit resurrects the note |
| **Push before pull** | The server detects conflicts; pulling first means merging locally |
| **Document-level conflicts with copies** (Dropbox/Obsidian model) | A single user across devices conflicts rarely, and "Save mine as a copy" cannot lose data |
| **Version check applies only to body writes** | Starring during an in-flight autosave must never 409 |
| **Body writes coalesce per note in the outbox** | Twenty minutes offline replays as one request, leaving at most one conflict per note |

### Cross-platform

| Decision | Why | Rejected |
|---|---|---|
| **Tauri 2** | One project for all five platforms; ~5–15 MB installers; extends to mobile later without a second toolchain | Electron + Capacitor (two shells, 120–150 MB), React Native / Flutter (full rewrite — Mantine and TipTap do not run there) |
| **Desktop first**, mobile phase two | No store review, no $99/yr to start; shakes out token auth and sync before store deadlines | All five at once |
| **PWA removed** | Replaced by the native shell. `vite-plugin-pwa`, workbox, service worker, web manifest all deleted |

---

## 6 · Reversals — decisions that changed, and why

Each of these was decided one way and then changed. The reason matters more than the
outcome; do not quietly revert them.

1. **Markdown → ProseMirror JSON.** Storage was markdown until the developer asked for
   the full toolbar. Highlight, colour and alignment are not expressible in GFM, so
   markdown would have silently dropped them on every save.
2. **Cookies → dual auth.** Sanctum stateful cookies were right for a browser-only app.
   A packaged native app is a different origin, so tokens became necessary. Cookies
   remain for the web build.
3. **IndexedDB → SQLite.** IndexedDB was fine while local data was only a *cache*. Once
   "On This Device" notes became the only copy, eviction risk made it unacceptable.
4. **PWA → native shell.** Four PWA tasks were written and then removed.
5. **Cloud online-only → cloud works offline.** The developer initially proposed that
   cloud notes require internet. Apple's model does not work that way, and a notes app
   that needs signal is a product defect. They agreed.
6. **Controllers with logic → service layer.** The first plan had conflict checks and
   transactions in controllers. Rewritten into 24 single-action services with an
   architecture test enforcing it.

---

## 7 · UI decisions from mockup review

The developer reviewed mockups closely. These came out of that:

- **Sidebar toggle sits at the far left**, next to what it controls — not in the
  right-hand cluster with settings and avatar.
- **The document fills the full editor width**, no centred max-width column. A
  "readable line length" setting is a possible later option.
- **No gear icon.** The avatar menu holds exactly two items: Profile and Sign out.
- **Two search controls, visually distinct**: ⌘K Spotlight is a magnifier and searches
  everything; the list filter is a **funnel** and names its scope ("Filter in Work").
- **The list filter is hybrid** — instant local filtering plus a background scoped
  query when the scope has more pages. Filtering only loaded rows silently hides notes.
- **Tag menu has two items only**: Rename, Delete.
- **Destructive menu items state what survives** — "Notes inside move to All notes —
  nothing is deleted."
- **Folders use a folder icon**, not a coloured dot, and sit under a "Folders" label.
  Without that, nobody can tell what "Work" and "Personal" are.
- **Sample data must not use jargon.** "Scratch" was renamed to "Quick notes" because
  it needed explaining.
- **"Save mine as a copy" is the default button** in the conflict sheet — the only
  choice that cannot lose data.
- **Local notes show no sync status**, only "On this device — not backed up".
- **The On This Device icon and noun follow the hardware** — laptop/"this computer" on
  desktop, phone/"this phone" on a phone, tablet/"this tablet" on a tablet, from
  Tauri's `platform()`. The container NAME never changes; only the icon and noun do.
- **The status bar shows words and characters, plus the selection** when there is one:
  `Selected 10 words · 43 characters | 148 words · 892 characters`. Characters include
  spaces; words are whitespace-separated tokens. TipTap's `CharacterCount` extension
  supplies the totals; the selection is measured from the ProseMirror selection range.

### Loading and saving rules

Never a full-screen loader. Skeletons shaped like the real layout; spinners inside
buttons; a 2px top bar for anything else; **every loader delayed 250 ms** so fast
requests show nothing. Mutations get optimistic updates, not spinners. Autosave shows
status-bar text, never a spinner, with a 400 ms minimum display so it does not strobe.
Failure is loud, success is quiet.

---

## 8 · Open questions

1. **Signing out** wipes cloud rows from SQLite but leaves On This Device untouched —
   confirm that is expected.
2. Whether the **web build** gets any offline capability at all now the PWA is gone.
   Current answer: no, online-only; drafts still buffered for crash protection.
3. **Block-level auto-merge** (OneNote's model) is planned as a later upgrade, not
   built now.

---

## 9 · Status

**All documents are current and consistent as of 2026-10-11.**

| Document | State |
|---|---|
| `START.md` | Ready — entry point, ground rules, folder map, the agent prompt |
| `docs/ARCHITECTURE.md` | Current |
| `docs/SPEC.md` | Rewritten for containers, dual auth, SQLite and sync · 25 acceptance criteria |
| `docs/PLAN.md` | **54 tasks** — B1–B18 backend · F1–F15 shared UI · D1–D12 desktop · M1–M8 mobile |
| `docs/PRINCIPLES.md` | How the agent must work — absolutes, task loop, self-audit |
| `docs/WHEN-IT-GOES-WRONG.md` | Recovery playbook for the developer |
| `mockup/index.html` | Current |

Hand the folder to the IDE and point it at `START.md`.

**Delivery is gated in three stages**, each stopping for the developer to test:

| Stage | Tasks | Gate |
|---|---|---|
| 1 · Backend + web | B1–B18, F1–F15 | ⛔ after F15 |
| 2 · Desktop | D1–D12 | ⛔ after D12 |
| 3 · Mobile | M1–M8 | ⛔ after M8 |

**Model guidance** (`GETTING-STARTED.md` step 6b): Gemini and Claude have separate
quotas in Antigravity, so run the other 45 tasks on **Gemini 3.1 Pro (High)** and save
**Claude Opus 5.5 (thinking)** for the 9 reasoning-heavy ones — `B8`, `B17`, `B18`,
`D3`, `D4`, `D7`, `D8`, `D9`, `M3`. Avoid Sonnet/Opus 4.6 and GPT-OSS — removed
2 November 2026.

**iOS requires a Mac.** M2, M3 (iOS half) and M8 (iOS half) cannot be done on
Windows.

## 10 · Constraints that will get optimised away if nobody writes them down

- **Tombstones must be retained longer than the 30-day trash purge**, or a device
  offline for 40 days cannot reconcile and must full-resync.
- **`version` and the account revision are two different things.** `version` is
  optimistic concurrency per note; revision is sync ordering per account. Conflating
  them produces conflicts that are not real.
- **`plain_text` is always derived server-side.** Accepting it from a client lets
  search drift from content.
- **Never accept `user_id` from a client.** Every query scopes through the
  authenticated user via a Policy.
- **MySQL `FULLTEXT` ignores terms under 3 characters** (`innodb_ft_min_token_size`).
  The API rejects them so the UI can say "type at least 3 characters" instead of
  returning an empty list that reads as "you have no notes".
- **Do not use XAMPP or WAMP** — they ship MariaDB, which lacks `utf8mb4_0900_ai_ci`
  and whose `JSON` type is an alias for `LONGTEXT`. The migrations fail.
- **axios needs `withXSRFToken: true`** as well as `withCredentials` for the web build,
  or every write returns 419 and looks like a CORS fault.
- **All brand assets already exist** in `assets/brand/`. Never generate, redraw or
  substitute an icon, and never invent a wordmark or tagline.
