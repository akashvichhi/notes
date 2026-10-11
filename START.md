# START HERE

Entry point for the coding agent. Read this file first, in full.

---

## ⚠ STATUS — 2026-10-11

**Do not begin implementation yet.** `docs/SPEC.md` and `docs/PLAN.md` still describe
an earlier design (a Progressive Web App with cookie-only authentication). The project
has since pivoted to **native cross-platform apps built with Tauri 2**, with
**dual authentication**, a **local SQLite store** and a **sync engine**.

`docs/ARCHITECTURE.md` is the current design and **supersedes the spec and plan
wherever they disagree**. Both are being rewritten against it.

If you are reading this before that rewrite lands, **stop and say so** rather than
building from the stale plan.

---

## 1 · What this is

A cross-platform notes application. One React codebase ships as a web app and as
native apps for Windows, macOS and Linux (Android and iOS in phase two), against a
Laravel API on MySQL.

Notes live in one of two containers:

- **Cloud** — synced to the user's account across every device. Works offline; changes
  reconcile on reconnect.
- **On This Device** — never leaves the machine, needs no account, deleted on uninstall.

---

## 2 · Read these, in this order

| Order | File | Why |
|---|---|---|
| 1 | `docs/CONTEXT.md` | Every decision and the reasoning behind it, including six reversals that must not be undone |
| 2 | `docs/ARCHITECTURE.md` | **The current design.** Containers, local and cloud storage, the sync protocol, auth, the full stack |
| 3 | `docs/SPEC.md` | Product spec and acceptance criteria |
| 4 | `docs/PLAN.md` | The task list you execute, in order |
| 5 | `docs/SETUP-WINDOWS.md` | The Docker environment |
| — | `mockup/index.html` | Open in a browser to see the intended UI |

---

## 3 · The environment

**Windows with Docker.** PHP and MySQL run in containers; only Node runs on the host.

- Every PHP and Composer command: `docker compose exec app <command>`
- Node and npm run on the host, from `frontend/`
- `DB_HOST` is **`mysql`**, the compose service name — never `127.0.0.1`
- Start the containers with `docker compose up -d` before Task B1

---

## 4 · Ground rules

**The applications already exist.** `backend/` is a Laravel 12 install and `frontend/`
is a Vite + React + TypeScript project, both created by the developer. **Never** run
`laravel new`, `composer create-project` or `npm create vite`. If either folder is
missing, stop and say so.

**Work through the tasks strictly in order.** Do not skip ahead or reorder.

**Each task is a TDD cycle.** Write the failing test, run it and confirm it fails,
implement, run it and confirm it passes, commit. Never write implementation before its
test. Commit after every task, using the message in that task's final step.

**Controllers contain no logic.** Every action is a single-method service under
`app/Services/<Domain>`; queries live in `app/Queries`; stateless helpers in
`app/Support`; models hold relations, casts and scopes only. After every backend task
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

## 5 · The prompt

Paste this into the agent as your first message:

```
Read START.md in full, then docs/CONTEXT.md, docs/ARCHITECTURE.md, docs/SPEC.md
and docs/PLAN.md before writing any code.

Follow every ground rule in START.md section 4.

Execute docs/PLAN.md task by task, in order, starting with the first task.
Each task's steps are a TDD cycle — follow them literally and commit at the end
of each task.

Environment: Windows with Docker. Run every PHP and Composer command as
`docker compose exec app <command>`. Node runs on the host from frontend/.
DB_HOST is `mysql`.

The backend/ and frontend/ applications already exist. Do not scaffold them.

If anything in the plan is wrong, impossible, or contradicts
docs/ARCHITECTURE.md, stop and tell me instead of improvising.
```

To resume in a later session:

```
Continue from Task <id>. Re-read docs/PLAN.md for that task and follow its steps
exactly. Do not redo earlier tasks.
```

---

## 6 · Watch for these while it works

```powershell
git log --oneline                                              # one commit per task
docker compose exec app php artisan test
docker compose logs -f app
```

Three early warning signs:

1. **Several tasks completed, one commit.** It is not following the plan. Stop it and
   point it back at the task list.
2. **`ArchitectureTest` failing.** Logic is creeping into controllers. Tell it to move
   the logic into a service, never to change the test.
3. **Dependency drift** — `git diff backend/composer.json frontend/package.json`. The
   plan pins every version; silent upgrades are where "works on my machine" starts.
