# Frontend rules: Notes

Stack: React 19, TypeScript (`strict`), Vite, Mantine, TanStack React Query, React Router, axios, zustand, Tiptap, Tauri 2, Vitest + React Testing Library. The API is Laravel with Sanctum. These rules add to the root `CLAUDE.md`.

- **NEVER** use `@tiptap-pro` packages.
- The same code runs in the browser and in Tauri. Everything that differs between them lives in `platform/`.

---

## Folder structure

Folders and their purpose, not every file, so this stays true as files are added.

```
web/src/
├── main.tsx       entry: root error boundary, mounts <App />
├── app.tsx        providers (Mantine, QueryClient, Router) and the app boundary; rendered by tests too
├── config/        env.ts: the ONLY file that reads import.meta.env
├── api/           api_client.ts (the one axios instance and its interceptors) + one <resource>_api.ts per resource
├── types/         interfaces and type aliases, one file per domain; pagination.ts and api_response.ts are shared
├── queries/       React Query hooks, ONE <resource>_queries.ts per resource (its queries + mutations); query_client.ts
├── hooks/         shared business-logic hooks, one hook per file
├── constants/     one file per domain: api_endpoints, query_keys, messages, limits, time_constants, ...
├── validations/   form validation rules for @mantine/form
├── utils/         small pure functions (formatting, case conversion, ProseMirror helpers, clipboard)
├── styles/        theme.ts, global styles, design tokens
├── routes/        route paths, lazy route definitions, route boundary, protected and guest routes
├── ui/            reusable, logic-free building blocks: form/, layout/, feedback/, skeletons/
├── common/        domain components shared by 2+ pages (created when the second page needs one)
├── test_utils/    render helpers and test-data factories
├── pages/         one folder per route: <page>_page.tsx, components/, hooks/
│
│   Offline-first layers (this app keeps a local copy of every note):
├── db/            local SQLite: connection, schema, one <resource>_repo.ts per table, drafts store
├── data/          <resource>_source.ts: picks the server or the local DB for a scope (Cloud vs On This Device)
├── sync/          the sync engine: outbox of pending writes, pull, push, status
├── platform/      browser vs Tauri differences: secure store, device kind, isNative()
└── stores/        zustand stores for client-only UI state (open tabs, panels); never server data
```

Pages: login, register, notes (list and editor, `/` and `/notes/:uuid`), access_tokens.

## Naming
- Files and folders: `snake_case` (`note_row.tsx`, `use_autosave.ts`).
- Components: `PascalCase`. Hooks: `camelCase` starting with `use`. Functions and variables: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- Interfaces: `I` prefix (`INote`, `IPaginatedResponse<T>`), with `camelCase` properties. Type aliases: `T` prefix (`TContainer = 'cloud' | 'local'`). Generic parameters stay single letters (`<T>`).
- `interface` for object shapes; `type` for unions, literals and function signatures.
- **NEVER** leave anything untyped, even where TypeScript could infer it:
  - variables and constants: `const pageSize: number = 50`
  - every `useState`, `useRef`, `useMemo`: `useState<INote | null>(null)`, `useRef<HTMLInputElement>(null)`
  - every function's parameters and return type; components return `React.JSX.Element`
  - every callback: `useCallback((uuid: TUuid): void => { ... }, [...])`
  - props through an `I<Component>Props` interface
  - API functions and hooks: `Promise<INote>`, `UseQueryResult<INote>`
- Business-logic hooks: one per file, file named after the hook (`use_autosave.ts` → `useAutosave`).
- Query hooks: read hooks end in `Query` (`useNotesQuery`), write hooks in `Mutation` (`useTrashNoteMutation`).
- Pages use a `default` export (required by `React.lazy`); everything else uses named exports.
- Imports use the `@src/*` alias. **NEVER** relative parent imports (`../`). One alias only.

## Environment and API client
- `src/config/env.ts` is the only file that reads `import.meta.env`.
- `VITE_*` variables are built into the JavaScript and readable by anyone. **NEVER** put secrets in them.
- `api/api_client.ts` creates ONE axios instance (`baseURL: API_URL + '/api/v1'`, `withCredentials: true`). **NEVER** call `axios` or `fetch` directly anywhere else; the only other request is the Sanctum CSRF cookie fetch inside `api_client.ts`.
- Endpoint paths live in `constants/api_endpoints.ts` (`NOTES: '/notes'`, `noteByUuid: (uuid: TUuid) => ...`).

