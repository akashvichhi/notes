# Getting started — from scratch

Everything you run yourself, in order, and exactly what to give the IDE.
**Local terminal = PowerShell on Windows.** Commands are marked 🖥️ (terminal) or
🤖 (Antigravity).

Total hands-on time: about 20 minutes, most of it waiting for downloads.

---

## Step 0 — Install the prerequisites 🖥️

```powershell
docker --version      # Docker Desktop, already installed
node --version        # need v20 or newer
git --version         # needed: the agent commits after every task
```

Install whatever is missing:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Close and reopen PowerShell afterwards, then re-check. **Start Docker Desktop** and
wait for the whale icon to stop animating — nothing below works until the Docker
engine is running.

---

## Step 1 — Get the project files onto this machine 🖥️

The planning files (`docs/`, `docker-compose.yml`, `docker/php/Dockerfile`) were
produced on another machine. Bring the whole `notes-app` folder across — a copy via
cloud drive or USB is fine, or push it to a Git remote and clone it here.

Put it somewhere short and local, **not** in OneDrive or a network drive — Docker
bind mounts and `node_modules` both behave badly there:

```powershell
cd C:\dev\notes-app
dir
```

You should see `docker-compose.yml`, `docker\` and `docs\`. Confirm Git is tracking it:

```powershell
git status
```

If that errors with "not a git repository":

```powershell
git init
git add -A
git commit -m "docs: specification, plan and docker environment"
```

---

## Step 2 — Start PHP and MySQL 🖥️

```powershell
New-Item -ItemType Directory -Force backend | Out-Null
docker compose up -d --build
```

First build pulls PHP 8.3 and MySQL 8.4 and compiles extensions — a few minutes.

```powershell
docker compose ps
```

`notes-mysql` must say **healthy**. `notes-app` says **running** and sits idle,
waiting for `backend/artisan` to appear. That idling is correct, not a fault.

---

## Step 3 — Create the Laravel app 🖥️

```powershell
docker compose exec app composer create-project laravel/laravel .
```

The `.` is deliberate: `/var/www/html` inside the container **is** your `backend\`
folder. This also creates `.env` and generates the app key for you.

The `app` container notices `artisan` and starts serving within a couple of seconds.

---

## Step 4 — Point Laravel at MySQL 🖥️

Open `backend\.env` and set these six lines:

```dotenv
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=notes
DB_USERNAME=root
DB_PASSWORD=secret
```

**`DB_HOST=mysql`, not `127.0.0.1`.** Inside the container, `127.0.0.1` is the
container itself, where no database is listening. This is the single most common
mistake in this setup.

Prove the connection works:

```powershell
docker compose exec app php artisan migrate
```

Expected: the default Laravel migrations run and report `DONE`. If you see
`SQLSTATE[HY000] [2002]`, `DB_HOST` is wrong or MySQL is not healthy yet.

---

## Step 5 — Create the React app 🖥️

```powershell
cd C:\dev\notes-app
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm run dev
```

Choose **React** and **TypeScript** if prompted. Open `http://localhost:5173` — you
should see the Vite starter page. Stop it with `Ctrl+C`; the agent will restart it
when it needs to.

---

## Step 6 — Commit the starting state 🖥️

```powershell
cd C:\dev\notes-app
git add -A
git commit -m "chore: scaffold Laravel and Vite applications"
```

This matters. The agent commits after every task, so a clean starting commit is what
lets you `git diff` or `git reset` back to a known-good point if a task goes wrong.

---

## Step 6b — Choose the model 🤖

From the official list at `https://antigravity.google/docs/models/`, a **Google AI Pro
(non-trial)** plan offers:

| Model | Use it for |
|---|---|
| **Claude Opus 5.5 (thinking)** | The reasoning-heavy tasks |
| **Claude Sonnet 5.5 (thinking)** | General work |
| **Gemini 3.1 Pro** (Low / High) | General work and the bulk of transcription |
| **Gemini 3.8 / 3.7 / 3.6 Flash** (Fast → High effort) | Routine, high-volume tasks |
| ~~Claude Sonnet 4.6 · Opus 4.6 · GPT-OSS-120b~~ | **Do not use — removed 2 Nov 2026** |

**Avoid the 4.6 models and GPT-OSS entirely.** They are scheduled for removal on
**2 November 2026**, which is inside the window of this build. Starting a 45-task
project on a model that disappears halfway through means switching mid-stream, and
`PRINCIPLES.md` is explicit that a task half-built by one model and finished by
another is where assumptions get silently dropped.

### The quota detail that shapes the strategy

Antigravity tracks usage as **separate budgets for Gemini and for Claude/GPT**, with
both a weekly and a five-hour limit. They do not compete. So:

**Claude Opus 5.5 (thinking)** — the 9 tasks where a plausible-looking wrong answer
costs days:

| Task | Why |
|---|---|
| `B8` | Version conflicts — the 409 contract the whole sync model rests on |
| `B17` | Revision counter and tombstones |
| `B18` | The sync pull endpoint and the full-resync guard |
| `D3` | Rust keychain commands — a language with far less training data |
| `D4` | SQLite schema, migrations and container isolation |
| `D7` | The coalescing outbox and ordered push |
| `D8` | The sync engine — push, pull, convergence |
| `D9` | The conflict queue and resolution |
| `M3` | Mobile secure storage — platform research, not transcription |

**Gemini 3.1 Pro (High)** — the other **45 tasks**. The plan already contains the
code; these need accurate instruction-following over long context, not invention.
Drop to a Flash model if you are happy with the output.

