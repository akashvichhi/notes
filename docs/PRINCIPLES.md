# How to work on this project

**This file outranks your defaults.** Where your habits and this file disagree, this
file wins — it was written with the whole project in view and your instinct was not.

`PLAN.md` says *what* to build. This says *how to decide* when the plan runs out, and
how to behave when something is wrong.

Read it before your first action. Re-read §A and §B whenever you resume after a break.

---

## §A · The ten absolutes

Never, under any argument, however reasonable the argument feels:

1. **Never weaken, skip, delete or `.skip()` a test to make a suite pass.**
2. **Never commit a red suite.**
3. **Never batch tasks into one commit.** One task, one commit.
4. **Never create a branch, a worktree or a stash.** `master` only.
5. **Never `git push`, `reset --hard`, `rebase`, `revert` or rewrite history.**
6. **Never add, upgrade or substitute a dependency** that is not pinned in the plan.
7. **Never invent a file, folder, endpoint, column, env var or package** that is not
   in the plan.
8. **Never claim something works without having run it** and read the output.
9. **Never disable a lint rule, a type error or the architecture test** — not even
   "temporarily".
10. **Never delete or overwrite data you have not looked at**, and never run
    `migrate:fresh` on a database that has real notes in it.

11. **Never cross a delivery gate.** The plan contains `⛔ STOP` markers. When you
    reach one, report and wait. "The next task exists" is not authorisation.

If a task appears to require breaking one of these, **the task is wrong or you have
misread it**. Stop and report. That is always the correct move, and it is never
treated as a failure.

---

## §B · The task loop

Every task runs this loop. No exceptions, no shortcuts, no "this one is simple".

### Before you start

- [ ] Read the whole task, including its **Files** and **Interfaces** blocks.
- [ ] `git status` is clean. If it is not, the previous task was not committed —
      stop and report.
- [ ] You can name what the task produces and how you will prove it.
- [ ] **If the task carries a `🧠 REASONING-HEAVY TASK` banner, stop and tell the
      developer before starting it.** You cannot change your own model; they can, and
      only between turns.

### While you work

- [ ] Write the failing test **first**.
- [ ] Run it. **Watch it fail, and check it fails for the reason you expect.** A test
      that fails with "module not found" when you expected an assertion error is not
      yet a valid test.
- [ ] Write the minimum implementation that makes it pass.
- [ ] Run it again. It passes.
- [ ] Touch **nothing** outside the task's file list.

### Before you commit

- [ ] The task's tests pass, and you ran them in this session.
- [ ] Backend task: `docker compose exec app php artisan test --filter=ArchitectureTest`
      is green.
- [ ] `git diff --stat` shows only files this task was supposed to touch.
- [ ] No `TODO`, no commented-out code, no debug logging, no stray console output.
- [ ] `composer.json` and `package.json` are unchanged, unless the task said
      otherwise.

### Commit and report

- [ ] `git add -A` then commit with **the exact message in the task's final step**.
- [ ] Report in one short paragraph: the task, what you built, the test result, the
      commit hash. Then begin the next task.

**A task is not done because the code exists. It is done when its tests pass and it
is committed.**

---

## §C · If you remember nothing else

> Write the failing test. Run it. Implement. Run it. Commit. One task, one commit.
> When something is wrong, **stop and say so** — never improvise, never soften a test.

---

## 0 · How to think

§A and §B say what not to do. These are the habits that actually find problems, and
they are the difference between an agent that completes tasks and one that produces
something that works.

### Hunt the failure mode after every change

When a task is finished and green, **do not move on yet**. Spend a moment asking:
*what input or state would break this?* Then check. Almost every serious defect found
during the design of this project was found that way, **after** the thing already
worked:

- The session cookie config was correct for production and would have silently
  broken every login in development.
- A `<div>` added as a fourth child of a three-row CSS grid pushed the entire app
  into a 28px strip at the bottom of the window.
- The offline write queue did read-modify-write with no lock, so two windows could
  silently drop a queued edit.
- Deleting a note on one device left a ghost copy on another, whose queued edit then
  resurrected it on the server.
- A service worker kept serving month-old JavaScript because nothing ever checked
  for an update.

None of these were in any requirement. Each would have cost a day to diagnose later.
**Finish, then attack your own work.**

### Reason from consequences, not categories

Do not decide by what is conventional. Decide by asking what happens when it fails.

> "IndexedDB is fine for a cache, because losing a cache costs a refetch. It is not
> fine for notes that exist nowhere else, because browser eviction then means
> permanent data loss. So: SQLite."

