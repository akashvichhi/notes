# Frontend rules (React + TypeScript)

Stack: React 19, TypeScript (`strict`), Vite, Mantine, TanStack React Query, React Router, axios, Vitest + React Testing Library. Examples use an `employee` resource.

Read [`common.md`](common.md) first, and [`api-contract.md`](api-contract.md) when the app talks to an HTTP API. These rules add to them.

---

## Paths and commands

What `common.md` refers to as "the stack rules name it":

| Item | React + TypeScript |
|---|---|
| Configuration (the only place `import.meta.env` is read) | `src/config/env.ts`, with `.env.example` listing every variable |
| Time zone and display formats | `src/constants/time_constants.ts` |
| User-facing messages | `src/constants/messages.ts` |
| Type checking | TypeScript `strict: true`, `tsc -b --noEmit` |
| Money | Typed `string`; formatted with `Intl.NumberFormat`, never parsed |
| Lock file / install | `package-lock.json` / `npm ci` |
| Tooling config files | `eslint.config.js`, `stylelint.config.js`, `tsconfig*.json`, `vite.config.ts` |
| Full check | `npm run check` in `web/` |
| One test file | `npx vitest run src/utils` |
| Never commit | `.env`, `node_modules/`, `dist/`, `coverage/` |
| Commit scope | `web` |

## Folder structure

Describe folders and their purpose, not every file, so this stays true as files are added.

```
web/src/
├── main.tsx       entry: root error boundary, mounts <App />
├── app.tsx        providers (Mantine, QueryClient, Router) and the app boundary; rendered by tests too
├── config/        env.ts: the ONLY file that reads import.meta.env
├── api/           api_client.ts (the one axios instance and its interceptors) + one <resource>_api.ts per resource
├── types/         interfaces and type aliases, one file per domain; pagination.ts and api_response.ts are shared
├── queries/       React Query hooks, ONE <resource>_queries.ts per resource (its queries + mutations); query_client.ts
├── hooks/         shared business-logic hooks, one hook per file
├── constants/     one file per domain: api_endpoints, query_keys, messages, http_status, time_constants, ...
├── validations/   form validation rules for @mantine/form
├── utils/         small pure functions (formatting, case conversion, error checks)
├── styles/        theme.ts; global.scss and design tokens only once they're needed
├── routes/        route paths, lazy route definitions, app layout, route boundary, protected route
├── ui/            reusable, logic-free building blocks: form/, layout/, feedback/, skeletons/
├── common/        domain components shared by 2+ pages (created when the second page needs one)
├── test_utils/    render helpers and test-data factories
└── pages/         one folder per route: <page>_page.tsx, components/, hooks/
```

## Naming
- Files and folders: `snake_case` (`employee_table.tsx`, `use_list_url_state.ts`).
- Components: `PascalCase`. Hooks: `camelCase` starting with `use`. Functions and variables: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- Interfaces: `I` prefix (`IEmployee`, `IPaginatedResponse<T>`), with `camelCase` properties. Type aliases: `T` prefix (`TSortOrder = 'asc' | 'desc'`). Generic parameters stay single letters (`<T>`).
- `interface` for object shapes; `type` for unions, literals, and function signatures.
- **NEVER** leave anything untyped, even where TypeScript could infer it:
  - variables and constants: `const pageSize: number = 20`
  - every `useState`, `useRef`, `useMemo`: `useState<IEmployee | null>(null)`, `useRef<HTMLInputElement>(null)`
  - every function's parameters and return type; components return `React.JSX.Element`
  - every callback: `useCallback((id: number): void => { ... }, [...])`
  - props through an `I<Component>Props` interface
  - API functions and hooks: `Promise<IEmployee>`, `UseQueryResult<IPaginatedResponse<IEmployee>>`
- Business-logic hooks: one per file, file named after the hook (`use_list_url_state.ts` → `useListUrlState`).
- Query hooks: read hooks end in `Query` (`useEmployeesQuery`), write hooks in `Mutation` (`useDeleteEmployeeMutation`).
- Pages use a `default` export (required by `React.lazy`); everything else uses named exports.
- Imports use the `@src/*` alias. **NEVER** relative parent imports (`../`). One alias only.

## Environment and API client
- `src/config/env.ts` is the only file that reads `import.meta.env`, e.g. `export const API_URL: string = import.meta.env.VITE_API_URL || '/'`.
- `VITE_*` variables are built into the JavaScript and readable by anyone. **NEVER** put secrets in them.
- `api/api_client.ts` creates ONE axios instance (`baseURL: API_URL`, `withCredentials: true`). **NEVER** call `axios` or `fetch` directly anywhere else.
- Endpoint paths live in `constants/api_endpoints.ts` (`EMPLOYEES: 'api/v1/employees'`, `employeeById: (id: number) => ...`).

