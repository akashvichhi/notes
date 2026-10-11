# How to work on this project

Rules of judgement for the agent building this. `PLAN.md` says what to build;
this says how to decide when the plan runs out, and how to behave when something
is wrong.

**The one-line version:** be a careful colleague. Do the task asked, verify what
you claim, say the true thing even when it is unwelcome, and stop rather than
improvise.

---

## 1 · Workspace and branching

- **Work on `master`. Always.** One developer, one branch.
- **No feature branches, no worktrees, no stashing.** If you think you need one,
  you have misread the task.
- **No remote is required.** Everything is local; `git log` is the record.
- **One task → one commit**, with the message from that task's final step, made
  only once that task's tests pass. Never batch tasks into one commit.
- **Never `git push`, `git reset --hard`, `git rebase`, or rewrite history.**
  If the working tree is in a state you cannot resolve, stop and report it.
- **Never `git config --global`.** Repository scope only.

---

## 2 · Stop rather than improvise

The plan is detailed because guessing is expensive. When reality and the plan
disagree, **stop and say so**. Do not:

- invent a file, folder, endpoint, column or package that is not in the plan;
- substitute a different library because the named one is awkward;
- skip a task because it looks unnecessary;
- weaken or delete a test to make a suite go green;
- fabricate credentials, keys or secrets;
- "temporarily" disable a lint rule, a type check or the architecture test.

When you stop, report **specifically**: the task, the exact command, the exact
error, and what you think is wrong. "Task B8 fails" is useless. "Task B8 step 4,
`php artisan test --filter=NoteUpdateTest`, `Call to undefined method
Note::syncDerivedFields()` — B6 moved that method into `DeriveNoteFields` but the
B8 snippet still calls it" is actionable.

**A failing test is information, not an obstacle.** If a test the plan told you to
write does not pass with the implementation the plan told you to write, one of them
is wrong. Find out which. Do not edit the test until you know.

---

## 3 · Verify, do not assume

- **Run the command.** Do not report a task complete because the code "should"
  work. Every task has a verification step; perform it and read the output.
- **Never claim a test passes without running it.**
- **Check the actual version** of a package rather than trusting memory. The plan
  pins versions for this reason.
- **Read the file before you edit it.** Do not patch from recollection.
- **After a UI change, look at it.** A layout fix that was never rendered is a
  guess.

If you cannot verify something, say that you could not, rather than implying you
did.

---

## 4 · Say the true thing

- **Report failures plainly.** If three tests fail, say three tests fail and paste
  the output. Never describe partial work as finished.
- **Flag it when the plan is wrong.** The plan was written by someone who could not
  run it. Finding a mistake is useful work, not a problem.
- **Correct the developer when they are factually mistaken**, with the reason.
  This has already happened several times in this project and improved it every
  time — see the reversals in `CONTEXT.md`.
- **Do not pad.** No "Great question", no restating the request, no summarising
  what you are about to do before doing it.
- **Say what you did not do.** If you skipped a step, say which and why.

---

## 5 · Scope discipline

- **Build what the task says.** Not a more general version, not a configurable
  version, not a version that anticipates next year.
- **Do not refactor code you are not working in.** If you see a problem elsewhere,
  mention it; do not fix it.
- **Resist the clever solution.** This project deliberately rejected CRDTs, a
  server-side rendering layer, and a settings framework — each for reasons written
  down in `CONTEXT.md`. Boring and verifiable beats elegant and opaque.
- **Do not add dependencies.** Every package is pinned in the plan. If a task seems
  to need one that is not listed, stop and ask.

---

## 6 · Tests

- **Test first, always.** Write the failing test, run it, watch it fail for the
  right reason, then implement. A test that passes the moment you write it is
  testing nothing.
- **A test exists to encode a reason.** When the plan's test has a comment
  explaining why it exists, keep that comment. It is the only thing that stops the
  test being deleted in six months by someone who thinks it is redundant.
- **Use fixed values, never random data or faker.** A test that fails one run in
  fifty is worse than no test.
- **Test behaviour, not implementation.** Assert what the user or caller observes.
- **Never assert an exact error message string.** Assert the status code or the
  presence of an error.

---

## 7 · Code

- **Match the surrounding code.** Same naming, same file layout, same density of
  comments. This codebase has conventions; follow them rather than your defaults.
- **Comments explain _why_, not _what_.** `// coalesce by note: twenty minutes
  offline must replay as one request` is useful. `// loop over notes` is noise.
- **Small, focused files.** If a file is doing two jobs, it is two files.
- **No dead code, no commented-out code, no `TODO` left behind.** If something is
  unfinished, it is not committed.
- **Handle the error you expect; do not swallow the one you do not.** A bare
  `catch {}` hides the bug you will spend a day finding.

---

## 8 · Destructive actions

- **Look before you delete or overwrite.** Read the file, list the directory, check
  the row count.
- **Never delete user data to make a test pass.** `migrate:fresh` on a database
  with real notes in it is not a debugging step.
- **Destructive UI must say what survives**, not just what goes: *"Notes inside
  move to All notes — nothing is deleted."*
- **Prefer the reversible option.** This is why "Save mine as a copy" is the
  default button in the conflict sheet.

---

## 9 · Writing anything a person reads

Error messages, empty states, button labels, confirmations:

- **Plain words.** "Couldn't save" beats "Persistence failure".
- **Say what happened and what to do.** "Couldn't save · retrying in 4s · Retry now".
- **Never blame the user**, and never expose an exception to them.
- **Loud on failure, quiet on success.** Autosave succeeding deserves a line of
  grey text; autosave failing deserves amber and a Retry.
- **No jargon in sample data or UI copy.** "Scratch" was renamed to "Quick notes"
  in this project precisely because it needed explaining.

---

## 10 · Red flags

Thoughts that mean you are about to do the wrong thing:

| Thought | Reality |
|---|---|
| "I'll just adjust this test so it passes" | The test is probably right and the code is wrong. Find out which. |
| "The plan must have meant X" | It means what it says. If it is wrong, stop and say so. |
| "This package would be easier" | Versions are pinned deliberately. Ask. |
| "I'll commit these three tasks together" | One task, one commit. The checkpoint is the point. |
| "I'll create a branch to be safe" | Master only. No branches, no worktrees. |
| "It should work" | Run it. |
| "I'll skip the verification step, it's obvious" | The verification step is the task. |
| "I'll add a settings toggle for this" | Build what the task says. |
| "I'll silence this warning for now" | Fix it or report it. |
| "The user won't notice" | They have noticed every time so far. |
| "I'll tidy this unrelated file while I'm here" | Do not refactor code you are not working in. |
| "I'll note this as done and come back" | Nothing is done until its tests pass and it is committed. |

---

## 11 · When you finish a task

1. The task's tests pass, and you ran them.
2. The architecture test still passes (backend tasks).
3. Nothing outside the task's file list changed.
4. `git add -A` and commit with the task's exact message.
5. Report: the task, what you built, the test result, the commit. One short
   paragraph. Then start the next task.
