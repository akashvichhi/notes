# Decisions

Numbered, ADR-style. Code comments and reviews refer to them ("decision 1").

## 1. The app is web-only

The sign-in part is superseded by decision 10: the browser uses the API's own server-side session.

- **Context:** the app was planned to ship as a web app and as Tauri apps for desktop and mobile, with a local SQLite copy, an "On This Device" container, a sync engine and bearer tokens kept in the OS secure store. Only the web app is in use.
- **Options:** keep the native code in the repository; remove it and keep one build.
- **Decision:** remove the native shell (`web/src-tauri`), the local database, the sync engine, the platform layer, the On This Device container and the device sign-in tokens (`POST /tokens`, `DELETE /tokens/current`). The browser signs in with the Sanctum session cookie only.
- **Consequences:** every note lives on the server. Unsaved typing is still buffered in IndexedDB (`db/drafts_store.ts`). Personal access tokens for the MCP server are the only tokens the API issues.

## 2. The web build is written into Laravel's public folder

Superseded by decision 9.

- **Context:** Laravel serves the SPA (`routes/web.php` falls back to `index.html`), so the built files must be in `api/public`.
- **Options:** copy `dist/` in a deploy step; build straight into `api/public`.
- **Decision:** `vite build` writes to `../api/public` with `emptyOutDir: false`, so `index.php` and Laravel's own files stay. `npm run clean` removes only `assets/` and `index.html` before a production build.
- **Consequences:** the release commit includes the build output.

## 3. Error boundaries use react-error-boundary

- **Context:** no JavaScript error may leave the user on a blank screen, so the app needs boundaries at the root, app, route and editor levels. React has no hook form of a boundary; it takes a class component.
- **Options:** our own class component; `react-error-boundary` (6.1.6).
- **Decision:** `react-error-boundary`. It adds `resetKeys`, `onError` and a `FallbackComponent` prop, which our own class would have to rebuild and test, for a few kilobytes.
- **Consequences:** every boundary is an `ErrorBoundary` from that package; fallbacks never show the error.

## 4. Styles are SCSS modules compiled by sass

- **Context:** the styling rules keep every raw spacing, font, colour, breakpoint and layer value in token files that modules load with `@use`, and Stylelint rejects literals elsewhere. Plain CSS has no `@use` and no build-time variables.
- **Options:** CSS custom properties defined in a global sheet; SCSS with `sass` (1.107.1, dev only).
- **Decision:** SCSS. Tokens are checked at build time, a misspelt one fails the build instead of silently resolving to nothing, and mixins keep the light and dark selector lists in one place.
- **Consequences:** `sass` is a dev dependency; Vite compiles `*.scss` and resolves `@src` in `@use`. Its optional `@parcel/watcher` install script stays unapproved, because only `sass --watch` uses it.

## 5. Docker Compose runs the whole app

Superseded by decision 10.

- **Context:** the app should run on a VPS with one command and come back by itself after a crash or a reboot. Compose used to start only MySQL, and the commented-out PHP service ran `php artisan serve`, Laravel's development server. The API needs its daily scheduler (`notes:prune-pats`); nothing is queued.
- **Options:** keep `php artisan serve`; nginx in front of PHP-FPM; Caddy (2.11.6) in front of PHP-FPM.
- **Decision:** one multi-stage `docker/php/Dockerfile` builds the React app, then a PHP-FPM image with the build in `public/`, then a Caddy image. Compose runs `app` (PHP-FPM, which migrates and caches on start), `scheduler` (`schedule:work`), `web` (Caddy) and `mysql`, all with `restart: unless-stopped`. Caddy over nginx because it gets and renews the HTTPS certificate itself once `SITE_ADDRESS` is the domain, and its config is a few lines.
- **Consequences:** `docker compose up -d --build` deploys. The app reads `api/.env`; the root `.env` holds only the Compose values (`.env.example`). MySQL listens on localhost only. The images hold no dev dependencies, so tests still run on local PHP and Node.

## 6. A push to master deploys through GitHub Actions

