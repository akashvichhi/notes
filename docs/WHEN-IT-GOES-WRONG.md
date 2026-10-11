# When it goes wrong

For **you**, not the agent. How to spot trouble early, undo it cleanly, and correct
course without losing good work.

Run everything here from the repository root in PowerShell.

---

## 0 · Insurance, before you start

Two minutes now saves an afternoon later.

```powershell
git tag stage-0-start
```

Tag at each checkpoint as you go:

```powershell
git tag stage-1-backend     # after B18
git tag stage-1-web         # after F15
git tag stage-2-desktop     # after D12
```

A tag is a named point you can return to without hunting through hashes.

**And know your safety net:** even after a `reset --hard`, nothing is really gone for
about 90 days.

```powershell
git reflog            # every HEAD you have ever been at
git reset --hard <sha-from-reflog>
```

---

## 1 · Spotting it early

Run this after every session. It takes fifteen seconds.

```powershell
git log --oneline | head -20
git status
git branch                                   # must be master only
docker compose exec app php artisan test
cd frontend; npx vitest run; cd ..
```

| Symptom | What it means |
|---|---|
| Fewer commits than finished tasks | It batched. Work is unreviewable |
| `git status` not clean | A task was left uncommitted |
| A branch other than `master` | It ignored the rules |
| Test count **dropped** | A test was deleted or skipped |
| `ArchitectureTest` modified | Logic went into controllers and it edited the test instead |
| `composer.json` / `package.json` changed unexpectedly | A dependency was added |
| Files changed outside the task's list | Scope creep |

The two that matter most:

```powershell
# Did any test disappear?
git diff stage-1-backend --stat -- backend/tests frontend/src/**/*.test.*

# Did any dependency appear?
git diff stage-1-backend -- backend/composer.json frontend/package.json
```

---

## 2 · Undoing, by how bad it is

### It is wrong and not yet committed

```powershell
git restore .                      # discard all uncommitted changes
git clean -fd                      # and remove files it created
```

Then re-run the task with a correction prompt from §3.

### One bad commit, nothing after it

```powershell
git reset --hard HEAD~1
```

### Several bad commits

```powershell
git log --oneline | head -20       # find the last good commit
git reset --hard <sha-of-last-good-commit>
```

### A commit with good and bad work mixed in

Do not try to untangle it. Reset to before it and redo that task — it is one task,
and redoing it is faster than surgery.

### It drifted for a dozen tasks and you only just noticed

```powershell
git reset --hard stage-1-backend   # or whichever tag is before the drift
```

Painful, but the alternative is a codebase where you do not know which parts were
tested. **This is why you tag at checkpoints and check after every session.**

### You reset and regret it

```powershell
git reflog
git reset --hard <sha>
```

---

## 3 · Correction prompts

Copy, paste, adjust. Each one names the rule, because the agent has the rules and
citing them works better than describing the symptom.

**It batched commits**

```
You committed several tasks together. PRINCIPLES.md §A absolute 3 requires one
task, one commit. I have reset to <sha>. Redo from Task <id>, committing after
each task with the exact message in that task's final step.
```

**It weakened or removed a test**

```
Task <id> changed a test instead of fixing the code. PRINCIPLES.md §A absolute 1
forbids this. Restore the test exactly as PLAN.md specifies, run it, and fix the
implementation so it passes. If the test is genuinely wrong, stop and explain why
rather than editing it.
```

**It added a dependency**

```
You added <package>, which is not pinned in PLAN.md. PRINCIPLES.md §A absolute 6
forbids this. Remove it and implement Task <id> with the pinned dependencies. If
that is impossible, stop and tell me why.
```

**It touched files outside the task**

```
Task <id> modified <files>, which are not in that task's Files block.
PRINCIPLES.md §5 says not to refactor code you are not working in. Revert those
changes and keep only what the task specified.
```

**It skipped or reordered tasks**

```
You are on Task <id> but Task <earlier> was never completed. Tasks run strictly
in order. Go back to Task <earlier> and work forward from there.
```

**It claimed something works without running it**

```
You reported Task <id> as passing. Run the verification step from that task now
and paste the full output. PRINCIPLES.md §3: never report a test as passing that
you did not run in this session.
```

**The output is wrong but the rules were followed**

```
Task <id> is implemented as specified but the result is wrong: <what you see>
versus <what you expect>. Do not change the test. Diagnose why the implementation
produces this, explain the cause, and propose a fix before making it.
```

**It crossed a delivery gate**

```
You started Task D1. PLAN.md has a STOP gate after F15 and PRINCIPLES.md §A
absolute 11 forbids crossing it. Reset your work on D1 and stop. I will tell you
when to begin Phase 3.
```

---

## 4 · When *you* want something different

This is not an agent error — it is a design change, and it is handled differently.

1. **Stop the agent.** Do not let it keep building on something you are about to
   change.
2. **Change the document, not the conversation.** Edit `SPEC.md` or `PLAN.md`, or ask
   me to. A correction given only in chat is forgotten the moment the context rolls
   over; a correction in the plan survives.
3. **Record *why*** in `CONTEXT.md` §6 if it reverses an earlier decision. That
   section exists so nobody quietly undoes it later.
4. **Then tell the agent:**

```
I have changed <document> — <one line on what changed>. Re-read it, then tell me
which completed tasks are affected and what needs redoing. Do not change any code
until I confirm.
```

Asking what is affected **before** it starts editing is the important part. A design
change can invalidate work from ten tasks ago, and you want that list before anyone
touches the code.

---

## 5 · Push through, or start over?

| Situation | Do this |
|---|---|
| One task wrong, rest fine | Reset that commit, redo the task |
| Tests all green, style is off | Push through. Note it, fix at the checkpoint |
| Tests were deleted or skipped | **Reset.** You no longer know what works |
| Dependency drift | Reset to before it. Versions are pinned for a reason |
| It has been improvising for several tasks | Reset to the last tag |
| The plan itself is wrong | Stop, fix the plan, then resume |

The question to ask: **do I still trust the tests?** If yes, push through. If no,
reset — a green suite you cannot trust is worse than a red one.

---

## 6 · If it keeps going wrong

Three failed corrections on the same task is a signal, not bad luck.

1. **Re-paste the rules.** Give it `PRINCIPLES.md` §A and §B directly in the message.
2. **Start a fresh conversation.** Long sessions drift; context loss is usually the
   cause.
3. **Switch model** for that task — the reasoning-heavy ones (B8, B17, B18, D3, D4,
   D7–D9) are where a weaker model struggles.
4. **Shrink the task.** Tell it to do only steps 1–3 and stop.
5. **Suspect the plan.** If three attempts all fail the same way, the task is
   probably wrong. Stop and have it fixed rather than forcing it through.

---

## 7 · The one-minute habit

After every session:

```powershell
git log --oneline | head -10
git status
```

Commits match finished tasks, working tree clean. If both are true, you are fine. If
either is not, read §1 before letting it continue.

Catching drift one session late costs a reset of one session. Catching it ten
sessions late costs ten.