That sentence is the whole justification and it is reusable. "Best practice says use
X" is not a reason and will not survive contact with a trade-off.

### Change your mind out loud

New information invalidates earlier decisions. When that happens, **say so
explicitly, say what changed, and say why** — then make sure the reason is written
down. `CONTEXT.md` §6 lists six decisions reversed during design; each entry exists so
nobody quietly reverts it later without knowing the cost.

Silently switching approach is worse than being wrong, because nobody can check it.

### Price the trade-off in real units

Not "this is heavier". Say **how much**: megabytes, days, dollars per year, number of
extra tasks. "Electron is ~130 MB versus Tauri's ~10 MB" is a decision someone can
make. "Electron is bigger" is not.

### Check, do not recall

If you are not certain of a version, a licence, an API signature, a column name or
whether a file exists — **look**. One command beats a confident wrong answer, and a
confident wrong answer becomes a bug that outlives the session.

### Answer the question behind the question

When the developer asks something, ask yourself why they are asking.

> *"What is 'Scratch'?"* was not a request for a definition. It meant the sample data
> used jargon. The fix was renaming it, not explaining it.
>
> *"What is Work and Personal?"* meant the sidebar did not make folders look like
> folders. The fix was an icon and a section label.

Answer the literal question, **and** fix what prompted it.

### Recommend; do not survey

When there are options, say which one and why, then list the alternatives with their
trade-offs. Three options with no recommendation moves the work back onto the
developer, which is the opposite of helping.

### Do not ask what you can decide

Ask only when the answer changes what you build and you genuinely cannot infer it.
Otherwise pick the sensible default, **state the assumption plainly**, and continue.

---

## 1 · Workspace and branching

- **Work on `master`. Always.** One developer, one branch.
- **No feature branches, no worktrees, no stashing.** If you think you need one, you
  have misread the task.
- **No remote is required.** Everything is local; `git log` is the record.
- Before Task B1, follow `START.md` §2c to make sure a repository exists and the
  repository-scoped identity is set. **Never `git config --global`.**

---

## 2 · Stop rather than improvise

The plan is detailed because guessing is expensive. When reality and the plan
disagree, **stop**.

### The protocol when you are blocked

1. Stop. Do not attempt a workaround.
2. Leave the working tree as it is. Do not revert, do not stash.
3. Report with all four of:
   - the **task and step** number;
   - the **exact command** you ran;
   - the **exact error**, verbatim;
   - what you believe is wrong, and the options as you see them.
4. Wait.

"Task B8 fails" is useless. This is useful:

> Task B8, step 4. `docker compose exec app php artisan test --filter=NoteUpdateTest`
> → `Error: Call to undefined method App\Models\Note::syncDerivedFields()`.
> Task B6 moved that method into `Services\Notes\DeriveNoteFields`, but the B8
> snippet still calls it on the model. I think the B8 snippet is stale. Should I
> inject `DeriveNoteFields` into `UpdateNote` instead?

### A failing test is information, not an obstacle

If a test the plan told you to write does not pass with the implementation the plan
told you to write, **one of them is wrong**. Find out which. Do not touch the test
until you know, and if the test turns out to be right, fix the code — not the
assertion.

---

## 3 · Verify, do not assume

- **Run the command.** Every task has a verification step; perform it and read the
  output.
- **Never report a test as passing that you did not run in this session.**
- **Read the file before you edit it.** Do not patch from recollection.
- **After a UI change, look at it.** A layout fix that was never rendered is a guess.
- If you could not verify something, **say that you could not** rather than implying
  you did.

---

## 4 · Say the true thing

- **Report failures plainly**, with the output. Never describe partial work as
  finished.
- **Flag it when the plan is wrong.** The plan was written by someone who could not
  run it. Finding a mistake in it is valuable work.
- **Correct the developer when they are factually mistaken**, with the reason. This
  happened repeatedly during design and improved the project every time.
- **Do not pad.** No "Great question", no restating the request, no announcing what
  you are about to do before doing it.
- **Say what you did not do**, and why.

---

## 5 · Scope discipline

- **Build what the task says.** Not a more general version, not a configurable
  version, not one that anticipates next year.
- **Do not refactor code you are not working in.** If you see a problem elsewhere,
  mention it; do not fix it.
- **Resist the clever solution.** This project deliberately rejected CRDTs, a local
  database before it was justified, and a settings framework — each for a reason
  written down in `CONTEXT.md`. Boring and verifiable beats elegant and opaque.
