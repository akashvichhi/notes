# CLAUDE.md: Notes

A web notes app: a React single-page app on a Laravel API with MySQL, plus an MCP server for AI assistants. The app is web-only (decision 1). Design lives in `docs/ARCHITECTURE.md` and `docs/SPEC.md`.

These rules apply to AI agents and humans working anywhere in this repo. **MUST** and **NEVER** are hard rules; everything else is the strong default. Frontend rules are in `web/CLAUDE.md`; API rules are in `api/CLAUDE.md`.

## Repo layout

```
notes-app/
├── api/            Laravel API (MySQL); also serves the web build from api/public
├── web/            React app (TypeScript + Vite + Mantine)
├── docs/           architecture, spec, decisions
└── CLAUDE.md
```

## Project facts
- **Personal data:** account names and emails, note titles and bodies, folder and tag names.
- **Soft-deleted tables:** notes (Trash, `deleted_at`).
- **Time:** timestamps are shown in the user's device time zone, because notes are personal and "edited 9:14" must mean the user's 9:14. That choice lives in one constant (`web/src/constants/time_constants.ts`); nothing else reads the zone.
- **Deployment:** every push to `master` deploys to the VPS through GitHub Actions once the checks pass (decision 6), so pushing `master` is a release. `npm run release` in `web/` still builds into `api/public`, commits everything as "Prod: release" and pushes `master`. Run either only when the user asks.

---

## Design
- **MUST** follow DRY: every piece of knowledge (a rule, a constant, a message, a type) has exactly one home. Extract a shared function, hook or component the second time the same logic appears. Don't build abstractions for reuse that might happen later.
- **One job per unit:** one reason to change per file, class or function. Controllers handle HTTP, services hold business rules, API modules call endpoints, UI components render.
- **Extend, don't edit chains:** add behaviour by adding code (a new filter, a new strategy) instead of growing `if/else` chains.
- **Small interfaces:** focused props and constructor arguments; no "god" objects.
- **Inject dependencies:** depend on what is passed in (constructor arguments, hook parameters, Laravel's container), not on module-level globals.
- Keep it simple. Build only what the spec asks for. No features or configuration options nobody requested.

## Organisation and readability
- **MUST** keep each file in the folder of its layer (see `web/CLAUDE.md` and `api/CLAUDE.md`). If it's unclear where a file belongs, the structure is wrong; fix the structure.
- Frontend file and folder names are **snake_case** (`note_row.tsx`). The API follows Laravel's conventions.
- Functions are small and do one thing. Prefer early returns over nested `if`s.
- No magic numbers or strings: put them in named constants.
- Names describe intent (`countWords`, not `cnt`). No abbreviations except well-known ones (`id`, `url`, `api`, `uuid`).
- Comments explain *why*, never *what*. No commented-out code, no dead code, no TODO without context.
- Everything is typed: TypeScript `strict: true`, PHP with parameter and return types. **NEVER** use `any` for domain data.

## Data
- Dates and times are ISO 8601 strings on the wire (`2026-10-31T14:30:00+05:30`).
- **Soft delete:** every query on notes goes through **one** helper that applies the Trash filter, including counts, option lists and uniqueness checks. A direct query without it is a bug.
- Note bodies are ProseMirror JSON and are opaque to every layer except the editor: nothing renames, reorders or rewrites their keys.

## Security, privacy and configuration
- **NEVER** commit secrets, `.env` files or database files. Commit a `.env.example` listing every variable.
- Configuration comes from environment variables, read in **exactly one place** per app (`api/config/*.php` via `env()`, `web/src/config/env.ts`).
- The browser authenticates with the Sanctum session in an **httpOnly cookie**; JavaScript never sees it. Personal access tokens exist only for MCP clients.
- **Personal data:** **NEVER** log names, emails, note titles or bodies, or request/response bodies that contain them. Logs may contain IDs, routes, status codes and timings only. Error messages never echo personal data back.
- **NEVER** show stack traces, SQL, file paths or other internals to users.

## Dependencies
- Lock files are **always committed** (`api/composer.lock`, `web/package-lock.json`), and installs use them (`composer install`, `npm ci`).
- Pin exact versions; no `latest`, no ranges.
- Add a library only when it clearly beats a few lines of our own code. Every new runtime dependency gets a one-line reason in `docs/decisions.md`.
- Hold a tool back when its plugins don't support its newest major yet, and record why next to its version.

## Docs
- A significant design decision or trade-off gets a numbered entry in `docs/decisions.md`: context, options considered, decision, consequences. Code comments and reviews refer to them ("decision 2").
- Behaviour or setup changes update `README.md` or `docs/ARCHITECTURE.md` in the same commit.
- Performance claims are backed by measured numbers, never guesses.
- Config files (`package.json`, `eslint.config.js`, `stylelint.config.js`, `tsconfig*.json`, `vite.config.ts`, `composer.json`, `phpunit.xml`) are the source of truth for tooling. **NEVER** copy their contents into `CLAUDE.md` or docs; explain only rules whose reason isn't obvious.

## Testing
- **Test first (TDD):** write a failing test, make it pass, then refactor.
- Tests are fast, deterministic (no network, no real clock, fixed random seeds), independent, and named after the behaviour they check.
- While working, run only the tests related to the change (`npx vitest run src/utils`, `php artisan test --filter=NoteTest`).

## Quality checks
- Run the full checks **once, when the work is finished and before committing**, only for the side(s) the change touched:
  - Frontend: `npm run check` in `web/` (ESLint, Stylelint, type check, tests)
  - API: the checks listed in `api/CLAUDE.md`
- If a check fails, fix it and run the full check again.
- **Definition of done:** all checks pass and docs are updated if behaviour changed.

## Commits
- **One commit = one logical change.** Never mix a feature, a refactor and a formatting change.
- **The TDD rhythm is visible in the history:** `test(...)` (red), then `feat(...)` / `fix(...)` (green), then `refactor(...)` only when there's something to refactor. A red commit is allowed only when the green commit follows it directly. **NEVER** push a branch whose last commit fails the checks.
- **Message format** (Conventional Commits): `<type>(<scope>): <imperative summary, lowercase, no full stop, max 72 chars>`, with an optional body explaining *why*, wrapped at 72.
  - Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `perf`, `style`.
  - Scopes: `api`, `web`, or a feature (`notes`, `mcp`, `auth`), e.g. `feat(web/notes): add word count`.
- AI-assisted commits end with a `Co-Authored-By:` trailer naming the AI tool.
- **Stage files explicitly.** **NEVER** `git add .` or `git add -A` without checking `git status` first. (`npm run release` is the one deliberate exception.)
- **NEVER commit:** `.env` files, database files, `node_modules/`, `vendor/`, `.venv/`, coverage output. They are in `.gitignore`.
- `.gitattributes` forces LF line endings (`* text=auto eol=lf`).

### AI agents: approval before every commit and push
- **AI agents NEVER commit or push without the user's explicit approval.** For each commit: finish the change, show the files changed, a short summary, the proposed message and the check results, then wait. Approval covers that one commit only.
- Red and green commits are proposed and approved separately, in that order.
- Pushing, and running `npm run release` or `npm run deploy`, each need their own explicit approval every time.