Spending each budget on what it is best at gets you roughly twice the useful work per
week, because the two quotas do not compete.

**If a task stalls three times, switch model rather than thrash.** `M1` and `M2` are
procedural but produce famously opaque toolchain errors — NDK paths, Gradle, Xcode
signing. A stronger model is better at reading those than at writing the code around
them.

### Judge it on the first three tasks

Whichever model you start with, run `B1`, `B1b` and `B2`, then check:

1. One commit per task, or did it batch them?
2. Did it write the failing test first and actually run it?
3. Is `ArchitectureTest` green **without having been edited**?
4. Did it invent any file not in the plan?

Twenty minutes, and it tells you more than any benchmark. A model that fails these on
`B2` will fail them far worse on `D7`.

### Switching models

Your choice persists for the conversation, and a change mid-run does not apply until
the current turn finishes. So **switch only between tasks, never inside one**, and
start a fresh conversation when you switch.

---

## Step 7 — Open the project in Antigravity 🤖

Open the folder `C:\dev\notes-app` — **the root**, not `backend` or `frontend`. The
agent needs to see both applications and the `docs/` folder.

---

## Step 8 — Give the agent its instructions 🤖

Paste this as the first message:

```
Build the application described in docs/SPEC.md by executing docs/PLAN.md.

Read docs/SPEC.md, docs/PLAN.md and docs/SETUP-WINDOWS.md in full before
writing any code.

Environment: Windows with Docker. PHP and MySQL run in containers.
- Every PHP and Composer command runs as `docker compose exec app <command>`.
- Node and npm run on the host, from the frontend/ directory.
- DB_HOST is `mysql`, the compose service name — never 127.0.0.1.

The backend/ and frontend/ applications ALREADY EXIST. Do not run
`laravel new`, `composer create-project` or `npm create vite`. Tasks B1 and
F1 verify and configure what is already there. If either folder is missing
or does not match the "Starting state" section of the plan, stop and tell me.

Rules:
- Work through the tasks strictly in order: B1, B1b, B2 … B15, then F1 … F19.
  Do not skip ahead or reorder.
- Each task's steps are a TDD cycle. Follow them literally: write the failing
  test, run it and confirm it fails, implement, run it and confirm it passes,
  commit. Do not write implementation before its test.
- The "Global Constraints" section applies to every task. The backend layering
  rules are not advisory: controllers contain no logic, every action is a
  single-method service under app/Services/<Domain>.
- After every backend task run
  `docker compose exec app php artisan test --filter=ArchitectureTest`.
  If it fails, move the logic into a service — never relax the test.
- Use the exact dependency versions pinned in the plan. Do not upgrade or
  substitute packages, and never add @tiptap-pro/* or CKEditor.
- MySQL 8 only. No Postgres-specific features.
- Do not invent files or endpoints that are not in the plan. If something in
  the plan is wrong or impossible, stop and tell me instead of improvising.
- Commit after each task with the message given in that task's final step.

Start with Task B1.
```

---

## Step 8b — Tag a safety point 🖥️

```powershell
git tag stage-0-start
```

Tag again at each gate:

```powershell
git tag stage-1-backend     # after B18
git tag stage-1-web         # after F15   ← the agent stops here
git tag stage-2-desktop     # after D12   ← and here
git tag stage-3-mobile      # after M8
```

A tag is a named point you can reset to without hunting for a commit hash.

**If anything goes wrong — and it will — see `docs/WHEN-IT-GOES-WRONG.md`.** It has
the detection commands, the undo for each level of damage, and copy-paste correction
prompts.

---

## Step 9 — While it works 🖥️

Check progress from your own terminal at any time:

```powershell
git log --oneline              # one commit per completed task
docker compose exec app php artisan test
docker compose logs -f app     # Laravel errors as they happen
```

Three things worth catching early:

1. **A commit per task.** If the agent is five tasks in with one commit, it is not
   following the plan. Stop it and point it back at the task list.
2. **`ArchitectureTest` staying green.** If it starts failing, logic is creeping into
   controllers. Tell it to move the logic into a service rather than change the test.
3. **Version drift.** `git diff backend/composer.json frontend/package.json` — the
   plan pins every version, and silent upgrades are where "works on my machine" starts.

If it stalls or you need to resume in a new session:

```
Continue from Task <id>. Re-read docs/PLAN.md for that task and follow its
steps exactly. Do not redo earlier tasks.
```

---

## Step 10 — Verify the finished app 🖥️

```powershell
docker compose exec app php artisan migrate:fresh --seed
docker compose exec app php artisan test

cd frontend
npx vitest run
npx playwright test
npm run dev
```

Open `http://localhost:5173` and sign in as **demo@example.com** / **password**.

Then walk the acceptance criteria in `docs/SPEC.md` §7 — particularly the five E2E
cannot check: the conflict sheet with two tabs open, starring during an in-flight
save, the tablet drawer at 800px, both colour themes, and killing the network
mid-type to confirm the draft survives a reload.

---

## Everyday commands

```powershell
docker compose up -d           # start PHP + MySQL
docker compose down            # stop (your data survives)
docker compose down -v         # stop AND delete the database
docker compose exec app php artisan <anything>
cd frontend; npm run dev       # frontend dev server
```

Add this to your PowerShell profile to save typing:

```powershell
function art { docker compose exec app php artisan @args }
# then:  art migrate     art test     art migrate:fresh --seed
```
