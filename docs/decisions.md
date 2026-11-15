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
