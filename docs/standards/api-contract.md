# HTTP API contract

The contract between the project's HTTP API and its clients. The server's stack rules say **how** it implements the contract; each client's stack rules say how it consumes it. Examples use an `employee` resource.

Read [`common.md`](common.md) first. These rules add to it.

---

## REST conventions
- Base path `/api/v1`. Resources are plural kebab-case nouns: `/employees`, `/salary-insights`.

| Action | Method and path | Success |
|---|---|---|
| List | `GET /employees?page=1&per_page=20&search=&sort=-salary` | 200 |
| Get one | `GET /employees/{id}` | 200 |
| Create | `POST /employees` | 201 |
| Update (partial) | `PATCH /employees/{id}` | 200 |
| Delete | `DELETE /employees/{id}` | 204, no body |

- Query parameters and JSON keys are `snake_case`.
- Sorting: `sort=<field>` ascending, `sort=-<field>` descending. Sort fields are an allow-listed enum.
- **NEVER** use data values as JSON object keys (`{ "India": {...} }`). Return arrays of objects (`[{ "country": "India", ... }]`). That keeps responses typed, ordered, and safe for clients' case conversion.
- `GET` endpoints **NEVER** change data.
- Money is a decimal string and dates are ISO 8601 strings (see common rules).

## Response contract (identical for every endpoint)

```json
{ "data": { "id": 1, "full_name": "Asha Rao", "salary": "85000.00" } }
```
```json
{
  "data": [ { "id": 1, "full_name": "Asha Rao" } ],
  "meta": { "total_count": 10000, "current_page": 1, "per_page": 20, "total_pages": 500 }
}
```
```json
{ "error": "Employee not found" }
```
Validation errors (422), and any domain error about one field (e.g. a 409 for a taken email), may add `details`, so the UI can highlight the right input:
```json
{ "error": "Validation failed", "details": [ { "field": "salary", "message": "Salary must be greater than 0" } ] }
```

- **Every** error uses this shape, including validation errors, unknown routes, wrong methods, and unexpected failures. **MUST** replace the framework's default error bodies.
- 500 responses return a generic message; the server logs the stack trace (without personal data).

| Status | Meaning |
|---|---|
| 401 | Not logged in, or the session expired |
| 403 | Logged in but not allowed, or a write from a foreign origin |
| 404 | Not found, including unknown `/api/*` paths |
| 409 | Conflict (e.g. a duplicate) |
| 422 | Validation failed |
| 429 | Rate limit hit |

## Pagination
- Every paginated endpoint takes `page` (≥ 1) and `per_page` (1 to the server's maximum; above it → 422) and returns `{ data, meta }` with exactly the four `meta` fields above.
- Defaults: `page = 1`, `per_page = 20`, maximum 100, held as server constants.
- Edge cases: 0 results → `data: []`, `total_pages: 0`. A page beyond the last → 200 with `data: []` and the real `meta`, not a 404.
- **NEVER** redefine pagination fields per endpoint.

## Sessions (browsers)
- Browsers authenticate with a **server-side session** in an **httpOnly cookie** holding only a random session ID. **NEVER** use JWTs or bearer tokens for the browser, and **NEVER** return a token or session ID in a response body.
- The server stores only a hash of the session ID. Expired sessions are rejected and deleted when used.
- Cookie: `HttpOnly; Secure; SameSite=Lax; Path=/`, `Max-Age` = session lifetime. `Secure` is on everywhere except local development; if the app must run over plain HTTP, record why in `docs/decisions.md`.
- Endpoints, when the app has login: `POST /api/v1/auth/login` (200 + `Set-Cookie`, or 401), `POST /api/v1/auth/logout` (204, always succeeds), `GET /api/v1/auth/me` (200 or 401).
- Login: the same generic error for a wrong email or a wrong password; a new session ID on every login; failed attempts rate-limited per email and IP → 429.
- Every route requires a session unless it is explicitly listed as public in the project's `CLAUDE.md` (login, health, ...).
- **CSRF:** `SameSite` plus an origin check that rejects `POST`/`PATCH`/`PUT`/`DELETE` from origins not in the allowed list → 403.
- **CORS** only for local development: an explicit origin list (**NEVER** `*`) with credentials allowed. In production the frontend is served from the same origin.

## Serving a web frontend from the API server
- `/assets/*` → static files with `Cache-Control: public, max-age=31536000, immutable`. A missing asset returns a plain **404**, never `index.html`.
- `/api/*` → the API. Unknown `/api/*` paths return the JSON 404, never `index.html`.
- Any other path → `index.html` with `Cache-Control: no-cache`, so client-side routing and reloads after a deploy work.
- The API routes are matched **before** the frontend fallback.

## Health check
- `GET /api/health` (outside `/api/v1`, no session) returns `200 { "data": { "status": "ok" } }` once the server can serve requests (e.g. after `SELECT 1`).