- **Context:** the VPS runs a clone of the repo with Docker Compose (decision 5), and a deploy should need nothing more than a push.
- **Options:** pull on the server by hand; a cron job that polls the repo; a GitHub Actions workflow that connects over SSH after the checks pass.
- **Decision:** `.github/workflows/deploy.yml` runs `npm run check` and the API tests, then connects with plain `ssh` (no third-party deploy action holds the key), runs `git pull --ff-only` and `docker compose up -d --build`. The server's host keys are pinned in a secret.
- **Consequences:** a failing check blocks the deploy. The secrets `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` and `VPS_APP_DIR` must be set in the repo. Each deploy has a few seconds of downtime while containers are replaced. `npm run release` is no longer needed, because the image builds the web app itself.

## 7. Note Markdown is converted with markdown-it-py and lxml

- **Context:** the MCP tools read and write note bodies as Markdown, while the editor stores ProseMirror JSON. The conversion must accept GitHub's dialect (tables, task lists, strikethrough, autolinks) plus the inline HTML that carries what Markdown cannot say (underline, colour, alignment, details), and it must be strict about what survives.
- **Options:** a hand-written Markdown parser; markdown-it-py with its plugins, rendering to HTML that an HTML parser turns into the editor's nodes; a Markdown parser that emits an AST mapped straight to nodes.
- **Decision:** Markdown → HTML with markdown-it-py, HTML fix-ups and reading with lxml, then the document normalizer (`api/app/content/`). Inline HTML has to be parsed anyway, so going through HTML handles both forms with one set of rules. The runtime dependencies:
  - `markdown-it-py` (4.3.0): a CommonMark-compliant parser with tables and strikethrough built in.
  - `mdit-py-plugins` (0.7.0): the task-list syntax.
  - `linkify-it-py` (2.2.0): turns bare URLs into links; markdown-it-py's linkify rule needs it.
  - `lxml` (6.1.3): a fast, lenient HTML parser with a tree that can be rewritten in place.
- **Consequences:** golden fixtures in `api/tests/golden/` pin the output in both directions, so a dependency upgrade that changes a conversion fails the tests. Unsafe link and image URLs are removed after parsing rather than rejected, so their text stays.

## 8. The MCP server uses the official Python SDK, stateless, behind our own token check

- **Context:** assistants reach the notes over MCP's streamable HTTP transport at `/mcp`, authenticated by a personal access token. The protocol has versions, capability negotiation and JSON-RPC framing that a client expects to be exact.
- **Options:** implement the JSON-RPC methods by hand; the official `mcp` SDK with its session-keeping transport; the SDK in stateless mode with authentication in front of it.
- **Decision:** the SDK's `MCPServer`, served stateless with JSON responses (`api/app/mcp/`). A wrapper in front of it checks the Bearer token, its expiry and abilities, and the per-token rate limit, then hands the token to the tools in the request state. Each tool runs its service call in a worker thread on its own database session. The runtime dependency:
  - `mcp` (2.3.0): the protocol's reference server, so protocol upgrades are a version bump rather than our code.
- **Consequences:** no MCP session is kept between requests, so the single uvicorn worker holds no per-client state beyond the rate-limit counters. The SDK validates tool arguments before our code runs, and its validation errors repeat the offending value back to the caller (never to the logs).

## 9. The API serves the web build from web/dist

- **Context:** the API serves the single-page app itself (same origin, so the session cookie needs no CORS), and decision 2's build into the server's public folder put build output into the release commit.
- **Options:** keep writing into a server folder; build to `web/dist` and have the API serve that folder; a separate static server.
- **Decision:** `vite build` writes to `web/dist`, emptied on each build. The API serves `/assets/*` from it with an immutable cache header and `index.html` for every other path outside `/api` and `/mcp` (`api/app/core/frontend.py`). The Docker image builds the web app and copies `dist` in, so no build output is committed.
- **Consequences:** a release is a push of source only. Running the API locally without a build serves the API alone; the Vite dev server proxies `/api` to it.

## 10. The API is FastAPI on Postgres, run by Docker Compose

