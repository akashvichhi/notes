# Project context — read this first

> **Historical.** Written for the first version of the app, on Laravel and MySQL. The API
> is now FastAPI on Postgres (decision 10 in `docs/decisions.md`). For how the app works
> and runs today, read `README.md`, `docs/architecture.md` and `docs/decisions.md`.

**Purpose:** everything decided so far, and why. If you are starting a fresh session,
read this file, then `architecture.md`, then `requirements.md` and `PLAN.md`.

**Last updated:** 2026-10-11

---

## 1 · What we are building

A web notes application in the spirit of Apple Notes. Rich-text editing, folders,
tags, search, trash. Multi-user accounts; every note lives on the server.

A **React single-page app** talks to a **Laravel API on MySQL**, which also serves an
MCP server for AI assistants. The app is web-only — there are no desktop or mobile
builds (decision 1).

---

## 2 · Where everything lives

**All work stays inside `~/Downloads/notes-app`.** The developer asked for this
explicitly; do not create files anywhere else.

**Everything in `docs/` is for the agent. Everything at the repository root is for
the developer.**

| Path | What it is |
|---|---|
| `GETTING-STARTED.md` | **Developer runbook** — setup, the prompts to paste, model choice |
| `WHEN-IT-GOES-WRONG.md` | **Developer recovery guide** |
| `docs/START.md` | The agent's entry point |
| `docs/CONTEXT.md` | This file |
| `docs/architecture.md` | **Current** design: storage, saving and conflicts, auth, MCP, stack |
| `docs/requirements.md` | Product spec and acceptance criteria |
| `docs/PLAN.md` | 31-task implementation plan |
| `GETTING-STARTED.md` | Step-by-step runbook and the agent prompt |
| `docs/SETUP-WINDOWS.md` | Docker environment reference |
| `mockup/index.html` | Interactive UI mockup — open in a browser |
| `assets/brand/` | 14 icon and logo files, all generated, plus a README |
| `docker-compose.yml`, `docker/php/Dockerfile` | PHP 8.3 + MySQL 8.4 for local dev |

---

## 3 · The developer's environment and preferences

- **Windows machine with Docker.** PHP and MySQL run in containers; only Node is
  installed on the host. Every PHP command is `docker compose exec app …`.
- **`DB_HOST=mysql`**, the compose service name — never `127.0.0.1`.
- The implementation will be executed by **Google Antigravity**, an agentic IDE, from
  `PLAN.md`. The plan must therefore be literal and self-contained — real code at every
  step, no "implement X here".
- **The developer scaffolds `api/` and `web/` themselves.** The agent must
  never run `laravel new`, `composer create-project` or `npm create vite`.
- They prefer **decisions and deliverables over questions**. Offer a recommendation and
  proceed under stated assumptions rather than asking a sequence of questions.
- They read the mockup carefully and catch real UI problems. Take their UI feedback at
  face value — it has been right every time.

---

## 4 · The product

### Core features

Rich-text editor with the full toolbar · nested folders · tags · star · trash with
30-day purge · ⌘K global search · scoped list filter · editor tabs on wide screens ·
light/dark · responsive across phone, tablet and desktop browsers · personal access
tokens and an MCP server.

### Deliberately out of scope

Import/export · a settings screen · version-history UI · attachments · sharing ·
real-time collaboration · end-to-end encryption · native apps · offline editing.

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
| **Session cookies for the browser**, personal access tokens only for MCP | JavaScript never holds a credential; a token can never reach the account routes |
| **Cursor pagination** | `updated_at` changes constantly; offset pagination duplicates and skips rows |
| **Idempotent note create with a client-minted UUID** | The note shows before the server answers, and a retried request must not produce twins |

### Storage and saving

| Decision | Why |
|---|---|
| **ProseMirror JSON**, not markdown | Highlight, colour, sub/superscript and text-align cannot be expressed in GFM. `plain_text` is derived server-side for `FULLTEXT` |
| **Reads go to the API**; IndexedDB holds only the draft buffer | One data path; a crash or reload never loses typing |
| **Document-level conflicts with copies** (Dropbox/Obsidian model) | One person rarely edits a note in two places at once, and "Save mine as a copy" cannot lose data |
| **Version check applies only to body writes** | Starring during an in-flight autosave must never 409 |
| **PWA removed** | `vite-plugin-pwa`, workbox, service worker and web manifest all deleted |

