# START HERE

> **Historical.** Written for the first version of the app, on Laravel and MySQL. The API
> is now FastAPI on Postgres (decision 10 in `docs/decisions.md`). For how the app works
> and runs today, read `README.md`, `docs/architecture.md` and `docs/decisions.md`.

Entry point for the coding agent. Read this file first, in full.

---

## ✅ STATUS — 2026-10-11 · READY

All documents are current and consistent. `docs/PLAN.md` holds **31 tasks** across
two phases — api and web app — ending at a `⛔ STOP` gate after Task F15. Begin at
Task B1.

---

## 1 · What this is

A web notes application: a React single-page app against a Laravel API on MySQL. The
app is web-only — there are no desktop or mobile builds.

---

## 2 · Read these, in this order

All paths are relative to the repository root.

| Order | File | Why |
|---|---|---|
| 1 | `docs/PRINCIPLES.md` | **How to work on this project** — branching, when to stop, how to test, what never to do |
| 2 | `docs/CONTEXT.md` | Every decision and the reasoning behind it, including six reversals that must not be undone |
| 3 | `docs/ARCHITECTURE.md` | **The current design.** Storage, saving and conflicts, auth, the MCP server, the full stack |
| 4 | `docs/SPEC.md` | Product spec and acceptance criteria |
| 5 | `docs/PLAN.md` | **The 31 tasks, in order, ending at one gate** |
| 6 | `docs/SETUP-WINDOWS.md` | The Docker environment |
| — | `mockup/index.html` | Open in a browser to see the intended UI |

---

## 2b · What you will create

The developer provides `api/` and `web/` as bare scaffolds. Everything below
is created by you, task by task. **Do not create a directory that is not on this
list** — if the plan seems to need one, stop and say so.

```
notes-app/
├── GETTING-STARTED.md            the developer's runbook — not for you
├── WHEN-IT-GOES-WRONG.md         the developer's recovery guide — not for you
├── docker-compose.yml            provided
├── docker/php/Dockerfile         provided
├── assets/brand/                 provided — 14 files, never regenerate
├── mockup/index.html             UI reference — open it if a layout is unclear
├── docs/                         everything here is for you
│   ├── START.md  PRINCIPLES.md  CONTEXT.md
│   └── ARCHITECTURE.md  SPEC.md  PLAN.md  SETUP-WINDOWS.md
│
├── api/                      provided as a bare Laravel 12 app
│   ├── app/
│   │   ├── Console/Commands/     PruneEmptyNotes, PurgeTrash
│   │   ├── Exceptions/           NoteConflictException
│   │   ├── Http/
│   │   │   ├── Controllers/Api/V1/   Auth, Profile, PasswordReset,
│   │   │   │                         Note, Folder, Tag, Search, Bootstrap
│   │   │   ├── Requests/             one per write endpoint
│   │   │   └── Resources/            User, Note, NoteList, Folder, Tag
│   │   ├── Models/               User, Note, Folder, Tag
│   │   ├── Policies/             NotePolicy, FolderPolicy, TagPolicy
│   │   ├── Queries/              NotesQuery, FolderQuery
│   │   ├── Services/             one action per class, single __invoke()
│   │   │   ├── Auth/             RegisterUser, AuthenticateUser, LogoutUser,
│   │   │   │                     SendPasswordResetLink, ResetPassword
│   │   │   ├── Users/            UpdateProfile, ChangePassword, UpdatePreferences
│   │   │   ├── Folders/          CreateFolder, RenameFolder, DeleteFolder
│   │   │   ├── Tags/             CreateTag, RenameTag, DeleteTag, UpsertTags
│   │   │   ├── Notes/            CreateNote, UpdateNote, DeriveNoteFields,
│   │   │   │                     SyncNoteTags, DeleteNote, RestoreNote,
│   │   │   │                     EmptyTrash, DuplicateNote
│   │   │   ├── Search/           SearchNotes
│   │   │   └── Bootstrap/        BuildBootstrapPayload
│   │   └── Support/              PlainTextExtractor, SnippetBuilder, SearchTerms
│   ├── database/migrations/      notes, folders, tags, note_tag, note_versions
│   ├── routes/api.php
│   └── tests/
│       ├── Feature/              Architecture, Auth, Profile, Folder, Tag,
│       │                         NoteIndex, NoteUpdate, NoteTag, Trash, Search,
│       │                         Bootstrap, Cleanup, Authorization,
│       │                         NoteCreateIdempotency, TrashedNoteConflict
│       └── Unit/                 PlainTextExtractor, SnippetBuilder
│
└── web/                     provided as a bare Vite React-TS app
    ├── e2e/                      notes.spec.ts
    ├── public/                   icons copied from assets/brand
    └── src/
        ├── api/                  client, auth, notes, folders, tags, search, bootstrap
        ├── components/
        │   ├── common/           Skeletons, TopProgress, UpdatePrompt
        │   ├── editor/           Editor, EditorToolbar, TableBar, TabBar, TagStrip,
        │   │                     extensions.ts
        │   ├── layout/           AppShell, Header, Sidebar, SidebarNav,
        │   │                     StatusBar, AccountMenu, ProfileModal
        │   ├── notes/            NoteList, NoteRow, FilterInput
        │   ├── search/           SpotlightSearch, Highlight
        │   └── conflicts/        ConflictSheet
        ├── db/                   drafts (the IndexedDB draft buffer)
        ├── hooks/
        │   ├── queries/          useAuth, useBootstrap, useNotes, useFolders,
        │   │                     useTags, useSearch
        │   └── useAutosave, useAbandonedNote, useOnline, useVisualViewport
        ├── lib/                  queryClient, drafts, filterNotes, useDelayedLoading
        ├── pages/                LoginPage, RegisterPage, AppPage
        ├── stores/               uiStore, tabsStore
        ├── types/                api.ts
        └── theme.ts  routes.tsx  App.tsx  main.tsx
```