## snake_case ↔ camelCase
- Converted **once, in axios interceptors**: response body keys snake → camel; request body and query `params` keys camel → snake. Never inside API functions.
- Pure, recursive converters in `utils/case_converter.ts`; they skip `FormData`, `Blob`, and `Date`.
- Only **keys** are converted, never values. Values the API expects in snake_case (sort fields like `hire_date`) are constants in that form.
- Exception: in a 422, `details[].field` is converted to camelCase so it matches the form field name.
- The error interceptor turns every failure into an `IApiError` (`{ error: string, details?: IFieldError[], status? }`), with a fallback message for network errors. Components never inspect raw axios errors.

## Authentication
- The session lives in an httpOnly cookie. The frontend **NEVER** sees, stores, or sends a token itself.
- **NEVER** put auth data in `localStorage`, `sessionStorage`, or a JS-readable cookie. The current user lives only in the React Query cache (`useCurrentUserQuery`).
- `protected_route.tsx` runs `useCurrentUserQuery` (`GET /api/v1/auth/me`): loading → full-screen loader; 200 → the page; 401 → login, remembering the page asked for.
- Session expiry: the response interceptor reports a 401 (except from `/auth/me` and `/auth/login`) to a handler registered by `app.tsx`, which clears cached queries and re-checks the session. The API client needs no access to the router or the cache.
- Login: on success, put the user in the `useCurrentUserQuery` cache and go to the remembered page. Show the API's generic error; **NEVER** say whether the email or the password was wrong.
- The remembered page comes from router state, never from a URL parameter (no open redirects).
- Logout: on success, clear the whole query cache and go to login.

## Types
- `types/pagination.ts` holds `IPaginationMeta`, `IPaginatedResponse<T>`, and `IPaginationParams`, used by EVERY paginated API. A list's params **extend** `IPaginationParams`. **NEVER** redefine pagination fields per feature.
- When a page comes back with `data: []` and `currentPage > totalPages > 0` (e.g. the last item on the last page was deleted), go to page `totalPages`.
- Money arrives as a decimal **string**, so it is typed `string`. **NEVER** use `Number`/`parseFloat` on it; the frontend only formats.
- API functions are fully typed; single-resource functions unwrap `data` and return `Promise<IEmployee>`.

## Data fetching (React Query)
- Flow: **types → API functions → query/mutation hooks → components**. Components **NEVER** call API functions directly. **NEVER** fetch data in `useEffect`.
- All hooks for one resource live in `src/queries/<resource>_queries.ts`, so its invalidation stays in one file.
- **All** query keys live in `constants/query_keys.ts`, one factory per resource (`employeeKeys.list(params)`, `employeeKeys.detail(id)`). **NEVER** write an inline key array.
- Mutations invalidate exactly the keys they affect.
- Paginated lists use `placeholderData: keepPreviousData`.
- The `QueryClient` sets a default `staleTime` and `retry` from constants.
- **NEVER** set `throwOnError` globally; API errors are expected states, not crashes.

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
- Derive values instead of storing them: no `useState` + `useEffect` to mirror props or other state. Effects clean up their listeners, timers, and subscriptions.
- `react-hooks/exhaustive-deps` warnings are fixed, never suppressed.

## Loading states

| Situation | Loader |
|---|---|
| First app load, while the session is checked | `ui/feedback/full_screen_loader.tsx`. **NEVER** used anywhere else |
| Lazy route loading | `ui/skeletons/page_skeleton.tsx` |
| A query loading data | A skeleton shaped like the content it replaces |
| Paginating, filtering, or searching a list that has data | Keep the rows visible (`keepPreviousData`) with a subtle fetching indicator |
| Form submit, delete, or any action | That button only: `loading={mutation.isPending}`, which also disables it |

- **NEVER** use a full-screen or page-blocking spinner for queries or mutations.
- Skeletons match the final layout, so nothing jumps when data arrives.
- A disabled, loading button prevents double submits. **NEVER** rely on the user not clicking twice.

