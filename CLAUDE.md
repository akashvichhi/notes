# CLAUDE.md: Notes

A web notes app for people who keep personal notes in folders and tags: a React single-page app on a FastAPI API with Postgres, plus an MCP server so AI assistants can read and write the same notes. Requirements live in `docs/requirements.md`.

The project's general rules live in `docs/standards/` and are imported below; the rules in this file add to them or override them, with the reason.

@docs/standards/common.md
@docs/standards/api-contract.md

Stack rules load from each app folder's `CLAUDE.md` when working in that folder.

## Repo layout

```
notes-app/
├── api/            FastAPI API (Python, SQLAlchemy, Postgres) and MCP server; serves the web build
├── api-laravel/    the previous Laravel API, kept until the cutover is verified, then deleted
├── web/            React app (TypeScript, Vite, Mantine, Tiptap); builds into web/dist
├── docker/         images and the Caddy config for Docker Compose
├── docs/           requirements, architecture, decisions
│   └── standards/  general rules: common, API contract, FastAPI, React
└── CLAUDE.md
```

## Project rules

- **Time zone:** the API uses Asia/Kolkata (UTC+05:30) in every environment: the database session and every timestamp it sends (`api/app/constants/time_constants.py`). The web app shows timestamps in the device's time zone, because notes are personal and "edited 9:14" must mean the user's 9:14 (`web/src/constants/time_constants.ts`). Nothing else reads a zone.
- **Personal data in this app:** account names and emails, note titles and bodies, folder and tag names and tag slugs, search terms. Never logged (see common rules).
- **Soft-deleted tables:** `notes` (Trash, `deleted_at`), filtered through the one scope function in `api/app/repositories/note_repository.py`.
- **Note bodies** are ProseMirror JSON and opaque to every layer except the editor and the content converters: nothing renames, reorders or rewrites their keys, and the web's case conversion skips them.
- **Public endpoints (no session):** `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/health`. `/mcp` takes a personal access token (Bearer) instead of a session; tokens work nowhere else.
- **Deployment:** every push to `master` deploys to the VPS through GitHub Actions once the checks pass (decision 6), so pushing `master` is a release. Push only when the user asks.
- **Overrides:**
  - Another user's resource → **404**, not 403, so ids reveal nothing about other accounts.
  - A note save that loses the version race → 409 with `server_copy` (the current note) next to `error`, so the editor can offer both versions without another request.
  - Public ids are UUIDs (`uuid`, `folder_id`); numeric ids never leave the API, except a personal access token's `id`, which is part of the token text.
  - Registration is rate-limited per IP, in addition to the login limits.
  - The API adds two folders to the standard layout: `app/content/` (ProseMirror ↔ Markdown conversion and note text derivation) and `app/mcp/` (the MCP server and its tools).
