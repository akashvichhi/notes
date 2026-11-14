# Decisions

Numbered, ADR-style. Code comments and reviews refer to them ("decision 1").

## 1. The app is web-only

- **Context:** the app was planned to ship as a web app and as Tauri apps for desktop and mobile, with a local SQLite copy, an "On This Device" container, a sync engine and bearer tokens kept in the OS secure store. Only the web app is in use.
- **Options:** keep the native code in the repository; remove it and keep one build.
- **Decision:** remove the native shell (`web/src-tauri`), the local database, the sync engine, the platform layer, the On This Device container and the device sign-in tokens (`POST /tokens`, `DELETE /tokens/current`). The browser signs in with the Sanctum session cookie only.
- **Consequences:** every note lives on the server. Unsaved typing is still buffered in IndexedDB (`db/drafts_store.ts`). Personal access tokens for the MCP server are the only tokens the API issues.

## 2. The web build is written into Laravel's public folder

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