## User feedback and UX
- **The URL holds list state:** page, page size, search, filters, and sort, through ONE shared hook (`use_list_url_state.ts`). Changing a filter or search resets to page 1.
- Every mutation shows a success and a failure notification (the API's `error` message), wired once in the mutation hooks or a shared helper. Texts come from constants.
- Delete always asks first, in a confirmation modal naming the record; the confirm button shows the loading state.
- A failed query shows `error_state` with a retry button; an empty result shows `empty_state` with a hint (e.g. "Clear filters").
- Server field errors (`details`) appear on the matching form inputs. Frontend validation is for UX only; the backend is the source of truth.
- **Accessibility:** every input has a visible label (never placeholder-only); icon-only buttons have an `aria-label`; every action works with the keyboard; status is never shown by colour alone.

## Styling: Mantine first, then SCSS
Order of preference (use the first that works):
1. **Mantine components** for layout and structure (`Group`, `Stack`, `Center`, `SimpleGrid`, `Paper`, `Card`, `Text`, `Table`, ...). **NEVER** a custom `div` + CSS for something Mantine already does.
2. **Mantine props** with **theme keys only** (`gap="md"`, `c="dimmed"`), then the Styles API `classNames` prop. ❌ `mt={15}`, `p="13px"`, `c="#333"`.
3. **An SCSS module**, only when Mantine can't express the design, using tokens.
4. **Inline `style`**, only for values known at runtime, passed as a CSS custom property (`style={{ '--bar-width': `${percent}%` } as React.CSSProperties}`).

- Most screens need no SCSS. **NEVER** create token files, `global.scss`, or modules up front "just in case"; create a token file when the first module needs it.
- Tokens live in `src/styles/shared/style_system/` (`_spacing.scss`, `_typography.scss`, `_colors.scss`, `_breakpoints.scss`), the only place raw values appear. Spacing uses a 4px scale (`$xxs: 4px` … `$xxl: 48px`); colours map to Mantine CSS variables, so light and dark mode match; breakpoints equal Mantine's. `theme.ts` uses the **same** scale.
- Load tokens with `@use "@src/styles/shared/style_system/spacing" as spacing;`. **NEVER** `@import`.
- **NEVER** hardcode spacing, font, colour, or breakpoint values. If no token fits, add one to the token file. Allowed literals: `0`, `1px` borders, percentages, `auto`/`none`/`inherit`/`transparent`/`currentColor`, unitless `opacity`/`flex`/`z-index`.
- One SCSS module per component, next to it (`employee_table.module.scss`). Never shared, never imported by another component. Class names are camelCase; nesting is at most 3 levels.
- **NEVER** use ID selectors, `!important`, or bare element selectors in modules. `:global` only as a last resort, with a comment.
- Combine classes with `classnames`, never template strings or `+`.

## Constants and validation
- Constants (page sizes, sort options, debounce delays, messages) live in `src/constants/`, one file per domain. Lists the API owns (countries, departments) are loaded from the API, never copied.
- Form validation rules live in `src/validations/`; limits come from constants.

## Error boundaries and resilience
Goal: **no JavaScript error ever leaves the user on a blank screen.** Use `react-error-boundary`.

| Level | Where | Fallback |
|---|---|---|
| Root | `main.tsx`, outside every provider | Plain HTML only (heading, one sentence, a "Reload" link). **NEVER** uses Mantine |
| App | `app.tsx`, inside `MantineProvider`, around the router | Full page with a "Reload" button |
| Route | `route_boundary.tsx` around **every** lazy page: `ErrorBoundary` → `Suspense` (page skeleton) → page | In the page area, with "Try again"; `resetKeys={[location.pathname]}` |

- With a data router, the root route's `errorElement` uses the same fallback.
- Wrap an independent widget in its own boundary only when it failing shouldn't hide the rest of the page.
- `index.html` contains a static message inside `#root` and a `<noscript>`, for failures before React mounts.
- A global listener (`use_global_error_listener.ts`) handles `window` `error` and `unhandledrejection`: logs without personal data, shows ONE throttled generic notification, ignores chunk-load errors and known browser noise.
- **Stale deploys:** detect failed lazy-chunk loads (Vite's `vite:preloadError` and the route boundary's `onError`) and reload through ONE helper with a loop guard in `sessionStorage`. Within the guard window, show "A new version is available" with a Reload button instead.
- Fallbacks **NEVER** show stack traces or error messages; log once in `onError` with `console.error`, without personal data.

## Routing and code splitting
- Every page is lazy-loaded with `React.lazy` and rendered through the route boundary. **NEVER** import a page statically.
- Paths and path builders live in `routes/route_paths.ts`. **NEVER** hardcode a path string.
- Vendor code is split into long-cached chunks (React, Mantine, React Query, icons), and every build file is named by its content hash under `assets/`. `web/vite.config.ts` does both. Its chunk checks must test specific packages before generic ones (`@tanstack/react-query` and `@tabler/icons-react` contain "react").

## Performance
- `useCallback` for functions passed as props or used in dependency arrays; `useMemo` for derived data and for objects or arrays passed as props; `React.memo` for components that re-render often with the same props (rows, list items, cards, form fields). Don't wrap trivial values.
- Search inputs are debounced before they trigger a query.
- `key`s are stable IDs, never array indexes for lists that change.
- Import icons and libraries by name. **NEVER** `import * as Icons`.

## Tooling
`package.json` script `check`: `lint` (ESLint `--fix`), `lint:style` (Stylelint `--fix`), `tsc -b --noEmit`, `vitest run`.

The ESLint config (flat config, `typescript-eslint`, `react`, `react-hooks`, `import`, `@stylistic`) enforces: no `any`; explicit return and boundary types; no unused variables (except `_`-prefixed); no relative parent imports; ordered, grouped imports; sorted JSX props; rules of hooks; `console` limited to `error`; 2-space indent; LF line endings. The Stylelint config (`stylelint-config-standard-scss`, `stylelint-declaration-strict-value`) enforces token-only values, max nesting 3, no IDs, no `!important`, camelCase classes, and no `@import`. The config files themselves are the source of truth.

## Testing
- Vitest + React Testing Library for important flows (lists render and paginate, form validation, error and empty states) and for pure utils.
- Mock at the network edge (the API module or MSW), never React Query internals.
- Query by role and label text, as a user would, never by CSS classes.
