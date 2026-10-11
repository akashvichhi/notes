# Getting started — from scratch

> **For the developer, not the agent.** If you are the coding agent, this file is
> not for you — read `docs/START.md` and follow its read order.

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
New-Item -ItemType Directory -Force api | Out-Null
docker compose up -d --build
```

First build pulls PHP 8.3 and MySQL 8.4 and compiles extensions — a few minutes.

```powershell
docker compose ps
```

`notes-mysql` must say **healthy**. `notes-app` says **running** and sits idle,
waiting for `api/artisan` to appear. That idling is correct, not a fault.

---

## Step 3 — Create the Laravel app 🖥️

```powershell
docker compose exec app composer create-project laravel/laravel .
```

The `.` is deliberate: `/var/www/html` inside the container **is** your `api\`
folder. This also creates `.env` and generates the app key for you.

The `app` container notices `artisan` and starts serving within a couple of seconds.

---

## Step 4 — Point Laravel at MySQL 🖥️

Open `api\.env` and set these six lines:

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
npm create vite@latest web -- --template react-ts
cd web
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

### In practice, with three starting prompts

You give three prompts to *start* each stage, but **8–20 resume prompts** along the
way, because context and rate limits stop the agent repeatedly inside a stage. Every
resume is a free chance to pick a model — you are already in the selector.

**Start the very first prompt on `Claude Opus 5.5 (thinking)`.** Stage 1 contains
three of the nine hard tasks, and the early tasks are where the agent sets its
habits: if it follows the task loop at B1–B5 it tends to keep following it; if it
learns to batch commits at B3, it will batch at B40.

**Then, before each resume, spend ten seconds:**

> Which task is next?
> One of the nine → **Opus 5.5 (thinking)**.
> Anything else → whichever budget has room, **Gemini 3.1 Pro (High)** by preference.

**When the Claude weekly limit runs out**, resume on Gemini and carry on — that is
what the separate quotas are for. The one thing to protect: **do not start one of the
nine on a weaker model just because Claude is exhausted.** Wait, or do the
surrounding tasks and come back. `D7` and `D8` built on a wrong assumption cost more
than a few days of waiting.

**If you want zero decisions:** use Opus 5.5 (thinking) throughout and fall back to
Gemini only when the limit stops you. Longer in calendar time, nothing to think
about.

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

Open the folder `C:\dev\notes-app` — **the root**, not `api` or `web`. The
agent needs to see both applications and the `docs/` folder.

---

## Step 8 — Give the agent its instructions 🤖

Paste this as your first message. It restates the rules that matter most — rules in
the message carry more weight than rules in a file the agent read once.

```
Read docs/START.md in full, then docs/PRINCIPLES.md, docs/CONTEXT.md,
docs/ARCHITECTURE.md, docs/SPEC.md and docs/PLAN.md before writing any code.

Follow every ground rule in docs/START.md section 4, and work according to
docs/PRINCIPLES.md throughout — in particular: work on master only, never
create a branch or a worktree, never weaken a test to make it pass, verify
before you claim anything works, and stop and tell me rather than improvising
when something is wrong.

Execute docs/PLAN.md task by task, in order, starting with Task B1.

Nine tasks carry a "REASONING-HEAVY TASK" banner. Before starting one of
those, stop, tell me which task it is, and wait for me to say continue — I may
want to switch model first, which only I can do.

Each task's steps are a TDD cycle — follow them literally.

STOP AFTER TASK F15. That is the end of this delivery: the api and the
web application. Do not start Task D1. When F15 is committed, run the full
test suite, report what was built and how it tested, and wait for me.

Commit after EVERY task, without exception: one task, one commit, using the
exact message in that task's final step, only once that task's tests pass.
Never batch several tasks into one commit, and do not start the next task
until the previous one is committed.

Environment: Windows with Docker. Run every PHP and Composer command as
`docker compose exec app <command>`. Node runs on the host from web/.
DB_HOST is `mysql`.

The api/ and web/ applications already exist. Do not scaffold them.

Before Task B1, follow docs/START.md section 2c: make sure a git repository exists,
creating one if it does not, and set the repository-scoped git identity given
there. You commit after every task, so this must be in place first.

If anything in the plan is wrong, impossible, or contradicts
docs/ARCHITECTURE.md, stop and tell me instead of improvising.
```

**To resume** in a later session — you will do this many times, as context and rate
limits stop the agent inside a stage:

```
Continue from Task <id>. Re-read docs/PLAN.md for that task and follow its steps
exactly. Do not redo earlier tasks. Commit after every task, one commit each.
```

**To start the next stage**, once you have tested the previous one:

```
Start Phase 3. Begin at Task D1.
```

```
Start Phase 4. Begin at Task M1.
```

---

## Step 8b — Tag a safety point 🖥️

```powershell
git tag stage-0-start
```

Tag again at each gate:

```powershell
git tag stage-1-api     # after B18
git tag stage-1-web         # after F15   ← the agent stops here
git tag stage-2-desktop     # after D12   ← and here
git tag stage-3-mobile      # after M8
```

A tag is a named point you can reset to without hunting for a commit hash.

**If anything goes wrong — and it will — see `WHEN-IT-GOES-WRONG.md`.** It has
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
3. **Version drift.** `git diff api/composer.json web/package.json` — the
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

cd web
npx vitest run
npx playwright test
npm run dev
```

Open `http://localhost:5173` and sign in as **demo@example.com** / **password**.

Then walk the acceptance criteria in `docs/SPEC.md` §9 — particularly the five E2E
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
cd web; npm run dev       # web dev server
```

Add this to your PowerShell profile to save typing:

```powershell
function art { docker compose exec app php artisan @args }
# then:  art migrate     art test     art migrate:fresh --seed
```