## snake_case ↔ camelCase
- Converted **once, in axios interceptors**: response body keys snake → camel; request body and query `params` keys camel → snake. Never inside API functions.
- Pure, recursive converters in `utils/case_converter.ts`; they skip `FormData`, `Blob` and `Date`.
- Only **keys** are converted, never values. Values the API expects in snake_case are constants in that form.
- **Opaque data is never converted:** a note's `body` (ProseMirror JSON; `textAlign` must stay `textAlign`) and maps keyed by data (`counts.folders` is keyed by folder uuid, `counts.tags` by tag slug).
- The local SQLite tables keep their snake_case columns. Each `db/*_repo.ts` maps rows to camelCase objects and back, so nothing outside `db/` sees a column name. Outbox payloads stored before the change are converted when read.
- In a 422, the keys of `errors` are converted to camelCase so they match the form field names.
- The error interceptor rejects every failure as an `ApiError` (`{ status: number, message: string, errors?: Record<string, string[]>, serverCopy?: Note }`, defined in `api/api_client.ts`); a network error has `status: 0` and a fallback message. React Query's `defaultError` is `ApiError`, and `normalizeError()` turns anything else thrown into one. Components, hooks and the sync engine never inspect raw axios errors.

## Authentication
- **Browser:** the Sanctum session lives in an httpOnly cookie. The frontend never sees, stores or sends a token. A 419 (expired CSRF token) is retried once inside the interceptor after refreshing the CSRF cookie.
- **Native apps (Tauri):** the webview is a different origin from the API, so the session cookie is never sent. The app keeps an API token in the OS secure store (Credential Manager, Keychain, libsecret, Keystore) through `platform/secure_store.ts` and sends it as a bearer header. It is cached in memory only. See decision 1.
- **NEVER** put auth data in `localStorage`, `sessionStorage` or a JS-readable cookie. The current user lives only in the React Query cache (`useCurrentUserQuery`).
- `protected_route.tsx` runs `useCurrentUserQuery` (`GET /me`): loading → full-screen loader; 200 → the page; 401 → login, remembering the page asked for. `guest_route.tsx` sends a signed-in user from login and register to the notes.
- Session expiry: the response interceptor reports a 401 (except from `/me` and `/login`) to a handler registered by `app.tsx`, which clears cached queries and re-checks the session. The API client needs no access to the router or the cache.
- Login: on success, put the user in the `useCurrentUserQuery` cache and go to the remembered page. Show the API's generic error; **NEVER** say whether the email or the password was wrong.
- The remembered page comes from router state, never from a URL parameter (no open redirects).
- Logout: on success, clear the whole query cache and the local Cloud copy, then go to login.

## Types
- `types/pagination.ts` holds `IPaginationMeta`, `IPaginatedResponse<T>` and `IPaginationParams`, used by EVERY paginated API. A list's params **extend** `IPaginationParams`. **NEVER** redefine pagination fields per feature.
- API functions are fully typed; single-resource functions unwrap `data` and return `Promise<INote>`.
- Shared aliases: `TUuid`, `TIsoDate`, `TContainer`, `TProseMirrorDoc`.

## Data fetching (React Query)
- Flow: **types → API functions / data sources → query and mutation hooks → components**. Components **NEVER** call API functions, repos or sources directly. **NEVER** fetch data in `useEffect`.
- All hooks for one resource live in `src/queries/<resource>_queries.ts`, so its invalidation stays in one file.
- **All** query keys live in `constants/query_keys.ts`, one factory per resource (`noteKeys.list(scope)`, `noteKeys.detail(uuid)`). **NEVER** write an inline key array.
- Mutations invalidate exactly the keys they affect. Optimistic updates roll back on failure.
- Paginated lists use `placeholderData: keepPreviousData`.
- The `QueryClient` sets a default `staleTime` and `retry` from constants.
- **NEVER** set `throwOnError` globally; API errors are expected states, not crashes.
- Writes to Cloud notes go through the outbox (`sync/`), so they survive going offline. On This Device notes never reach the API.