---

## 2c · Before Task B1 — make sure there is a git repository

You commit after every task, so a repository must exist. **Check first, and create one
if it is missing** — do not assume, and do not skip the commits because there is no repo.

```powershell
cd C:\dev\notes-app          # or wherever the project lives
git rev-parse --is-inside-work-tree
```

**If that errors** with *"not a git repository"*, create one:

```powershell
git init
git config user.email "akashvichhi@zohomail.in"
git config user.name  "Akash Vichhi"
git add -A
git commit -m "docs: specification, plan, brand assets and docker environment"
```

**If the repository already exists**, still set the identity — it is repository-scoped,
so it will not disturb any other project on the machine:

```powershell
git config user.email "akashvichhi@zohomail.in"
git config user.name  "Akash Vichhi"
```

Use `git config`, **never `git config --global`**. Changing the machine-wide identity
is not yours to do.

**If `.gitignore` is missing**, create it before the first commit — `vendor/` and
`node_modules/` must never be committed:

```gitignore
.DS_Store
node_modules/
vendor/
/api/.env
/api/storage/*.key
/web/dist/
```

No remote is required. Everything is local; `git log` is how the developer tracks
progress.

---

## 2d · Delivery

This project ships in one authorised stage: **the api plus the web app, `B1`–`B15`
and `F1`–`F15`.** It ends at the `⛔ STOP` gate after F15, where the developer tests
the web app end to end.

---

## 3 · The environment

**Windows with Docker.** PHP and MySQL run in containers; only Node runs on the host.

- Every PHP and Composer command: `docker compose exec app <command>`
- Node and npm run on the host, from `web/`
- `DB_HOST` is **`mysql`**, the compose service name — never `127.0.0.1`
- Start the containers with `docker compose up -d` before Task B1

---

## 4 · Ground rules

**The applications already exist.** `api/` is a Laravel 12 install and `web/`
is a Vite + React + TypeScript project, both created by the developer. **Never** run
`laravel new`, `composer create-project` or `npm create vite`. If either folder is
missing, stop and say so.

**Follow `docs/PRINCIPLES.md`.** It governs everything the plan does not spell out:
work on `master` only — **no branches, no worktrees, no stashing** — stop rather than
improvise, never weaken a test to make it pass, verify before you claim, and report
failures plainly.

**Pause at 🧠 REASONING-HEAVY tasks.** Task B8 carries a
`🧠 REASONING-HEAVY TASK` banner. **Before starting it, stop and say so**, then wait.
You cannot change your own model — the developer may want to switch to a stronger one
first, and they can only do that between turns. One line is enough:

> *"The next task is B8, which is marked reasoning-heavy. Say continue when you're
> ready."*

**Work through the tasks strictly in order.** Do not skip ahead or reorder.

**⛔ STOP AFTER TASK F15.** When F15 is committed, run the full suite, report, and
**wait**.

**Each task is a TDD cycle.** Write the failing test, run it and confirm it fails,
implement, run it and confirm it passes, commit. Never write implementation before its
test.

**COMMIT AFTER EVERY SINGLE TASK.** This is not optional and not something to batch.

- One task → one commit. Never finish two tasks and make one commit.
- Use the exact commit message given in that task's final step.
- Commit only when that task's tests pass. Never commit a red suite.
- Stage everything the task touched: `git add -A`.
- Do not commit before a task is finished, and do not move on to the next task until
  the previous one is committed.

Each commit is the checkpoint the developer uses to review progress and to roll back a
task that went wrong. A batch of five tasks in one commit destroys that, and there is
no way to recover it afterwards.

**Controllers contain no logic.** Every action is a single-method service under
`app/Services/<Domain>`; queries live in `app/Queries`; stateless helpers in
`app/Support`; models hold relations, casts and scopes only. After every api task
run `docker compose exec app php artisan test --filter=ArchitectureTest`. If it fails,
move the logic into a service — never relax the test.

**Use the exact dependency versions pinned in the plan.** Do not upgrade or substitute
packages. Never add `@tiptap-pro/*` or CKEditor.

**MySQL 8 only.** No Postgres-specific features.

**Do not invent branding.** Every icon and logo already exists in `assets/brand/` and
is documented in its README. Copy those files; never generate, redraw or substitute an
image asset, and never invent a wordmark, tagline or brand colour.

**Do not invent files or endpoints** that are not in the plan. If something in the plan
is wrong or impossible, **stop and say so** rather than improvising.

---

## 5 · Not for you

**Everything inside `docs/` is for you. Everything at the repository root is not.**

The developer's own guides — `GETTING-STARTED.md` and
`WHEN-IT-GOES-WRONG.md` — are **not for you**. They cover model selection, git
recovery and the prompts the developer sends, none of which are yours to act on.

When you have read this file and the five in §2, begin at **Task B1**.