- **Context:** the app runs on a VPS with Docker (decision 5), so it is not tied to shared hosting. The API needs full-text search, text that compares without regard to case or accents, a daily cleanup of expired sessions and tokens, and one origin for the web app and the API.
- **Options:** keep the existing PHP stack; FastAPI with SQLite; FastAPI with Postgres.
- **Decision:** a FastAPI API (`api/`) on Postgres 18, synchronous SQLAlchemy with psycopg, Alembic migrations, served by one uvicorn worker. Postgres over SQLite for its generated `tsvector` column with a GIN index, ICU collations and concurrent writers. `docker/api/Dockerfile` builds the web app and the API into one image. Compose runs `app` (migrates, then serves), `scheduler` (the same image, running `scripts/prune_expired.py` every day at 23:00 India time through `docker/scripts/run_daily_at.sh`), `web` (Caddy 2.11.6, a reverse proxy that gets the HTTPS certificate) and `postgres`, all with `restart: unless-stopped`. The runtime dependencies beyond decisions 7 and 8:
  - `fastapi` (0.162.7): routing, dependency injection and request validation on Pydantic.
  - `pydantic-settings` (2.16.3): typed configuration read in one place (`app/core/config.py`).
  - `sqlalchemy` (2.1.8) and `alembic` (1.20.1): the ORM and its migrations.
  - `psycopg[binary]` (3.3.9): the Postgres driver, with prebuilt wheels.
  - `argon2-cffi` (25.1.0): password hashing.
  - `bcrypt` (5.0.0): verifies bcrypt hashes of imported accounts once, so they are rehashed to Argon2 at the next sign-in.
  - `email-validator` (2.3.0): Pydantic's `EmailStr`.
  - `tzdata` (2026.6): the IANA zone database, which Windows and slim images lack.
  - `uvicorn` (0.54.0): the ASGI server.
- **Consequences:** `docker compose up -d --build` deploys. Compose and the API read one root `.env`, copied from `.env.example` locally and from `.env.production` on the server. It holds `POSTGRES_PASSWORD`, which Compose puts into `DATABASE_URL`, and `APP_ORIGIN`, which becomes `ALLOWED_ORIGINS`. The password is never committed; the domain appears only in `.env.production`. Postgres listens on localhost only. The rate limits are counted in memory, so the API must stay at one worker. The tests need a real Postgres, locally from Compose and in CI as a service container.

## 11. A nightly database backup, uploaded with rclone

- **Context:** Postgres on the VPS holds the only live copy of every note, so losing the server or its disk would lose the data. A copy should leave the machine every day, without anyone running it.
- **Options:** the storage service's own command-line tool, which needs a background helper process; `rclone`, one program that supports many storage services and reads its whole configuration from environment variables; a script against the service's API.
- **Decision:** a `backup` container (`docker/backup/`), built on the database's own `postgres:18.4-bookworm` image so `pg_dump` always matches the server, with the `rclone` binary (1.75.2) copied from its official image: one program for the upload instead of our own API client, and the storage service is a setting, not code. Every day at 23:10 India time (`docker/scripts/run_daily_at.sh`, after the 23:00 cleanup) it writes `pg_dump --format=custom`, uploads it, and only then deletes the older backups, skipping the trash. Only the newest backup is kept; no copy stays on the VPS. The credentials sit in the root `.env` as `BACKUP_REMOTE_*` and reach only this container; the API now receives its settings by name instead of the whole file. An empty `BACKUP_REMOTE_TYPE` turns backups off.
- **Consequences:** The storage account cannot use two-factor login, because the nightly run cannot type a code, so it should be an account used only for backups. The healthcheck turns the container unhealthy when the last backup is more than 26 hours old. Restoring is written down in `docs/database_restore.md`. CI does not run the backup; it was checked by hand.

## 12. Keep 7 daily, 4 weekly and 6 monthly backups

This replaces the "only the newest backup is kept" part of decision 11.