## Logic vs UI
- **All logic lives in hooks:** shared logic in `src/hooks/`, single-page logic in `pages/<page>/hooks/`.
- `src/ui/` components are logic-free: props in, JSX and callbacks out. No API calls, no business rules, no React Query.
- Create a `src/ui/` wrapper only when it standardises behaviour or is used in 2+ places; otherwise use Mantine directly.
- Pages compose hooks and UI and stay thin.

| Used by | Folder |
|---|---|
| One page only | `pages/<page>/components/` |
| 2+ pages or routes | `src/common/<component>/` |
| Anywhere, generic, no domain knowledge | `src/ui/` |

- A component starts in its page folder. When a second page needs it, **move** it to `src/common/`; **NEVER** copy it or import it from another page's folder.
- Derive values instead of storing them: no `useState` + `useEffect` to mirror props or other state. Effects clean up their listeners, timers and subscriptions.
- `react-hooks/exhaustive-deps` warnings are fixed, never suppressed.

## Loading states

| Situation | Loader |
|---|---|
| First app load, while the session is checked | `ui/feedback/full_screen_loader.tsx`. **NEVER** used anywhere else |
| Lazy route loading | `ui/skeletons/page_skeleton.tsx` |
| A query loading data | A skeleton shaped like the content it replaces |
| Filtering or searching a list that has data | Keep the rows visible (`keepPreviousData`) with a subtle fetching indicator |
| Form submit, delete or any action | That button only: `loading={mutation.isPending}`, which also disables it |

- **NEVER** use a full-screen or page-blocking spinner for queries or mutations.
- Skeletons match the final layout, so nothing jumps when data arrives.
- A disabled, loading button prevents double submits.

