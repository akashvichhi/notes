# Decisions

Numbered, ADR-style. Code comments and reviews refer to them ("decision 1").

## 1. Native apps keep a bearer token in the OS secure store

- **Context:** the standards keep browser sessions in httpOnly cookies and never let JavaScript hold a token. The Tauri apps load the UI from their own origin (`tauri://` / `http://tauri.localhost`), so the API's SameSite session cookie is never sent from them.
- **Options:** cookies with `SameSite=None` and CORS credentials for the app origins; a bearer token kept in the webview's storage; a bearer token kept in the OS secure store.
- **Decision:** the browser build uses the Sanctum session cookie only. The native apps sign in through `POST /auth/token`, keep the token in the OS secure store (Credential Manager, Keychain, libsecret, Keystore) through `platform/secureStore.ts`, and send it as `Authorization: Bearer`. It is never written to `localStorage` or `sessionStorage`.
- **Consequences:** the API client adds the header only when `isNative()`. Signing out deletes the token from the secure store and revokes it on the server.

## 2. The web build is written into Laravel's public folder

- **Context:** Laravel serves the SPA (`routes/web.php` falls back to `index.html`), so the built files must be in `api/public`.
- **Options:** copy `dist/` in a deploy step; build straight into `api/public`.
- **Decision:** `vite build` writes to `../api/public` with `emptyOutDir: false`, so `index.php` and Laravel's own files stay. `npm run clean` removes only `assets/` and `index.html` before a production build.
- **Consequences:** the release commit includes the build output.