---

## 6 · Reversals — decisions that changed, and why

Each of these was decided one way and then changed. The reason matters more than the
outcome; do not quietly revert them.

1. **Markdown → ProseMirror JSON.** Storage was markdown until the developer asked for
   the full toolbar. Highlight, colour and alignment are not expressible in GFM, so
   markdown would have silently dropped them on every save.
2. **Controllers with logic → service layer.** The first plan had conflict checks and
   transactions in controllers. Rewritten into 24 single-action services with an
   architecture test enforcing it.
3. **Native apps → web-only.** The app was planned to ship as Tauri apps for desktop
   and mobile, with a local SQLite copy, an "On This Device" container and a sync
   engine. Only the web app is used, so all of that was removed (decision 1).

---

## 7 · UI decisions from mockup review

The developer reviewed mockups closely. These came out of that:

- **Sidebar toggle sits at the far left**, next to what it controls — not in the
  right-hand cluster with settings and avatar.
- **The document fills the full editor width**, no centred max-width column. A
  "readable line length" setting is a possible later option.
- **No gear icon.** The avatar menu holds Profile, Access tokens and Sign out.
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

1. **Block-level auto-merge** (OneNote's model) is planned as a later upgrade, not
   built now.

---

## 9 · Status

**All documents are current and consistent as of 2026-10-11.**

| Document | State |
|---|---|
| | **For the agent** | |
| `docs/START.md` | Entry point — read order, folder map, git bootstrap, delivery gates, ground rules |
| `docs/PRINCIPLES.md` | How to work — 11 absolutes, the task loop, the self-audit |
| `docs/CONTEXT.md` | This file — decisions, reversals, status |
| `docs/architecture.md` | Storage, saving and conflicts, auth, MCP, the stack |
| `docs/requirements.md` | Product spec · **16 acceptance criteria in §7** |
| `docs/PLAN.md` | **31 tasks** — B1–B15 api · F1–F15 web app |
| `docs/SETUP-WINDOWS.md` | The Docker environment |
| | **For the developer only** | |
| `GETTING-STARTED.md` | Runbook — setup, **the prompts to paste**, model choice, tagging |
| `WHEN-IT-GOES-WRONG.md` | Recovery — detection, undo by severity, correction prompts |
| `mockup/index.html` | Interactive UI reference |

Hand the folder to the IDE and point it at `docs/START.md`.

**Delivery is one stage** — `B1`–`B15` and `F1`–`F15` — ending at a ⛔ gate after F15
for the developer to test.

**Model guidance** (`GETTING-STARTED.md` step 6b): Gemini and Claude have separate
quotas in Antigravity, so run the other tasks on **Gemini 3.1 Pro (High)** and save
**Claude Opus 5.5 (thinking)** for the reasoning-heavy one — `B8`. Avoid Sonnet/Opus
4.6 and GPT-OSS — removed 2 November 2026.

## 10 · Constraints that will get optimised away if nobody writes them down

- **`plain_text` is always derived server-side.** Accepting it from a client lets
  search drift from content.
- **Never accept `user_id` from a client.** Every query scopes through the
  authenticated user via a Policy.
- **MySQL `FULLTEXT` ignores terms under 3 characters** (`innodb_ft_min_token_size`).
  The API rejects them so the UI can say "type at least 3 characters" instead of
  returning an empty list that reads as "you have no notes".
- **Do not use XAMPP or WAMP** — they ship MariaDB, which lacks `utf8mb4_0900_ai_ci`
  and whose `JSON` type is an alias for `LONGTEXT`. The migrations fail.
- **axios needs `withXSRFToken: true`** as well as `withCredentials`,
  or every write returns 419 and looks like a CORS fault.
- **All brand assets already exist** in `assets/brand/`. Never generate, redraw or
  substitute an icon, and never invent a wordmark or tagline.