## User feedback and UX
- **The URL holds navigation state:** the open note is `/notes/:uuid`. Opening a note from the list navigates to its route.
- Every mutation shows a failure notification (the API's `message`), wired once in the mutation hooks or a shared helper; actions the user can't see happen (move, trash, token created) also show a success notification. Texts come from `constants/messages.ts`.
- Permanent delete always asks first, in a confirmation modal naming the record; the confirm button shows the loading state. Moving to Trash needs no confirmation because it can be undone.
- A failed query shows `error_state` with a retry button; an empty result shows `empty_state` with a hint.
- Server field errors (`errors`) appear on the matching form inputs. Frontend validation is for UX only; the backend is the source of truth.
- **Accessibility:** every input has a visible label (never placeholder-only, except the search and filter boxes, which have an `aria-label`); icon-only buttons have an `aria-label`; every action works with the keyboard; status is never shown by colour alone.

## Styling: Mantine first, then SCSS
Order of preference (use the first that works):
1. **Mantine components** for layout and structure (`Group`, `Stack`, `Center`, `Paper`, `Text`, ...). **NEVER** a custom `div` + CSS for something Mantine already does.
2. **Mantine props** with **theme keys only** (`gap="md"`, `c="dimmed"`), then the Styles API `classNames` prop. ❌ `mt={15}`, `p="13px"`, `c="#333"`.
3. **An SCSS module**, only when Mantine can't express the design, using tokens.
4. **Inline `style`**, only for values known at runtime, passed as a CSS custom property (`style={{ '--folder-color': color } as React.CSSProperties}`).

- Tokens live in `src/styles/shared/style_system/` (`_spacing.scss`, `_typography.scss`, `_colors.scss`, `_breakpoints.scss`, `_layers.scss` for `z-index`, `_layout.scss` for the app shell's sizes), the only place raw values appear. Spacing uses a 4px scale (`$xxs: 4px` … `$xxl: 48px`); colours map to Mantine CSS variables where Mantine has one, so light and dark mode match; breakpoints equal Mantine's. `theme.ts` uses the **same** scale.
- Load tokens with `@use "@src/styles/shared/style_system/spacing" as spacing;`. **NEVER** `@import`.
- **NEVER** hardcode spacing, font, colour or breakpoint values. If no token fits, add one to the token file. Allowed literals: `0`, `1px` borders, percentages, `auto`/`none`/`inherit`/`transparent`/`currentColor`, unitless `opacity`/`flex`. `z-index` always comes from `_layers.scss`.
- One SCSS module per component, next to it (`note_row.module.scss`). Never shared, never imported by another component. Class names are camelCase; nesting is at most 3 levels.
- **NEVER** use ID selectors, `!important` or bare element selectors in modules. `:global` only as a last resort, with a comment (the Tiptap editor content is the expected case, since its HTML is not ours).
- Combine classes with `classnames`, never template strings or `+`.

## Constants and validation
- Constants (limits, debounce delays, labels, messages) live in `src/constants/`, one file per domain. Lists the API owns are loaded from the API, never copied.
- Form validation rules live in `src/validations/`; limits come from constants.

## Error boundaries and resilience
Goal: **no JavaScript error ever leaves the user on a blank screen.** Use `react-error-boundary`.

| Level | Where | Fallback |
|---|---|---|
| Root | `main.tsx`, outside every provider | Plain HTML only (heading, one sentence, a "Reload" link). **NEVER** uses Mantine |
| App | `app.tsx`, inside `MantineProvider`, around the router | Full page with a "Reload" button |
| Route | `route_boundary.tsx` around **every** lazy page: `ErrorBoundary` → `Suspense` (page skeleton) → page | In the page area, with "Try again"; `resetKeys={[location.pathname]}` |

- The root route's `errorElement` uses the same fallback.
- The editor has its own boundary, so a bad note body doesn't hide the list and sidebar.
- `index.html` contains a static message inside `#root` and a `<noscript>`, for failures before React mounts.
- A global listener (`use_global_error_listener.ts`) handles `window` `error` and `unhandledrejection`: logs without personal data, shows ONE throttled generic notification, ignores chunk-load errors and known browser noise.
- **Stale deploys:** detect failed lazy-chunk loads (Vite's `vite:preloadError` and the route boundary's `onError`) and reload through ONE helper with a loop guard in `sessionStorage`. Within the guard window, show "A new version is available" with a Reload button instead.
- Fallbacks **NEVER** show stack traces or error messages; log once in `onError` with `console.error`, without personal data.

## Routing and code splitting
- Every page is lazy-loaded with `React.lazy` and rendered through the route boundary. **NEVER** import a page statically.
- Paths and path builders live in `routes/route_paths.ts` (`ROUTE_PATHS`, `notePath(uuid)`). **NEVER** hardcode a path string.
- Vendor code is split into long-cached chunks (React, Mantine, React Query, icons, Tiptap, highlight), and every build file is named by its content hash under `assets/`. The chunk checks test specific packages before generic ones (`@tanstack/react-query` and `@tabler/icons-react` contain "react").
- `vite build` writes into `../api/public` without emptying it, because Laravel serves the web build from there. See decision 2.

## Performance
- `useCallback` for functions passed as props or used in dependency arrays; `useMemo` for derived data and for objects or arrays passed as props; `React.memo` for components that re-render often with the same props (note rows, sidebar items, tabs). Don't wrap trivial values.
- Search and filter inputs are debounced before they trigger a query.
- `key`s are stable IDs (uuids), never array indexes for lists that change.
- Import icons and libraries by name. **NEVER** `import * as Icons`.

## Tooling
`npm run check` runs `lint` (ESLint `--fix`), `lint:style` (Stylelint `--fix`), `tsc -b --noEmit` and `vitest run`. The config files are the source of truth.

ESLint (`eslint.config.js`) enforces: no `any`; explicit return and boundary types; typed variables and parameters; no unused variables (except `_`-prefixed); no relative parent imports; ordered, grouped imports; sorted JSX props; rules of hooks; `console` limited to `error`; 2-space indent; LF line endings. ESLint stays on 9 until every plugin supports 10.

Stylelint (`stylelint.config.js`) enforces token-only values, max nesting 3, no IDs, no `!important`, camelCase module classes and no `@import`.

## Testing
- Vitest + React Testing Library for important flows (login and register validation, note list filtering, error and empty states), the sync engine and pure utils (case conversion, ProseMirror helpers, clipboard).
- Mock at the network edge (the API module), never React Query internals.
- Query by role and label text, as a user would, never by CSS classes.