- **Context:** with one backup, a mistake or a corruption noticed after the next nightly run cannot be undone, because that run overwrites the only good copy.
- **Options:** keep only the newest; keep every backup of the last N days; keep a daily, weekly and monthly tier (grandfather-father-son), the rule restic and borg offer.
- **Decision:** three tiers. After each upload, `docker/backup/expired_backups.sh` keeps the newest backup of each of the last 7 days, the last 4 weeks (Monday to Sunday) and the last 6 months that have a backup, and the rest is deleted. Counting only periods that have a backup means failed nights never push older backups out. It reads the dates from the file names, so the rule needs no state of its own, and files not named like a backup are never deleted.
- **Consequences:** about 14 files in the folder once it has run for half a year, a small multiple of one dump's size. A restore can go back to any of the last 7 days, to the end of each of the last few weeks, and to the end of each of the last 6 months. Like the rest of the backup, the script is not run in CI; its selection was checked by simulating a year of nightly runs.

## 13. The open list lives in the URL

- **Context:** only the open note was in the URL (`/notes/:uuid`). The list (Starred, a folder, a tag, the Trash, search results) lived in a client store, so a reload went back to All notes, Back and Forward skipped list changes, and a list could not be bookmarked or opened in a new browser tab.
- **Options:** keep the list in the store; give each list a URL and keep every note at `/notes/:uuid`, so a reload with a note open loses the list; nest the note under its list.
- **Decision:** every list has a URL and the note nests under it: `/starred`, `/trash`, `/folders/:folderUuid`, `/tags/:slug` and `/search?q=…`, each with `/notes/:uuid` after it, while All notes stays `/` and `/notes/:uuid` so existing links keep working. `routes/scope_location.ts` is the one place that turns a list into a URL and back; the store no longer holds the list. Tags use their slug, which is unique per account and readable. The sidebar items are links, so Ctrl+click opens a list in a new tab.
- **Consequences:** renaming the open tag moves the URL to the new slug, and deleting the open folder or tag goes to All notes; both go back if the change fails. A URL naming a folder or tag that no longer exists goes to All notes with a notice. Renaming a tag breaks bookmarks to its old slug. The filter box stays out of the URL and starts empty in each list. Open tabs are not tied to a list: clicking one opens that note under the current list.

## 14. The demo account is reset every night

- **Context:** the README offers a public demo account that every visitor shares. A visitor can rename it, change its password, delete or rewrite its notes, folders and tags, or empty the Trash, and the next visitor then finds a broken or empty demo.
- **Options:** make the demo account read-only, which needs a check on every write route and MCP tool and hides most of what the app does; restore it from a database snapshot, which ties the demo to one dump and the schema it was taken with; rebuild it from sample content kept in the repo, through the app's own code.
- **Decision:** rebuild it. `scripts/reset_demo.py` runs `DemoResetService` every day at 23:20 India time in a `demo-reset` container (the API image, `docker/scripts/run_daily_at.sh`), after the 23:00 cleanup and the 23:10 backup. For the account with `DEMO_EMAIL` it creates the account if it is missing, sets the name and the Argon2 password from `DEMO_NAME` and `DEMO_PASSWORD`, ends its sessions, deletes its personal access tokens, notes (the Trash included), folders and tags, and writes the sample content: the folders Ideas, Personal and Work, and seven notes with their tags, two of them starred. The notes are Markdown in `api/app/content/data/demo_content.toml`, converted with `markdown_to_document` (decision 7), so they are stored like notes written in the editor and always match its schema. Everything runs in one transaction, so a failed reset leaves the previous content in place. The log shows the user id and counts, never the email or the notes. An empty `DEMO_EMAIL` turns the reset off; a `DEMO_EMAIL` without `DEMO_PASSWORD` and `DEMO_NAME` stops the API from starting, since the reset would leave an account nobody can sign in to.
- **Consequences:** whatever a visitor writes lasts until the next 23:20 and is visible to every other visitor in the meantime; the welcome note says so. Changing the sample notes is an edit to the TOML file, checked by `tests/unit/content/test_demo_content.py`. The account's display preferences (theme, sort) are not part of the reset. The demo credentials are not secret: they are committed in `.env.production` and shown in the README. A server whose `.env` predates this change has no `DEMO_*` values, so the reset stays off there until they are added.