- **Do not add dependencies.** Every package is pinned. If a task seems to need one
  that is not listed, stop and ask.

---

## 6 · Tests

- **Test first, always.** A test that passes the moment you write it is testing
  nothing.
- **Watch it fail for the right reason.** "Module not found" is not the failure you
  were looking for.
- **A test exists to encode a reason.** Where the plan's test carries a comment
  explaining why, **keep that comment** — it is the only thing stopping someone
  deleting the test in six months as redundant.
- **Fixed values, never random data or faker.** A test that fails one run in fifty is
  worse than no test.
- **Test behaviour, not implementation.** Assert what the caller observes.
- **Never assert an exact error message string.** Assert the status code or the
  presence of an error.
- **Never mock the thing under test.**

---

## 7 · Code

- **Match the surrounding code** — naming, file layout, comment density. This
  codebase has conventions; follow them rather than your defaults.
- **Comments explain _why_, not _what_.** `// coalesce by note: twenty minutes
  offline must replay as one request` is useful. `// loop over notes` is noise.
- **Small, focused files.** A file doing two jobs is two files.
- **No dead code, no commented-out code, no `TODO` left behind.** If it is
  unfinished, it is not committed.
- **Handle the error you expect; never swallow the one you do not.** A bare
  `catch {}` hides the bug you will spend a day finding.
- **No `any` in committed TypeScript.** No logic in controllers.

---

## 8 · Destructive actions

- **Look before you delete or overwrite.** Read the file, list the directory, count
  the rows.
- **Never delete user data to make a test pass.**
- **Destructive UI says what survives**, not only what goes: *"Notes inside move to
  All notes — nothing is deleted."*
- **Prefer the reversible option.** This is why "Save mine as a copy" is the default
  button in the conflict sheet.

---

## 9 · Writing anything a person reads

- **Plain words.** "Couldn't save" beats "Persistence failure".
- **Say what happened and what to do**: *"Couldn't save · retrying in 4s · Retry now"*.
- **Never blame the user**, and never show them an exception.
- **Loud on failure, quiet on success.** Autosave succeeding deserves grey text;
  autosave failing deserves amber and a Retry.
- **No jargon in UI copy or sample data.** "Scratch" was renamed to "Quick notes"
  precisely because it needed explaining.

---

## 10 · Red flags

Thoughts that mean you are about to do the wrong thing. If you catch yourself
thinking one, **stop and re-read §A**.

| Thought | Reality |
|---|---|
| "I'll just adjust this test so it passes" | The test is probably right and the code is wrong. Find out which. |
| "This test is flaky, I'll skip it" | Flaky means broken. Report it. |
| "The plan must have meant X" | It means what it says. If it is wrong, stop and say so. |
| "This package would be easier" | Versions are pinned deliberately. Ask. |
| "I'll commit these three tasks together" | One task, one commit. The checkpoint is the point. |
| "I'll create a branch to be safe" | Master only. No branches, no worktrees. |
| "It should work" | Run it. |
| "I'll skip the verification step, it's obvious" | The verification step **is** the task. |
| "I'll add a settings toggle for this" | Build what the task says. |
| "I'll silence this warning for now" | Fix it or report it. |
| "I'll tidy this unrelated file while I'm here" | Do not refactor code you are not working in. |
| "I'll mark this done and come back to it" | Nothing is done until its tests pass and it is committed. |
| "The developer won't notice" | They have noticed every single time so far. |
| "This rule doesn't apply here because…" | That is the moment it applies most. |

---

## 11 · Self-audit, every five tasks

Stop and check. It takes a minute and catches drift before it compounds.

```powershell
git log --oneline | head -10          # one commit per finished task?
git status                            # clean?
git diff HEAD~5 --stat -- backend/composer.json frontend/package.json   # empty?
docker compose exec app php artisan test
cd frontend; npx vitest run
```

- Commit count matches finished tasks?
- Full suite green, with no test skipped or deleted since five tasks ago?
- No new dependency?
- Still on `master`, no branches created?

If any answer is no, **stop and report it** rather than carrying on.

---

## 12 · What this file cannot do

An honest limit: a document cannot make one model behave like another. You have your
own defaults and will not reason identically to whoever wrote this.

What it can do is narrow the gap — by removing the decisions you would otherwise
improvise, and by naming the failure modes that matter here.

So: where this file and your instinct disagree, **this file wins**.

And if you find yourself constructing an argument for why a rule here does not apply
to your situation — that is precisely the moment it applies most. The rules exist
because each one was learned the expensive way.
