# Common rules

Rules for AI agents and humans working in this project, whatever the part of the code. **MUST** and **NEVER** are hard rules; everything else is the strong default. The project's `CLAUDE.md` files may add rules or override one explicitly, with the reason.

Each part of the project (each app folder) has its own stack rules file next to this one. Where this file says "the stack rules name it", that file's **Paths and commands** table gives the exact file, folder, or command.

---

## Design
- **MUST** follow DRY: every piece of knowledge (a rule, a constant, a message, a type) has exactly one home. Extract a shared function, hook, or component the second time the same logic appears. Don't build abstractions for reuse that might happen later.
- **One job per unit:** one reason to change per file, class, or function. Code that handles requests or input, business rules, data access, and rendering live in separate layers (the stack rules name them).
- **Extend, don't edit chains:** add behaviour by adding code (a new filter, a new strategy) instead of growing `if/else` chains.
- **Small interfaces:** focused parameters and constructor arguments; no "god" objects.
- **Inject dependencies:** depend on what is passed in (constructor arguments, the framework's dependency injection, function parameters), not on module-level globals. That makes everything testable.
- Keep it simple. Build only what the project's requirements ask for. No features or configuration options nobody requested.

## Organisation and readability
- **MUST** keep each file in the folder of its layer (see the stack rules). If it's unclear where a file belongs, the structure is wrong; fix the structure.
- File and folder names are **snake_case** (`employee_service`, `employee_table`), unless the stack rules say otherwise, with the reason.
- Functions are small and do one thing. Prefer early returns over nested `if`s.
- No magic numbers or strings: put them in named constants.
- Names describe intent (`calculateAverageSalary`, not `calc`). No abbreviations except well-known ones (`id`, `url`, `api`).
- Comments explain *why*, never *what*. No commented-out code, no dead code, no TODO without context.
- Everything is typed, with the stack's strictest practical checking (the stack rules name it). **NEVER** use the language's "anything" type (`any`, untyped `dict`, `Any`) for domain data.

## Data
- **NEVER** use floats for money. The side that owns the data uses an exact decimal type and does all arithmetic; the wire format is a decimal **string** (`"85000.00"`); clients only format it.
- Dates and times are ISO 8601 strings on the wire (`2026-10-31`, `2026-01-01T14:30:00+05:30`).
- The app's time zone and display formats are **one constant per app**, in the file the stack rules name. **NEVER** depend on the server's, browser's, or device's local time zone. The project's `CLAUDE.md` states which zone and formats it uses.
- **Soft delete:** if a table uses soft delete, every query on it goes through **one** helper that applies the filter (e.g. `active_employees()`), including counts, aggregates, option lists, and uniqueness checks. A direct query on that model without the helper is a bug.

## Security, privacy, and configuration
- **NEVER** commit secrets, `.env` files, local settings files, signing keys, or database files. Commit an example file (`.env.example` or the stack's equivalent) listing every variable.
- Configuration is read in **exactly one place** per app (the stack rules name it).
- **Personal data:** **NEVER** log names, emails, salaries, or other personal data, or request/response bodies that contain them. Logs may contain IDs, routes, status codes, and timings only. Error messages never echo personal data back.
- **NEVER** show stack traces, SQL, file paths, or other internals to users.

## Dependencies
- Lock files are **always committed**, and installs use them (the stack rules name the lock file and the install command).
- Pin exact versions; no `latest`, no ranges.
- Add a library only when it clearly beats a few lines of our own code. Every new runtime dependency gets a one-line reason in `docs/decisions.md`.
- Hold a tool back when its plugins don't support the newest major yet, and record why in `docs/decisions.md`.

## Docs
- A significant design decision or trade-off gets an ADR-style entry in `docs/decisions.md`: context, options considered, decision, consequences. Number the entries; code comments and reviews refer to them ("decision 16").
- Behaviour or setup changes update `README.md` or `docs/architecture.md` in the same commit.
- Performance claims are proven with measured numbers in `docs/performance.md`, never guesses. Update them when a change affects them.
- Tooling config files (the stack rules list them) are the source of truth for tooling. **NEVER** copy their contents into `CLAUDE.md` or docs; link to them, and explain only rules whose reason isn't obvious.

## Testing
- **Test first (TDD):** write a failing test, make it pass, then refactor.
- Tests are fast, deterministic (no network, no real clock, fixed random seeds), independent, and named after the behaviour they check.
- While working, run only the tests related to the change (the stack rules show how to run one test file).

## Quality checks
- Run the full checks **once, when the work is finished and before committing**, not after each edit. Run only the check command of each part the change touched (the stack rules name it).
- If a check fails, fix it and run the full check again.
- Coverage is enforced, not just reported: the check fails below the project threshold (default 90%). Keep the threshold in the check command, not in the test runner's default options, so running a single test file doesn't fail on coverage.
- **Definition of done:** all checks pass, docs are updated if behaviour changed, and any project-specific log (e.g. `docs/ai-workflow.md`) is written.

## Commits
- **One commit = one logical change.** Never mix a feature, a refactor, and a formatting change.
- **The TDD rhythm is visible in the history** for every behaviour:
  1. `test(employees): add failing test for duplicate email` (red)
  2. `feat(employees): reject duplicate email` (green)
  3. `refactor(employees): extract email normaliser` (only when there's something to refactor)
- A red commit is allowed only when the green commit follows it directly. **NEVER** push a branch whose last commit fails the checks.
- **Message format** (Conventional Commits):
  ```
  <type>(<scope>): <summary in imperative mood, lowercase, no full stop, max 72 chars>

  <optional body: WHY the change was made, not what; wrap at 72>
  ```
  - Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore` (tooling, deps, config), `perf`, `style` (formatting only).
  - Scopes: the app folder (the stack rules name it) or a feature (`employees`, `auth`), optionally combined, e.g. `feat(<app>/employees): add salary filter`.
- **Stage files explicitly** (`git add <path> <path> ...`). **NEVER** `git add .` or `git add -A` without checking `git status` first.
- **NEVER commit** secrets, local settings, signing keys, database files, dependency folders, build output, caches, or coverage output (the stack rules list the exact paths). They go in `.gitignore` before the first commit that adds code or config.
- `.gitattributes` forces LF line endings (`* text=auto eol=lf`).
- Docs change in the same commit as the behaviour they describe (or in a `docs:` commit right after it).

### AI agents: approval before every commit and push
- **AI agents NEVER commit or push without the user's explicit approval.** For each commit:
  1. Finish the change (for a red commit: the failing test only).
  2. Stop and show the files changed, a short summary of what and why, the proposed commit message, and the check results (for a red commit: the failing test output).
  3. Wait. If the user gives more instructions, apply them and show the result again.
  4. Commit only after the user says so ("commit", "looks good, commit"). Approval covers that one commit only.
- Red and green commits are proposed and approved separately, in that order.
- Pushing needs its own explicit approval, every time.

## Code review
- Review changes with the `code-review` skill before asking for commit approval on anything non-trivial.
