# Notes App — Implementation Plan

> **For agentic workers:** implement this plan task-by-task, in order. Each task ends
> with a green test run and a commit. Steps use checkbox (`- [ ]`) syntax for tracking.
> Do not start a task before the previous one's tests pass.

**Goal:** Build a cross-platform notes app — one React 19 + Vite codebase shipping as a
web app and as **native Windows, macOS and Linux apps via Tauri 2** — against a
Laravel 12 API on MySQL 8. Notes live in one of two containers: **Cloud**, synced
across every device and editable offline, or **On This Device**, which never leaves
the machine.

**Architecture:** One repository, three build outputs. `backend/` is a Laravel 12
**API-only** app holding Cloud notes in MySQL 8. `frontend/` is a Vite SPA that builds
for the browser and, through `src-tauri/`, for each desktop platform. The browser
build authenticates with **Sanctum stateful session cookies**; native builds use
**Sanctum Bearer tokens** held in the OS secure store — both on the same
`auth:sanctum` routes. Native builds are **local-first**: the UI always reads a local
**SQLite** database holding both containers, and a sync engine reconciles Cloud rows
in the background. Note bodies are **ProseMirror JSON**, with a server-derived
`plain_text` column feeding MySQL `FULLTEXT`.

**Tech Stack:** PHP 8.3 · Laravel 12 · MySQL 8 · Sanctum · Pest — React 19.3 ·
Vite 8.3 · TypeScript 7 · Mantine 9.7.1 · TipTap 3.31.4 · TanStack Query 5 · Zustand 5 ·
React Router 8 · axios 1.20 — **Tauri 2 · Rust · SQLite (tauri-plugin-sql)**

**Spec:** `docs/SPEC.md`, with `docs/ARCHITECTURE.md` and `docs/CONTEXT.md`. Read all
three before Task B1. This plan argues from the spec; anything underspecified here is
answered there.

**Phases:** `B1`–`B18` backend · `F1`–`F15` the shared UI · `D1`–`D11` the native
shell, local database and sync engine. Android and iOS are **phase two**, not in this
plan; they reuse the same Tauri project and the responsive layout from F4 and F14.

---

## Starting state — created by the developer, NOT by the agent

Both applications are **already scaffolded** before Task B1 begins. The agent must
**never** run `laravel new`, `composer create-project`, or `npm create vite`. If
`backend/` or `frontend/` is missing or does not match what follows, stop and say so
rather than creating it.

```
notes-app/
├── docker-compose.yml          # PHP 8.3 + MySQL 8.4 — provided
├── docker/php/Dockerfile       # PHP image with pdo_mysql, zip, bcmath, intl, Composer
├── docs/  SPEC.md · PLAN.md · SETUP-WINDOWS.md
├── backend/                    # fresh Laravel 12 app — PROVIDED
└── frontend/                   # fresh Vite + React + TypeScript app — PROVIDED
```

**`backend/`** is an untouched Laravel 12 install: `artisan`, `composer.json`,
`app/`, `routes/web.php`, the default migrations, and `vendor/` installed. It may or
may not already have Pest and `install:api` applied — Task B1 checks and applies
whatever is missing, and is safe to run either way.

**`frontend/`** is an untouched `npm create vite@latest -- --template react-ts`
project: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`,
`src/main.tsx`, `src/App.tsx`. No extra packages installed yet — Task F1 installs
them all at pinned versions.

Task B1 and Task F1 are therefore **verify-and-configure** tasks, not scaffolding
tasks. Every other task is unchanged.

---

## Local environment

The developer runs **Windows with Docker**. PHP and MySQL run in containers; only Node
is installed on the host. **Read `docs/SETUP-WINDOWS.md` first** — it covers the whole
environment, and these two consequences apply to every task in this plan:

- **Every PHP command runs through the container**: `php artisan test` becomes
  `docker compose exec app php artisan test`, and likewise for `composer`.
- **`DB_HOST` is `mysql`**, the compose service name — not `127.0.0.1`.

Shell snippets below are written for **PowerShell**; where a command differs on
macOS/Linux the alternative is given inline.

### MySQL 8 — provided by `docker-compose.yml`

`docker compose up -d` starts MySQL 8.4 with the correct charset and collation and
creates the `notes` database. Nothing to install.

MySQL **8.0 or 8.4** specifically. **Do not substitute XAMPP, WAMP or MariaDB**: they
lack the `utf8mb4_0900_ai_ci` collation this plan's migrations require, and MariaDB's
`JSON` type is an alias for `LONGTEXT` rather than a validated type. The migrations
will fail.

The rest of this section applies only if you later choose to run MySQL on the host
instead of in Docker.

Install the official **MySQL Installer for Windows** from
`https://dev.mysql.com/downloads/installer/`, choose *Developer Default*, set a root
password, and let it register MySQL as a Windows service so it starts with the machine.

Then create the database:

```powershell
mysql -u root -p -e "CREATE DATABASE notes CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
```

Confirm PHP can talk to it — `pdo_mysql` must be enabled in `php.ini`:

```powershell
php -m | Select-String pdo_mysql        # macOS/Linux: php -m | grep pdo_mysql
```

If it prints nothing, uncomment `extension=pdo_mysql` in `php.ini` and restart the
terminal. If `php artisan migrate` later reports *"The server requested authentication
method unknown to the client"*, run:

```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your-password';
FLUSH PRIVILEGES;
```

**Docker alternative** — if Docker Desktop is available, this needs no system install
and matches production more closely:

```yaml
# docker-compose.yml at the repository root
services:
  mysql:
    image: mysql:8.4
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: notes
    ports: ['3306:3306']
    volumes: ['mysql-data:/var/lib/mysql']
volumes:
  mysql-data:
```

```powershell
docker compose up -d
```

---

## Global Constraints

Every task's requirements implicitly include this section.

- **MySQL 8.0+ only.** No Postgres features. No `tsvector`, no `jsonb`, no array types.
- All tables **InnoDB**, charset **`utf8mb4`**, collation **`utf8mb4_0900_ai_ci`**.
- Laravel is **API-only**. No Blade views, no Inertia, no web routes beyond Sanctum's.
- **`bootstrap/app.php` must call `->withMiddleware(fn (Middleware $m) => $m->statefulApi())`.**
  Without it an API-only app has no session middleware and cookie auth fails silently.
- **axios must set both `withCredentials: true` and `withXSRFToken: true`.** Missing the
  second produces 419 on every write and looks like a CORS fault.
- `SESSION_DRIVER=database`, `QUEUE_CONNECTION=database`.
- Public identifiers in every API payload are **UUIDs**, never auto-increment ids.
- **Never accept `user_id` from the client.** Every query is scoped through the
  authenticated user via a Policy.
- **`plain_text` is always derived server-side.** Never accept it from the client.
- The server **never emits HTML built from note content**. Search snippets are plain
  text plus matched terms; the client applies highlighting.
- TypeScript runs in **`strict` mode**. No `any` in committed code.
- All TipTap extensions used are **MIT**. Do not add `@tiptap-pro/*` or CKEditor.
- Touch targets are **≥ 44×44px**; mobile inputs are **≥ 16px** font-size.
- Use **`100dvh`**, never `100vh`.
- Conventional commits (`feat:`, `fix:`, `test:`, `chore:`).
- **Two containers.** Every note, folder and tag belongs to `cloud` or `local`. The
  **server has no `container` column** — it only ever holds Cloud rows. On device,
  `container` is the entire isolation mechanism: the sync engine never reads
  `container = 'local'`.
- **`version` and `revision` are different things.** `version` is optimistic
  concurrency per note; `revision` is sync ordering per account.
- **Tombstones outlive the trash purge.** A device offline longer than the retention
  window is told to full-resync, never silently reconciled.
- **The auth token never touches `localStorage`** — it lives in the OS secure store.
- **Local-first on native.** The UI reads SQLite, never the network; only the sync
  engine talks to the API.
- **Do not invent branding.** The product is called **Notes**. Every icon and logo
  already exists in `assets/brand/` and is documented in `assets/brand/README.md`.
  Copy those files; never generate, redraw, recolour or substitute an image asset,
  and never invent a wordmark, tagline or additional brand colour.

### Backend layering (enforced by an architecture test in B1b)

**Controllers contain no logic.** A controller method may contain only:

1. an `$this->authorize(...)` call,
2. a route-model-bound argument,
3. **one** call to an injected service,
4. a `Resource` or `response()` return.

No conditionals, no loops, no `DB::`, no query building, no transactions, no
`->save()`, no business rules. If a controller method needs an `if`, that `if`
belongs in the service.

| Layer | Directory | Responsibility |
|---|---|---|
| **Controller** | `app/Http/Controllers/Api/V1` | HTTP only: authorize, delegate, serialise |
| **FormRequest** | `app/Http/Requests` | Validation and authorisation rules |
| **Service** | `app/Services/<Domain>` | **One action per class**, a single `__invoke()`. All business logic, all transactions |
| **Query** | `app/Queries` | Complex read queries, filtering and sorting |
| **Model** | `app/Models` | Relations, casts, scopes, constants. **No business methods** |
| **Resource** | `app/Http/Resources` | Serialisation only |
| **Exception** | `app/Exceptions` | Domain failures that map to HTTP status codes |

Services are **invokable single-action classes** resolved from the container and
type-hinted into the controller method. A service never touches the `Request`
object, never returns a `Response`, and signals failure by throwing a domain
exception — which is how the controller stays free of branching.

---

## Review Focus

Input classes the spec implies but which no task's happy path exercises. Each one has a
test pinned to the task that owns the code.

1. **Starring a note while an autosave is in flight must not 409.** The version check
   applies only when the payload contains `body`. *(Test in B8.)*
2. **A note body larger than `max_allowed_packet` or deeply nested** must fail with 422,
   not a 500 or a truncated document. *(Test in B8.)*
3. **Two root folders with the same name** must be rejected. MySQL treats each `NULL` as
   distinct, which is why `parent_id` uses a `0` sentinel. *(Test in B4.)*
4. **Deleting a folder must not delete its notes** — they move to root. A regression here
   destroys user data silently. *(Test in B4.)*
5. **A search term shorter than `innodb_ft_min_token_size` (3)** must be rejected by the
   request layer, not silently return zero results that read as "you have no notes".
   *(Test in B11.)*
6. **A replayed offline create must not duplicate the note.** A flaky reconnect sends
   the same create twice; the second must return the existing note. *(Test in B15.)*
7. **A long offline editing session must replay as one request, not one per keystroke**
   — otherwise every replay after the first conflicts. *(Test in F18 and F19.)*
8. **Signing out must wipe every Cloud row from SQLite and leave On This Device
   untouched.** Getting either half wrong is data loss or a privacy breach on a shared
   machine. *(Test in D9.)*
9. **A note moved Cloud → On This Device must stop syncing**, or it reappears on other
   devices after the user was told it would not. *(Test in D6.)*
10. **A `since` revision older than the oldest tombstone must force a full resync.**
    *(Test in B17.)*

---

## File structure

```
notes-app/
├── docker-compose.yml                     # PROVIDED — PHP 8.3 + MySQL 8.4
├── docker/php/Dockerfile                  # PROVIDED — PHP image + Composer
├── docs/
│   ├── SPEC.md
│   ├── PLAN.md
│   └── SETUP-WINDOWS.md
├── backend/                               # PROVIDED, then configured in B1
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/V1/        # one controller per resource
│   │   │   ├── Requests/                  # one FormRequest per write endpoint
│   │   │   └── Resources/                 # one API Resource per model
│   │   ├── Models/                        # relations, casts, scopes ONLY
│   │   ├── Policies/                      # NotePolicy, FolderPolicy, TagPolicy
│   │   ├── Exceptions/
│   │   │   └── NoteConflictException.php   # renders itself as 409
│   │   ├── Queries/
│   │   │   └── NotesQuery.php              # index filtering + sorting
│   │   ├── Services/                       # one action per class, __invoke()
│   │   │   ├── Auth/           RegisterUser, AuthenticateUser, LogoutUser
│   │   │   ├── Users/          UpdateProfile, ChangePassword, UpdatePreferences
│   │   │   ├── Folders/        CreateFolder, RenameFolder, DeleteFolder
│   │   │   ├── Tags/           CreateTag, RenameTag, DeleteTag, UpsertTags
│   │   │   ├── Notes/          CreateNote, UpdateNote, SyncNoteTags, TrashNote,
│   │   │   │                   RestoreNote, ForceDeleteNote, EmptyTrash,
│   │   │   │                   DuplicateNote, DeriveNoteFields
│   │   │   ├── Search/         SearchNotes, SnippetBuilder, PlainTextExtractor
│   │   │   └── Bootstrap/      BuildBootstrapPayload
│   │   └── Console/Commands/
│   │       ├── PruneEmptyNotes.php
│   │       └── PurgeTrash.php
│   ├── database/migrations/
│   ├── routes/api.php
│   └── tests/Feature/                     # Pest
└── frontend/                              # PROVIDED, then configured in F1
    └── src/
        ├── api/        client.ts, auth.ts, notes.ts, folders.ts, tags.ts, search.ts
        ├── hooks/      queries/*.ts (TanStack), useAutosave.ts, useVisualViewport.ts
        ├── stores/     uiStore.ts (Zustand: tabs, panes, view)
        ├── types/      api.ts
        ├── components/
        │   ├── layout/   AppShell.tsx, Header.tsx, Sidebar.tsx, StatusBar.tsx
        │   ├── notes/    NoteList.tsx, NoteRow.tsx, FilterInput.tsx
        │   ├── editor/   Editor.tsx, Toolbar.tsx, TableBar.tsx, TabBar.tsx, TagStrip.tsx
        │   ├── search/   SpotlightSearch.tsx
        │   └── common/   Skeletons.tsx, ConfirmMenuItem.tsx, ConflictSheet.tsx
        ├── pages/      LoginPage.tsx, RegisterPage.tsx, AppPage.tsx
        └── lib/        drafts.ts (IndexedDB), titleFromDoc.ts, delayedLoading.ts
```

---

# PHASE 1 — BACKEND

### Task B1: Verify and configure the provided Laravel app

> **The app already exists.** Do not run `laravel new` or `composer create-project`.
> This task inspects what the developer created and applies the configuration the rest
> of the plan depends on. Every step is safe to re-run.

**Files:**
- Modify: `backend/bootstrap/app.php`, `backend/config/cors.php`,
  `backend/config/database.php`, `backend/.env`, `backend/routes/api.php`
- Test: `backend/tests/Feature/HealthTest.php`

**Interfaces:**
- Produces: a booting Laravel app on MySQL with `statefulApi()` middleware, Sanctum
  installed, Pest available, and a `GET /api/v1/health` route returning
  `{"status":"ok"}`.

- [ ] **Step 1: Verify the scaffold and fill in what is missing**

```powershell
docker compose up -d
docker compose exec app php artisan --version      # must report Laravel 12.x
```

If that does not print `Laravel Framework 12.x`, **stop and report it** — do not try to
upgrade or reinstall.

Then apply only the pieces that are absent. Each command is a no-op if already done:

```powershell
# Sanctum + routes/api.php. Skip if backend/routes/api.php already exists.
docker compose exec app php artisan install:api

# Pest. Skip if backend/tests/Pest.php already exists.
docker compose exec app composer require pestphp/pest --dev --with-all-dependencies
docker compose exec app ./vendor/bin/pest --init
```

Confirm the result:

```powershell
docker compose exec app php artisan route:list     # sanctum/csrf-cookie is present
docker compose exec app php artisan test           # the default suite passes
```

- [ ] **Step 2: Configure `.env`**

```dotenv
APP_URL=http://127.0.0.1:8000
DB_CONNECTION=mysql
# Under Docker this is the compose service name, not an address on the host.
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=notes
DB_USERNAME=root
DB_PASSWORD=secret
SESSION_DRIVER=database
# Leave SESSION_DOMAIN unset in development. The Vite proxy makes the SPA and the
# API same-origin at localhost:5173, and pinning a domain here stops the session
# cookie being set at all. Production sets it to the shared parent, e.g. .example.com
SESSION_DOMAIN=null
SESSION_LIFETIME=10080
QUEUE_CONNECTION=database

# Password reset sends mail. With the default `log` driver nothing is delivered —
# the message is written to storage/logs/laravel.log. Fine for development, and it
# MUST be replaced with a real transport before production or reset silently fails.
MAIL_MAILER=log

SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173,localhost:8000,127.0.0.1:8000
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 3: Enable stateful API requests**

In `backend/bootstrap/app.php`:

```php
use Illuminate\Foundation\Configuration\Middleware;

->withMiddleware(function (Middleware $middleware) {
    $middleware->statefulApi();
})
```

- [ ] **Step 4: Configure CORS**

`backend/config/cors.php`:

```php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:5173')],
    'allowed_headers' => ['*'],
    'supports_credentials' => true,
];
```

- [ ] **Step 5: Force utf8mb4 collation**

`backend/config/database.php`, in the `mysql` connection:

```php
'charset' => 'utf8mb4',
'collation' => 'utf8mb4_0900_ai_ci',
```

- [ ] **Step 6: Write the failing test**

`backend/tests/Feature/HealthTest.php`:

```php
<?php
it('reports health', function () {
    $this->getJson('/api/v1/health')
        ->assertOk()
        ->assertJson(['status' => 'ok']);
});
```

- [ ] **Step 7: Run it and watch it fail**

```bash
php artisan test --filter=HealthTest
```
Expected: FAIL — 404.

- [ ] **Step 8: Add the route**

`backend/routes/api.php`:

```php
<?php
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/health', fn () => ['status' => 'ok']);
});
```

- [ ] **Step 9: Migrate and run the test**

```bash
php artisan migrate
php artisan test --filter=HealthTest
```
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(backend): scaffold Laravel API-only app with Sanctum stateful middleware"
```

---

### Task B1b: Service layer skeleton and the architecture guard

**Files:**
- Create: `backend/app/Exceptions/NoteConflictException.php`,
  `backend/app/Services/.gitkeep`, `backend/app/Queries/.gitkeep`
- Test: `backend/tests/Feature/ArchitectureTest.php`

**Interfaces:**
- Produces: `NoteConflictException` — thrown by `Services\Notes\UpdateNote`, renders
  itself as the 409 contract, so no controller ever branches on a conflict.
- Produces the architecture test that fails the build if logic creeps back into a
  controller. Every later backend task must keep it green.

- [ ] **Step 1: Write the failing architecture test**

`backend/tests/Feature/ArchitectureTest.php`:

```php
<?php

/**
 * Controllers are HTTP adapters. This test is the enforcement: if it fails,
 * move the logic into a service rather than relaxing the test.
 */
it('keeps controllers free of business logic', function () {
    $forbidden = [
        '/DB::/'                 => 'the DB facade',
        '/->where\(/'            => 'query building',
        '/->get\(\)/'            => 'query execution',
        '/->save\(\)/'           => 'persistence',
        '/->update\(\[/'         => 'mass update',
        '/->delete\(\)/'         => 'deletion',
        '/transaction\(/'        => 'a transaction',
        '/\bif\s*\(/'            => 'a conditional',
        '/\bforeach\s*\(/'       => 'a loop',
    ];

    $files = glob(app_path('Http/Controllers/Api/V1/*.php'));
    expect($files)->not->toBeEmpty();

    foreach ($files as $file) {
        $source = file_get_contents($file);

        foreach ($forbidden as $pattern => $label) {
            expect(preg_match($pattern, $source))->toBe(
                0,
                basename($file)." contains {$label}; move it into a service.",
            );
        }
    }
});

it('keeps models free of business methods', function () {
    $allowed = [
        'casts', 'uniqueIds', 'getRouteKeyName', 'booted',
        'user', 'folder', 'folders', 'notes', 'tags', 'parent', 'children',
    ];

    foreach (glob(app_path('Models/*.php')) as $file) {
        $class = 'App\\Models\\'.basename($file, '.php');
        $reflection = new ReflectionClass($class);

        foreach ($reflection->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
            if ($method->class !== $class) {
                continue;
            }

            expect($method->getName())->toBeIn(
                array_merge($allowed, ['scopeOwnedBy']),
                "{$class}::{$method->getName()}() is business logic; move it to a service.",
            );
        }
    }
});

it('gives every service exactly one public entry point', function () {
    foreach (glob(app_path('Services/*/*.php')) as $file) {
        $class = 'App\\Services\\'.basename(dirname($file)).'\\'.basename($file, '.php');
        $reflection = new ReflectionClass($class);

        $public = array_filter(
            $reflection->getMethods(ReflectionMethod::IS_PUBLIC),
            fn ($m) => $m->class === $class && ! $m->isConstructor() && ! $m->isStatic(),
        );

        expect(array_map(fn ($m) => $m->getName(), $public))->toBe(
            ['__invoke'],
            "{$class} must expose exactly one action: __invoke().",
        );
    }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
php artisan test --filter=ArchitectureTest
```
Expected: FAIL — `expect($files)->not->toBeEmpty()` fails, no controllers yet.

- [ ] **Step 3: Write the conflict exception**

`backend/app/Exceptions/NoteConflictException.php`:

```php
<?php
namespace App\Exceptions;

use App\Http\Resources\NoteResource;
use App\Models\Note;
use Exception;
use Illuminate\Http\JsonResponse;

/**
 * Thrown by Services\Notes\UpdateNote when the client's version is stale.
 * Rendering itself is what keeps the 409 branch out of the controller.
 */
class NoteConflictException extends Exception
{
    public function __construct(public readonly Note $note)
    {
        parent::__construct('This note changed somewhere else.');
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => __('This note changed somewhere else.'),
            'server_copy' => new NoteResource($this->note->load(['folder', 'tags'])),
        ], 409);
    }
}
```

- [ ] **Step 4: Create the empty layer directories**

```powershell
# PowerShell
New-Item -ItemType Directory -Force app/Services, app/Queries, app/Exceptions | Out-Null
New-Item -ItemType File -Force app/Services/.gitkeep, app/Queries/.gitkeep | Out-Null
```

```bash
# macOS / Linux
mkdir -p app/Services app/Queries app/Exceptions
touch app/Services/.gitkeep app/Queries/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore(backend): service layer conventions and architecture guard"
```

> From here on, **every backend task must leave `ArchitectureTest` green.** Run
> `php artisan test --filter=ArchitectureTest` before each commit.

---

### Task B2: Authentication endpoints

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/AuthController.php`,
  `backend/app/Http/Requests/RegisterRequest.php`,
  `backend/app/Http/Requests/LoginRequest.php`,
  `backend/app/Http/Resources/UserResource.php`
- Modify: `backend/routes/api.php`, `backend/app/Models/User.php`,
  `backend/database/migrations/*_create_users_table.php`
- Test: `backend/tests/Feature/AuthTest.php`

**Interfaces:**
- Produces: `POST /api/v1/register|login|logout`, `GET /api/v1/me`.
  `UserResource` shape: `{uuid, name, email, preferences}`.

- [ ] **Step 1: Add `uuid` and `preferences` to the users migration**

```php
$table->uuid('uuid')->unique()->after('id');
$table->json('preferences')->nullable()->after('password');
```

- [ ] **Step 2: Give User a UUID**

`backend/app/Models/User.php`:

```php
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class User extends Authenticatable
{
    use HasUuids;

    public function uniqueIds(): array { return ['uuid']; }
    public function getRouteKeyName(): string { return 'uuid'; }

    protected $fillable = ['name', 'email', 'password', 'preferences'];
    protected $hidden = ['password', 'remember_token'];
    protected function casts(): array
    {
        return ['password' => 'hashed', 'preferences' => 'array'];
    }
}
```

- [ ] **Step 3: Write the failing tests**

`backend/tests/Feature/AuthTest.php`:

```php
<?php
use App\Models\User;

it('registers a user and signs them in', function () {
    $this->postJson('/api/v1/register', [
        'name' => 'Akash',
        'email' => 'akash@example.com',
        'password' => 'correct-horse-battery',
        'password_confirmation' => 'correct-horse-battery',
    ])->assertCreated()->assertJsonPath('data.email', 'akash@example.com');

    $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.name', 'Akash');
});

it('rejects a bad password with a generic message', function () {
    User::factory()->create(['email' => 'a@b.com']);

    $this->postJson('/api/v1/login', ['email' => 'a@b.com', 'password' => 'wrong'])
        ->assertStatus(422);
});

it('refuses /me when signed out', function () {
    $this->getJson('/api/v1/me')->assertUnauthorized();
});

it('signs out', function () {
    $this->actingAs(User::factory()->create());
    $this->postJson('/api/v1/logout')->assertNoContent();
});
```

- [ ] **Step 4: Run them and watch them fail**

```bash
php artisan test --filter=AuthTest
```
Expected: FAIL — 404 on every route.

- [ ] **Step 5: Write the requests**

`backend/app/Http/Requests/RegisterRequest.php`:

```php
<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()->min(8)->uncompromised()],
        ];
    }
}
```

`backend/app/Http/Requests/LoginRequest.php`:

```php
<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ];
    }
}
```

- [ ] **Step 6: Write the resource**

`backend/app/Http/Resources/UserResource.php`:

```php
<?php
namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'name' => $this->name,
            'email' => $this->email,
            'preferences' => $this->preferences ?? [],
        ];
    }
}
```

- [ ] **Step 7: Write the services**

`backend/app/Services/Auth/RegisterUser.php`:

```php
<?php
namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Auth;

class RegisterUser
{
    public function __invoke(array $data, Session $session): User
    {
        $user = User::create($data);

        Auth::login($user);
        $session->regenerate();

        return $user;
    }
}
```

`backend/app/Services/Auth/AuthenticateUser.php`:

```php
<?php
namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthenticateUser
{
    public function __invoke(array $credentials, Session $session): User
    {
        if (! Auth::attempt($credentials, true)) {
            // Deliberately generic: never reveal whether the email exists.
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        $session->regenerate();

        return Auth::user();
    }
}
```

`backend/app/Services/Auth/LogoutUser.php`:

```php
<?php
namespace App\Services\Auth;

use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Auth;

class LogoutUser
{
    public function __invoke(Session $session): void
    {
        Auth::guard('web')->logout();
        $session->invalidate();
        $session->regenerateToken();
    }
}
```

- [ ] **Step 8: Write the controller — delegation only**

`backend/app/Http/Controllers/Api/V1/AuthController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\AuthenticateUser;
use App\Services\Auth\LogoutUser;
use App\Services\Auth\RegisterUser;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function register(RegisterRequest $request, RegisterUser $register)
    {
        $user = $register($request->validated(), $request->session());

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function login(LoginRequest $request, AuthenticateUser $authenticate)
    {
        return new UserResource($authenticate($request->validated(), $request->session()));
    }

    public function logout(Request $request, LogoutUser $logout)
    {
        $logout($request->session());

        return response()->noContent();
    }

    public function me(Request $request)
    {
        return new UserResource($request->user());
    }
}
```

- [ ] **Step 9: Register the routes**

`backend/routes/api.php`:

```php
use App\Http\Controllers\Api\V1\AuthController;

Route::prefix('v1')->group(function () {
    Route::get('/health', fn () => ['status' => 'ok']);

    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });
});
```

- [ ] **Step 10: Run the tests**

```bash
php artisan test --filter=AuthTest
```
Expected: PASS (4 tests).

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat(backend): register, login, logout and me endpoints"
```

---

### Task B3: Profile, password change and password reset

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/ProfileController.php`,
  `backend/app/Http/Controllers/Api/V1/PasswordResetController.php`,
  `backend/app/Http/Requests/UpdateProfileRequest.php`,
  `backend/app/Http/Requests/UpdatePasswordRequest.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/ProfileTest.php`

**Interfaces:**
- Produces: `PATCH /api/v1/me`, `PUT /api/v1/me/password`,
  `POST /api/v1/forgot-password`, `POST /api/v1/reset-password`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/ProfileTest.php`:

```php
<?php
use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('updates the profile', function () {
    $this->actingAs(User::factory()->create());

    $this->patchJson('/api/v1/me', ['name' => 'New Name'])
        ->assertOk()->assertJsonPath('data.name', 'New Name');
});

it('changes the password when the current one is right', function () {
    $user = User::factory()->create(['password' => Hash::make('old-password-123')]);
    $this->actingAs($user);

    $this->putJson('/api/v1/me/password', [
        'current_password' => 'old-password-123',
        'password' => 'new-password-456',
        'password_confirmation' => 'new-password-456',
    ])->assertNoContent();

    expect(Hash::check('new-password-456', $user->fresh()->password))->toBeTrue();
});

it('refuses a password change with the wrong current password', function () {
    $this->actingAs(User::factory()->create(['password' => Hash::make('old-password-123')]));

    $this->putJson('/api/v1/me/password', [
        'current_password' => 'nope',
        'password' => 'new-password-456',
        'password_confirmation' => 'new-password-456',
    ])->assertStatus(422);
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
php artisan test --filter=ProfileTest
```
Expected: FAIL — 404.

- [ ] **Step 3: Write the requests**

`backend/app/Http/Requests/UpdateProfileRequest.php`:

```php
<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($this->user()->id)],
        ];
    }
}
```

`backend/app/Http/Requests/UpdatePasswordRequest.php`:

```php
<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdatePasswordRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::defaults()->min(8)],
        ];
    }
}
```

- [ ] **Step 4: Write the services**

`backend/app/Services/Users/UpdateProfile.php`:

```php
<?php
namespace App\Services\Users;

use App\Models\User;

class UpdateProfile
{
    public function __invoke(User $user, array $data): User
    {
        $user->update($data);

        return $user->fresh();
    }
}
```

`backend/app/Services/Users/ChangePassword.php`:

```php
<?php
namespace App\Services\Users;

use App\Models\User;
use Illuminate\Contracts\Session\Session;

class ChangePassword
{
    public function __invoke(User $user, string $password, Session $session): void
    {
        $user->update(['password' => $password]);
        // Keep this session alive while invalidating the others.
        $session->regenerate();
    }
}
```

`backend/app/Services/Users/UpdatePreferences.php`:

```php
<?php
namespace App\Services\Users;

use App\Models\User;

class UpdatePreferences
{
    public function __invoke(User $user, array $changes): User
    {
        // Merge, so a stale client cannot blank out keys it does not know about.
        $user->update(['preferences' => array_merge($user->preferences ?? [], $changes)]);

        return $user->fresh();
    }
}
```

- [ ] **Step 5: Write the preferences request**

`backend/app/Http/Requests/UpdatePreferencesRequest.php`:

```php
<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePreferencesRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'theme' => ['sometimes', 'in:light,dark,system'],
            'sort' => ['sometimes', 'in:updated,created,title'],
            'group_by_date' => ['sometimes', 'boolean'],
            'show_snippets' => ['sometimes', 'boolean'],
        ];
    }
}
```

- [ ] **Step 6: Write the controllers — delegation only**

`backend/app/Http/Controllers/Api/V1/ProfileController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePasswordRequest;
use App\Http\Requests\UpdatePreferencesRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Services\Users\ChangePassword;
use App\Services\Users\UpdatePreferences;
use App\Services\Users\UpdateProfile;

class ProfileController extends Controller
{
    public function update(UpdateProfileRequest $request, UpdateProfile $updateProfile)
    {
        return new UserResource($updateProfile($request->user(), $request->validated()));
    }

    public function password(UpdatePasswordRequest $request, ChangePassword $changePassword)
    {
        $changePassword($request->user(), $request->validated('password'), $request->session());

        return response()->noContent();
    }

    public function preferences(UpdatePreferencesRequest $request, UpdatePreferences $updatePreferences)
    {
        return new UserResource($updatePreferences($request->user(), $request->validated()));
    }
}
```

`backend/app/Services/Auth/SendPasswordResetLink.php`:

```php
<?php
namespace App\Services\Auth;

use Illuminate\Support\Facades\Password;

class SendPasswordResetLink
{
    public function __invoke(string $email): void
    {
        // Fire and forget: the caller always responds 204, so the API never
        // reveals whether the address is registered.
        Password::sendResetLink(['email' => $email]);
    }
}
```

`backend/app/Services/Auth/ResetPassword.php`:

```php
<?php
namespace App\Services\Auth;

use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ResetPassword
{
    public function __invoke(array $credentials): void
    {
        $status = Password::reset($credentials, function ($user, $password) {
            $user->forceFill([
                'password' => Hash::make($password),
                'remember_token' => Str::random(60),
            ])->save();

            event(new PasswordReset($user));
        });

        if ($status !== Password::PasswordReset) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }
    }
}
```

`backend/app/Http/Requests/ForgotPasswordRequest.php` validates
`['email' => ['required', 'email']]`, and
`backend/app/Http/Requests/ResetPasswordRequest.php` validates
`['token' => ['required'], 'email' => ['required','email'], 'password' => ['required','confirmed','min:8']]`.
Both `authorize()` return `true`.

`backend/app/Http/Controllers/Api/V1/PasswordResetController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Services\Auth\ResetPassword;
use App\Services\Auth\SendPasswordResetLink;

class PasswordResetController extends Controller
{
    public function forgot(ForgotPasswordRequest $request, SendPasswordResetLink $sendLink)
    {
        $sendLink($request->validated('email'));

        return response()->noContent();
    }

    public function reset(ResetPasswordRequest $request, ResetPassword $resetPassword)
    {
        $resetPassword($request->validated());

        return response()->noContent();
    }
}
```

- [ ] **Step 7: Register the routes**

Add to `routes/api.php`, inside `prefix('v1')`:

```php
Route::post('/forgot-password', [PasswordResetController::class, 'forgot'])->middleware('throttle:5,1');
Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::patch('/me', [ProfileController::class, 'update']);
    Route::put('/me/password', [ProfileController::class, 'password']);
    Route::patch('/preferences', [ProfileController::class, 'preferences']);
});
```

- [ ] **Step 8: Run the tests**

```bash
php artisan test --filter=ProfileTest
php artisan test --filter=ArchitectureTest
```
Expected: PASS (3 tests), and the architecture guard stays green.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(backend): profile, password change, password reset and preferences"
```

---

### Task B4: Folders

**Files:**
- Create: `backend/database/migrations/*_create_folders_table.php`,
  `backend/app/Models/Folder.php`, `backend/app/Policies/FolderPolicy.php`,
  `backend/app/Http/Requests/StoreFolderRequest.php`,
  `backend/app/Http/Requests/UpdateFolderRequest.php`,
  `backend/app/Http/Resources/FolderResource.php`,
  `backend/app/Http/Controllers/Api/V1/FolderController.php`,
  `backend/database/factories/FolderFactory.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/FolderTest.php`

**Interfaces:**
- Consumes: `User` from B2.
- Produces: `Folder` model with `user_id`, `parent_id` (**`0` = root sentinel, never
  `NULL`**), `name`, `color`, `position`. Routes `POST /folders`,
  `PATCH /folders/{uuid}`, `DELETE /folders/{uuid}`.
  `FolderResource`: `{uuid, name, parent_uuid, color, position}`.

- [ ] **Step 1: Create the migration**

```bash
php artisan make:migration create_folders_table
```

```php
Schema::create('folders', function (Blueprint $table) {
    $table->id();
    $table->uuid('uuid')->unique();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    // 0 is the root sentinel. NULL would defeat the unique index below,
    // because MySQL treats every NULL as distinct.
    $table->unsignedBigInteger('parent_id')->default(0);
    $table->string('name', 120);
    $table->char('color', 7)->nullable();
    $table->integer('position')->default(0);
    $table->timestamps();

    $table->unique(['user_id', 'parent_id', 'name']);
    $table->index(['user_id', 'parent_id']);
});
```

- [ ] **Step 2: Write the failing tests**

`backend/tests/Feature/FolderTest.php`:

```php
<?php
use App\Models\Folder;
use App\Models\Note;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('creates a folder', function () {
    $this->postJson('/api/v1/folders', ['name' => 'Work'])
        ->assertCreated()->assertJsonPath('data.name', 'Work');
});

it('rejects two root folders with the same name', function () {
    Folder::factory()->for($this->user)->create(['name' => 'Work', 'parent_id' => 0]);

    $this->postJson('/api/v1/folders', ['name' => 'Work'])->assertStatus(422);
});

it('allows the same name under different parents', function () {
    $parent = Folder::factory()->for($this->user)->create(['name' => 'Work']);

    $this->postJson('/api/v1/folders', ['name' => 'Drafts'])->assertCreated();
    $this->postJson('/api/v1/folders', ['name' => 'Drafts', 'parent_uuid' => $parent->uuid])
        ->assertCreated();
});

it('moves notes to root when a folder is deleted, and deletes no notes', function () {
    $folder = Folder::factory()->for($this->user)->create();
    $note = Note::factory()->for($this->user)->create(['folder_id' => $folder->id]);

    $this->deleteJson("/api/v1/folders/{$folder->uuid}")->assertNoContent();

    expect($note->fresh())->not->toBeNull()
        ->and($note->fresh()->folder_id)->toBeNull()
        ->and($note->fresh()->deleted_at)->toBeNull();
});

it('refuses to touch another user\'s folder', function () {
    $other = Folder::factory()->for(User::factory())->create();

    $this->deleteJson("/api/v1/folders/{$other->uuid}")->assertForbidden();
});
```

- [ ] **Step 3: Run them and watch them fail**

```bash
php artisan test --filter=FolderTest
```
Expected: FAIL — `Folder` class not found.

- [ ] **Step 4: Write the model and factory**

`backend/app/Models/Folder.php`:

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Folder extends Model
{
    use HasFactory, HasUuids;

    public const ROOT = 0;

    protected $fillable = ['name', 'parent_id', 'color', 'position'];

    public function uniqueIds(): array { return ['uuid']; }
    public function getRouteKeyName(): string { return 'uuid'; }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function notes(): HasMany { return $this->hasMany(Note::class); }
    public function parent(): BelongsTo { return $this->belongsTo(self::class, 'parent_id'); }
}
```

`backend/database/factories/FolderFactory.php`:

```php
<?php
namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class FolderFactory extends Factory
{
    public function definition(): array
    {
        // Sequence, never random data: tests must be reproducible.
        static $n = 0;
        $n++;

        return ['name' => "Folder {$n}", 'parent_id' => 0, 'position' => $n];
    }
}
```

- [ ] **Step 5: Write the policy**

`backend/app/Policies/FolderPolicy.php`:

```php
<?php
namespace App\Policies;

use App\Models\Folder;
use App\Models\User;

class FolderPolicy
{
    public function update(User $user, Folder $folder): bool
    {
        return $folder->user_id === $user->id;
    }

    public function delete(User $user, Folder $folder): bool
    {
        return $folder->user_id === $user->id;
    }
}
```

- [ ] **Step 6: Write the requests and resource**

`backend/app/Http/Requests/StoreFolderRequest.php`:

```php
<?php
namespace App\Http\Requests;

use App\Queries\FolderQuery;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFolderRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:120',
                Rule::unique('folders', 'name')
                    ->where('user_id', $this->user()->id)
                    ->where('parent_id', $this->parentId()),
            ],
            'parent_uuid' => ['nullable', 'uuid'],
            'color' => ['nullable', 'string', 'size:7'],
        ];
    }

    public function parentId(): int
    {
        return app(FolderQuery::class)
            ->parentIdForUuid($this->user(), $this->input('parent_uuid'));
    }
}
```

`backend/app/Queries/FolderQuery.php` — the single place a folder UUID becomes an id:

```php
<?php
namespace App\Queries;

use App\Models\Folder;
use App\Models\User;

class FolderQuery
{
    /** Resolve a folder UUID to its id, scoped to the owner. */
    public function idForUuid(User $user, ?string $uuid): ?int
    {
        if (! $uuid) {
            return null;
        }

        return (int) Folder::where('user_id', $user->id)
            ->where('uuid', $uuid)
            ->valueOrFail('id');
    }

    /** Same, but falls back to the root sentinel rather than null. */
    public function parentIdForUuid(User $user, ?string $uuid): int
    {
        return $this->idForUuid($user, $uuid) ?? Folder::ROOT;
    }
}
```

`backend/app/Http/Requests/UpdateFolderRequest.php` — same rules, all `sometimes`:

```php
<?php
namespace App\Http\Requests;

use App\Models\Folder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFolderRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => [
                'sometimes', 'string', 'max:120',
                Rule::unique('folders', 'name')
                    ->where('user_id', $this->user()->id)
                    ->where('parent_id', $this->route('folder')->parent_id)
                    ->ignore($this->route('folder')->id),
            ],
            'color' => ['nullable', 'string', 'size:7'],
            'position' => ['sometimes', 'integer'],
        ];
    }
}
```

`backend/app/Http/Resources/FolderResource.php`:

```php
<?php
namespace App\Http\Resources;

use App\Models\Folder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FolderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'name' => $this->name,
            'parent_uuid' => $this->parent_id === Folder::ROOT ? null : $this->parent?->uuid,
            'color' => $this->color,
            'position' => $this->position,
        ];
    }
}
```

- [ ] **Step 7: Write the services, then the controller**

`backend/app/Services/Folders/CreateFolder.php`:

```php
<?php
namespace App\Services\Folders;

use App\Models\Folder;
use App\Models\User;

class CreateFolder
{
    public function __invoke(User $user, string $name, int $parentId, ?string $color = null): Folder
    {
        return $user->folders()->create([
            'name' => $name,
            'parent_id' => $parentId,
            'color' => $color,
        ]);
    }
}
```

`backend/app/Services/Folders/RenameFolder.php`:

```php
<?php
namespace App\Services\Folders;

use App\Models\Folder;

class RenameFolder
{
    public function __invoke(Folder $folder, array $attributes): Folder
    {
        $folder->update($attributes);

        return $folder->fresh();
    }
}
```

`backend/app/Services/Folders/DeleteFolder.php`:

```php
<?php
namespace App\Services\Folders;

use App\Models\Folder;
use Illuminate\Support\Facades\DB;

class DeleteFolder
{
    /**
     * Notes survive and move to root; child folders are reparented. Destroying
     * notes because someone tidied their sidebar is unforgivable, so the
     * reparenting and the delete share one transaction.
     */
    public function __invoke(Folder $folder): void
    {
        DB::transaction(function () use ($folder) {
            $folder->notes()->update(['folder_id' => null]);
            Folder::where('parent_id', $folder->id)->update(['parent_id' => Folder::ROOT]);
            $folder->delete();
        });
    }
}
```

`backend/app/Http/Controllers/Api/V1/FolderController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFolderRequest;
use App\Http\Requests\UpdateFolderRequest;
use App\Http\Resources\FolderResource;
use App\Models\Folder;
use App\Services\Folders\CreateFolder;
use App\Services\Folders\DeleteFolder;
use App\Services\Folders\RenameFolder;

class FolderController extends Controller
{
    public function store(StoreFolderRequest $request, CreateFolder $createFolder)
    {
        $folder = $createFolder(
            $request->user(),
            $request->validated('name'),
            $request->parentId(),
            $request->validated('color'),
        );

        return (new FolderResource($folder))->response()->setStatusCode(201);
    }

    public function update(UpdateFolderRequest $request, Folder $folder, RenameFolder $renameFolder)
    {
        $this->authorize('update', $folder);

        return new FolderResource($renameFolder($folder, $request->validated()));
    }

    public function destroy(Folder $folder, DeleteFolder $deleteFolder)
    {
        $this->authorize('delete', $folder);

        $deleteFolder($folder);

        return response()->noContent();
    }
}
```

- [ ] **Step 8: Add the `folders` relation to User**

In `backend/app/Models/User.php`:

```php
public function folders(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(Folder::class);
}
```

- [ ] **Step 9: Register the routes**

Inside the `auth:sanctum` group in `routes/api.php`:

```php
Route::post('/folders', [FolderController::class, 'store']);
Route::patch('/folders/{folder}', [FolderController::class, 'update']);
Route::delete('/folders/{folder}', [FolderController::class, 'destroy']);
```

- [ ] **Step 10: Run the tests**

```bash
php artisan migrate && php artisan test --filter=FolderTest
php artisan test --filter=ArchitectureTest
```
Expected: PASS (5 tests), architecture guard green. Test 4 is Review Focus item 4 and
test 2 is item 3.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat(backend): folders with root sentinel and non-destructive delete"
```

---

### Task B5: Tags

**Files:**
- Create: `backend/database/migrations/*_create_tags_table.php`,
  `backend/database/migrations/*_create_note_tag_table.php`,
  `backend/app/Models/Tag.php`, `backend/app/Policies/TagPolicy.php`,
  `backend/app/Http/Resources/TagResource.php`,
  `backend/app/Http/Controllers/Api/V1/TagController.php`,
  `backend/database/factories/TagFactory.php`
- Modify: `backend/routes/api.php`, `backend/app/Models/User.php`
- Test: `backend/tests/Feature/TagTest.php`

**Interfaces:**
- Produces: `Tag` model with `user_id`, `name`, `slug`. `note_tag` pivot.
  Routes `POST /tags`, `PATCH /tags/{uuid}`, `DELETE /tags/{uuid}`.
  `TagResource`: `{uuid, name, slug}`.
  `Services\Tags\UpsertTags::__invoke(User $user, array $names): Collection` — used by B9.

- [ ] **Step 1: Create the migrations**

```php
// create_tags_table
Schema::create('tags', function (Blueprint $table) {
    $table->id();
    $table->uuid('uuid')->unique();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('name', 60);
    $table->string('slug', 60);
    $table->timestamps();

    $table->unique(['user_id', 'slug']);
});

// create_note_tag_table  (run AFTER the notes migration in B6; name it with a later timestamp)
Schema::create('note_tag', function (Blueprint $table) {
    $table->foreignId('note_id')->constrained()->cascadeOnDelete();
    $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
    $table->primary(['note_id', 'tag_id']);
    $table->index('tag_id');
});
```

- [ ] **Step 2: Write the failing tests**

`backend/tests/Feature/TagTest.php`:

```php
<?php
use App\Models\Tag;
use App\Models\User;
use App\Services\Tags\UpsertTags;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('creates a tag and slugs it', function () {
    $this->postJson('/api/v1/tags', ['name' => 'To Do'])
        ->assertCreated()->assertJsonPath('data.slug', 'to-do');
});

it('rejects a duplicate slug for the same user', function () {
    Tag::factory()->for($this->user)->create(['name' => 'todo', 'slug' => 'todo']);

    $this->postJson('/api/v1/tags', ['name' => 'Todo'])->assertStatus(422);
});

it('upserts by name and reuses existing tags', function () {
    Tag::factory()->for($this->user)->create(['name' => 'todo', 'slug' => 'todo']);

    $tags = app(UpsertTags::class)($this->user, ['todo', 'release']);

    expect($tags)->toHaveCount(2)
        ->and(Tag::where('user_id', $this->user->id)->count())->toBe(2);
});

it('renames a tag', function () {
    $tag = Tag::factory()->for($this->user)->create(['name' => 'old', 'slug' => 'old']);

    $this->patchJson("/api/v1/tags/{$tag->uuid}", ['name' => 'new'])
        ->assertOk()->assertJsonPath('data.slug', 'new');
});
```

- [ ] **Step 3: Run them and watch them fail**

```bash
php artisan test --filter=TagTest
```
Expected: FAIL — `Tag` class not found.

- [ ] **Step 4: Write the model and factory**

`backend/app/Models/Tag.php`:

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Tag extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['name', 'slug'];

    public function uniqueIds(): array { return ['uuid']; }
    public function getRouteKeyName(): string { return 'uuid'; }

    public function notes(): BelongsToMany { return $this->belongsToMany(Note::class); }
}
```

The model carries relations and nothing else. Resolving names to tags is an action, so
it lives in a service:

`backend/app/Services/Tags/UpsertTags.php`:

```php
<?php
namespace App\Services\Tags;

use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class UpsertTags
{
    /**
     * Resolve a list of tag names to models, creating the ones that do not
     * exist. This is what lets the tag picker create a tag in the same request
     * that attaches it.
     */
    public function __invoke(User $user, array $names): Collection
    {
        return collect($names)
            ->map(fn (string $name) => trim($name))
            ->filter()
            ->unique(fn (string $name) => Str::slug($name))
            ->map(fn (string $name) => Tag::firstOrCreate(
                ['user_id' => $user->id, 'slug' => Str::slug($name)],
                ['name' => $name],
            ))
            ->values();
    }
}
```

`backend/database/factories/TagFactory.php`:

```php
<?php
namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class TagFactory extends Factory
{
    public function definition(): array
    {
        static $n = 0;
        $n++;

        return ['name' => "tag{$n}", 'slug' => "tag{$n}"];
    }
}
```

- [ ] **Step 5: Write the resource, policy and controller**

`backend/app/Http/Resources/TagResource.php`:

```php
<?php
namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TagResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['uuid' => $this->uuid, 'name' => $this->name, 'slug' => $this->slug];
    }
}
```

`backend/app/Policies/TagPolicy.php`:

```php
<?php
namespace App\Policies;

use App\Models\Tag;
use App\Models\User;

class TagPolicy
{
    public function update(User $user, Tag $tag): bool { return $tag->user_id === $user->id; }
    public function delete(User $user, Tag $tag): bool { return $tag->user_id === $user->id; }
}
```

`backend/app/Http/Requests/StoreTagRequest.php` — uniqueness is validation, so the slug
rule belongs here, not in a controller:

```php
<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreTagRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('tags', 'slug')
                    ->where('user_id', $this->user()->id)
                    ->where('slug', Str::slug((string) $this->input('name'))),
            ],
        ];
    }
}
```

`backend/app/Http/Requests/UpdateTagRequest.php` is the same with the current tag
ignored via `->ignore($this->route('tag')->id)`.

`backend/app/Services/Tags/CreateTag.php`:

```php
<?php
namespace App\Services\Tags;

use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Str;

class CreateTag
{
    public function __invoke(User $user, string $name): Tag
    {
        return $user->tags()->create(['name' => $name, 'slug' => Str::slug($name)]);
    }
}
```

`backend/app/Services/Tags/RenameTag.php`:

```php
<?php
namespace App\Services\Tags;

use App\Models\Tag;
use Illuminate\Support\Str;

class RenameTag
{
    public function __invoke(Tag $tag, string $name): Tag
    {
        $tag->update(['name' => $name, 'slug' => Str::slug($name)]);

        return $tag->fresh();
    }
}
```

`backend/app/Services/Tags/DeleteTag.php`:

```php
<?php
namespace App\Services\Tags;

use App\Models\Tag;

class DeleteTag
{
    /** Detaching happens through the pivot's cascade. Notes are untouched. */
    public function __invoke(Tag $tag): void
    {
        $tag->delete();
    }
}
```

`backend/app/Http/Controllers/Api/V1/TagController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTagRequest;
use App\Http\Requests\UpdateTagRequest;
use App\Http\Resources\TagResource;
use App\Models\Tag;
use App\Services\Tags\CreateTag;
use App\Services\Tags\DeleteTag;
use App\Services\Tags\RenameTag;

class TagController extends Controller
{
    public function store(StoreTagRequest $request, CreateTag $createTag)
    {
        $tag = $createTag($request->user(), $request->validated('name'));

        return (new TagResource($tag))->response()->setStatusCode(201);
    }

    public function update(UpdateTagRequest $request, Tag $tag, RenameTag $renameTag)
    {
        $this->authorize('update', $tag);

        return new TagResource($renameTag($tag, $request->validated('name')));
    }

    public function destroy(Tag $tag, DeleteTag $deleteTag)
    {
        $this->authorize('delete', $tag);

        $deleteTag($tag);

        return response()->noContent();
    }
}
```

- [ ] **Step 6: Add the `tags` relation to User, register the routes**

```php
// User.php
public function tags(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(Tag::class);
}

// routes/api.php, inside auth:sanctum
Route::post('/tags', [TagController::class, 'store']);
Route::patch('/tags/{tag}', [TagController::class, 'update']);
Route::delete('/tags/{tag}', [TagController::class, 'destroy']);
```

- [ ] **Step 7: Run the tests**

```bash
php artisan migrate && php artisan test --filter=TagTest
```
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(backend): tags with name-based upsert"
```

---

### Task B6: Notes table, model and plain-text extraction

**Files:**
- Create: `backend/database/migrations/*_create_notes_table.php`,
  `backend/database/migrations/*_create_note_versions_table.php`,
  `backend/app/Models/Note.php`, `backend/app/Policies/NotePolicy.php`,
  `backend/app/Support/PlainTextExtractor.php`,
  `backend/app/Services/Notes/DeriveNoteFields.php`,
  `backend/database/factories/NoteFactory.php`
- Modify: `backend/app/Models/User.php`
- Test: `backend/tests/Unit/PlainTextExtractorTest.php`

**Interfaces:**
- Produces:
  - `Note` model: `uuid, user_id, folder_id, title, title_locked, body, plain_text,
    excerpt, is_starred, version, word_count, deleted_at`.
  - `App\Support\PlainTextExtractor::extract(?array $doc): string` — walks a
    ProseMirror document and returns its text, nodes separated by a single space.
    A pure stateless helper, which is why it lives in `Support` rather than
    `Services` and is exempt from the one-action rule.
  - `App\Support\PlainTextExtractor::title(?array $doc): string` — first heading,
    else first non-empty text block, truncated to 120 chars.
  - `App\Services\Notes\DeriveNoteFields::__invoke(Note $note): void` — recomputes
    `plain_text`, `excerpt`, `word_count` and (unless locked) `title` from `body`.

- [ ] **Step 1: Create the migrations**

```bash
php artisan make:migration create_notes_table
php artisan make:migration create_note_versions_table
```

```php
// create_notes_table
Schema::create('notes', function (Blueprint $table) {
    $table->id();
    $table->uuid('uuid')->unique();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('folder_id')->nullable()->constrained()->nullOnDelete();
    $table->string('title', 255)->default('');
    $table->boolean('title_locked')->default(false);
    $table->json('body')->nullable();          // JSON columns cannot have a DEFAULT
    $table->longText('plain_text')->nullable();
    $table->string('excerpt', 200)->default('');
    $table->boolean('is_starred')->default(false);
    $table->unsignedInteger('version')->default(1);
    $table->unsignedInteger('word_count')->default(0);
    $table->softDeletes();
    $table->timestamps();

    $table->index(['user_id', 'deleted_at', 'updated_at']);
    $table->index(['user_id', 'folder_id', 'deleted_at']);
    $table->index(['user_id', 'is_starred', 'deleted_at']);
});

// FULLTEXT must be added separately: the Blueprint helper is fine, but keep it
// in its own statement so the index name is predictable.
DB::statement('ALTER TABLE notes ADD FULLTEXT ft_notes (title, plain_text)');
```

```php
// create_note_versions_table — created now, written to in a later phase
Schema::create('note_versions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('note_id')->constrained()->cascadeOnDelete();
    $table->json('body');
    $table->unsignedInteger('version');
    $table->timestamp('created_at')->nullable();

    $table->index(['note_id', 'version']);
});
```

- [ ] **Step 2: Write the failing unit test**

`backend/tests/Unit/PlainTextExtractorTest.php`:

```php
<?php
use App\Support\PlainTextExtractor;

$doc = [
    'type' => 'doc',
    'content' => [
        ['type' => 'heading', 'attrs' => ['level' => 1],
         'content' => [['type' => 'text', 'text' => 'Release plan']]],
        ['type' => 'paragraph',
         'content' => [
             ['type' => 'text', 'text' => 'Ship '],
             ['type' => 'text', 'marks' => [['type' => 'bold']], 'text' => 'r34'],
             ['type' => 'text', 'text' => ' on Thursday.'],
         ]],
    ],
];

it('flattens a ProseMirror document to text', function () use ($doc) {
    expect(PlainTextExtractor::extract($doc))
        ->toBe('Release plan Ship r34 on Thursday.');
});

it('returns an empty string for an empty document', function () {
    expect(PlainTextExtractor::extract(['type' => 'doc', 'content' => []]))->toBe('')
        ->and(PlainTextExtractor::extract(null))->toBe('');
});

it('takes the title from the first heading', function () use ($doc) {
    expect(PlainTextExtractor::title($doc))->toBe('Release plan');
});

it('falls back to the first text block when there is no heading', function () {
    $doc = ['type' => 'doc', 'content' => [
        ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Just a line']]],
    ]];

    expect(PlainTextExtractor::title($doc))->toBe('Just a line');
});

it('truncates a long title to 120 characters', function () {
    $long = str_repeat('a', 200);
    $doc = ['type' => 'doc', 'content' => [
        ['type' => 'heading', 'content' => [['type' => 'text', 'text' => $long]]],
    ]];

    expect(mb_strlen(PlainTextExtractor::title($doc)))->toBe(120);
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
php artisan test --filter=PlainTextExtractorTest
```
Expected: FAIL — class not found.

- [ ] **Step 4: Write the extractor**

`backend/app/Support/PlainTextExtractor.php`:

```php
<?php
namespace App\Support;

class PlainTextExtractor
{
    public static function extract(?array $doc): string
    {
        if (! $doc) {
            return '';
        }

        $parts = [];
        self::walk($doc, $parts);

        return trim(preg_replace('/\s+/u', ' ', implode(' ', $parts)));
    }

    public static function title(?array $doc): string
    {
        if (! $doc) {
            return '';
        }

        foreach ($doc['content'] ?? [] as $node) {
            if (($node['type'] ?? null) === 'heading') {
                $parts = [];
                self::walk($node, $parts);
                $text = trim(implode(' ', $parts));
                if ($text !== '') {
                    return mb_substr($text, 0, 120);
                }
            }
        }

        foreach ($doc['content'] ?? [] as $node) {
            $parts = [];
            self::walk($node, $parts);
            $text = trim(implode(' ', $parts));
            if ($text !== '') {
                return mb_substr($text, 0, 120);
            }
        }

        return '';
    }

    private static function walk(array $node, array &$parts): void
    {
        if (isset($node['text']) && is_string($node['text'])) {
            $parts[] = $node['text'];
        }

        foreach ($node['content'] ?? [] as $child) {
            if (is_array($child)) {
                self::walk($child, $parts);
            }
        }
    }
}
```

- [ ] **Step 5: Run the test**

```bash
php artisan test --filter=PlainTextExtractorTest
```
Expected: PASS (5 tests).

- [ ] **Step 6: Write the model, policy and factory**

`backend/app/Models/Note.php`:

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Note extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'folder_id', 'title', 'title_locked', 'body',
        'plain_text', 'excerpt', 'is_starred', 'version', 'word_count',
    ];

    protected function casts(): array
    {
        return [
            'body' => 'array',
            'is_starred' => 'boolean',
            'title_locked' => 'boolean',
            'deleted_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array { return ['uuid']; }
    public function getRouteKeyName(): string { return 'uuid'; }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function folder(): BelongsTo { return $this->belongsTo(Folder::class); }
    public function tags(): BelongsToMany { return $this->belongsToMany(Tag::class); }

    public function scopeOwnedBy(Builder $q, User $user): Builder
    {
        return $q->where('user_id', $user->id);
    }
}
```

The model carries relations, casts and one scope. Deriving columns is an action, so it
is a service:

`backend/app/Services/Notes/DeriveNoteFields.php`:

```php
<?php
namespace App\Services\Notes;

use App\Models\Note;
use App\Support\PlainTextExtractor;
use Illuminate\Support\Str;

class DeriveNoteFields
{
    /**
     * Recompute every derived column from the body. Called on every write that
     * touches `body`. The client never supplies these values, or search would
     * drift from content.
     */
    public function __invoke(Note $note): void
    {
        $text = PlainTextExtractor::extract($note->body);

        $note->plain_text = $text;
        $note->excerpt = Str::limit($text, 140, '');
        $note->word_count = $text === '' ? 0 : count(preg_split('/\s+/u', $text));

        if (! $note->title_locked) {
            $note->title = PlainTextExtractor::title($note->body);
        }
    }
}
```

`backend/app/Policies/NotePolicy.php`:

```php
<?php
namespace App\Policies;

use App\Models\Note;
use App\Models\User;

class NotePolicy
{
    public function view(User $user, Note $note): bool { return $note->user_id === $user->id; }
    public function update(User $user, Note $note): bool { return $note->user_id === $user->id; }
    public function delete(User $user, Note $note): bool { return $note->user_id === $user->id; }
}
```

`backend/database/factories/NoteFactory.php`:

```php
<?php
namespace Database\Factories;

use App\Models\Note;
use Illuminate\Database\Eloquent\Factories\Factory;

class NoteFactory extends Factory
{
    public function definition(): array
    {
        static $n = 0;
        $n++;

        return [
            'title' => "Note {$n}",
            'body' => ['type' => 'doc', 'content' => [
                ['type' => 'paragraph', 'content' => [
                    ['type' => 'text', 'text' => "Body of note {$n}"],
                ]],
            ]],
            'plain_text' => "Note {$n} Body of note {$n}",
            'excerpt' => "Body of note {$n}",
            'version' => 1,
        ];
    }

    public function empty(): static
    {
        return $this->state(fn () => [
            'title' => '', 'body' => ['type' => 'doc', 'content' => []],
            'plain_text' => '', 'excerpt' => '',
        ]);
    }
}
```

- [ ] **Step 7: Add the `notes` relation to User**

```php
public function notes(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(Note::class);
}
```

- [ ] **Step 8: Migrate and run the whole suite**

```bash
php artisan migrate:fresh && php artisan test
```
Expected: PASS, all tasks so far.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(backend): notes schema, model and ProseMirror text extraction"
```

---

### Task B7: Notes index, show and store

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/NoteController.php`,
  `backend/app/Http/Resources/NoteResource.php`,
  `backend/app/Http/Resources/NoteListResource.php`,
  `backend/app/Queries/NotesQuery.php`,
  `backend/app/Services/Notes/CreateNote.php`,
  `backend/app/Http/Requests/IndexNotesRequest.php`,
  `backend/app/Http/Requests/StoreNoteRequest.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/NoteIndexTest.php`

**Interfaces:**
- Produces:
  - `GET /notes?folder_id=&tag=&starred=&trashed=&sort=&cursor=` — **cursor paginated**.
  - `POST /notes` → 201 with the full note.
  - `GET /notes/{uuid}` → full note.
  - `NoteListResource` (list rows, **no body**): `{uuid, title, excerpt, is_starred,
    folder: {uuid,name}|null, tags: [slug], updated_at}`.
  - `NoteResource` (single note, **with body**): list fields plus `{body, version,
    word_count, deleted_at}`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/NoteIndexTest.php`:

```php
<?php
use App\Models\Folder;
use App\Models\Note;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('lists only the signed-in user\'s notes', function () {
    Note::factory()->count(3)->for($this->user)->create();
    Note::factory()->count(2)->for(User::factory())->create();

    $this->getJson('/api/v1/notes')->assertOk()->assertJsonCount(3, 'data');
});

it('omits the body from list rows', function () {
    Note::factory()->for($this->user)->create();

    $this->getJson('/api/v1/notes')
        ->assertOk()
        ->assertJsonMissingPath('data.0.body');
});

it('filters by folder', function () {
    $folder = Folder::factory()->for($this->user)->create();
    Note::factory()->for($this->user)->create(['folder_id' => $folder->id]);
    Note::factory()->for($this->user)->create();

    $this->getJson("/api/v1/notes?folder_id={$folder->uuid}")
        ->assertOk()->assertJsonCount(1, 'data');
});

it('filters by starred', function () {
    Note::factory()->for($this->user)->create(['is_starred' => true]);
    Note::factory()->for($this->user)->create(['is_starred' => false]);

    $this->getJson('/api/v1/notes?starred=1')->assertOk()->assertJsonCount(1, 'data');
});

it('excludes trashed notes by default and includes them on request', function () {
    $trashed = Note::factory()->for($this->user)->create();
    $trashed->delete();
    Note::factory()->for($this->user)->create();

    $this->getJson('/api/v1/notes')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/notes?trashed=1')->assertJsonCount(1, 'data');
});

it('creates an empty note', function () {
    $this->postJson('/api/v1/notes')
        ->assertCreated()
        ->assertJsonPath('data.title', '')
        ->assertJsonPath('data.version', 1);
});

it('refuses to show another user\'s note', function () {
    $other = Note::factory()->for(User::factory())->create();

    $this->getJson("/api/v1/notes/{$other->uuid}")->assertForbidden();
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
php artisan test --filter=NoteIndexTest
```
Expected: FAIL — 404.

- [ ] **Step 3: Write the resources**

`backend/app/Http/Resources/NoteListResource.php`:

```php
<?php
namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NoteListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'title' => $this->title,
            'excerpt' => $this->excerpt,
            'is_starred' => $this->is_starred,
            'folder' => $this->whenLoaded('folder', fn () => $this->folder ? [
                'uuid' => $this->folder->uuid,
                'name' => $this->folder->name,
            ] : null),
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->pluck('slug')),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
```

`backend/app/Http/Resources/NoteResource.php`:

```php
<?php
namespace App\Http\Resources;

use Illuminate\Http\Request;

class NoteResource extends NoteListResource
{
    public function toArray(Request $request): array
    {
        return parent::toArray($request) + [
            'body' => $this->body,
            'version' => $this->version,
            'word_count' => $this->word_count,
            'title_locked' => $this->title_locked,
        ];
    }
}
```

- [ ] **Step 4: Write the requests, the query class and the create service**

`backend/app/Http/Requests/IndexNotesRequest.php`:

```php
<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class IndexNotesRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'folder_id' => ['nullable', 'uuid'],
            'tag' => ['nullable', 'string', 'max:60'],
            'starred' => ['nullable', 'boolean'],
            'trashed' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:updated,created,title'],
            'cursor' => ['nullable', 'string'],
        ];
    }

    /** The filter set, already coerced, so the query class takes no Request. */
    public function filters(): array
    {
        return [
            'folder_uuid' => $this->input('folder_id'),
            'tag' => $this->input('tag'),
            'starred' => $this->boolean('starred'),
            'trashed' => $this->boolean('trashed'),
            'sort' => $this->input('sort', 'updated'),
        ];
    }
}
```

`backend/app/Http/Requests/StoreNoteRequest.php` validates
`['folder_id' => ['nullable', 'uuid']]` and returns `true` from `authorize()`.

`backend/app/Queries/NotesQuery.php`:

```php
<?php
namespace App\Queries;

use App\Models\Note;
use App\Models\User;
use Illuminate\Contracts\Pagination\CursorPaginator;

class NotesQuery
{
    public function __construct(private readonly FolderQuery $folders) {}

    public function paginate(User $user, array $filters, int $perPage = 50): CursorPaginator
    {
        $query = Note::ownedBy($user)->with(['folder', 'tags']);

        if ($filters['trashed'] ?? false) {
            $query->onlyTrashed();
        }

        if ($filters['folder_uuid'] ?? null) {
            $query->where('folder_id', $this->folders->idForUuid($user, $filters['folder_uuid']));
        }

        if ($filters['tag'] ?? null) {
            $query->whereHas('tags', fn ($q) => $q->where('slug', $filters['tag']));
        }

        if ($filters['starred'] ?? false) {
            $query->where('is_starred', true);
        }

        // Cursor pagination: updated_at changes constantly, so offset pagination
        // would duplicate and skip rows while the user types.
        $query = match ($filters['sort'] ?? 'updated') {
            'created' => $query->orderByDesc('created_at')->orderByDesc('id'),
            'title' => $query->orderBy('title')->orderBy('id'),
            default => $query->orderByDesc('updated_at')->orderByDesc('id'),
        };

        return $query->cursorPaginate($perPage);
    }
}
```

`backend/app/Services/Notes/CreateNote.php`:

```php
<?php
namespace App\Services\Notes;

use App\Models\Note;
use App\Models\User;
use App\Queries\FolderQuery;

class CreateNote
{
    public function __construct(
        private readonly FolderQuery $folders,
        private readonly DeriveNoteFields $derive,
    ) {}

    public function __invoke(User $user, ?string $folderUuid = null): Note
    {
        $note = new Note([
            'folder_id' => $this->folders->idForUuid($user, $folderUuid),
            // JSON columns take no DEFAULT, so the empty document is written here.
            'body' => ['type' => 'doc', 'content' => []],
        ]);

        $note->user_id = $user->id;
        ($this->derive)($note);
        $note->save();

        return $note->load(['folder', 'tags']);
    }
}
```

- [ ] **Step 5: Write the controller — delegation only**

`backend/app/Http/Controllers/Api/V1/NoteController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\IndexNotesRequest;
use App\Http\Requests\StoreNoteRequest;
use App\Http\Resources\NoteListResource;
use App\Http\Resources\NoteResource;
use App\Models\Note;
use App\Queries\NotesQuery;
use App\Services\Notes\CreateNote;

class NoteController extends Controller
{
    public function index(IndexNotesRequest $request, NotesQuery $notes)
    {
        return NoteListResource::collection(
            $notes->paginate($request->user(), $request->filters()),
        );
    }

    public function store(StoreNoteRequest $request, CreateNote $createNote)
    {
        $note = $createNote($request->user(), $request->validated('folder_id'));

        return (new NoteResource($note))->response()->setStatusCode(201);
    }

    public function show(Note $note)
    {
        $this->authorize('view', $note);

        return new NoteResource($note->load(['folder', 'tags']));
    }
}
```

- [ ] **Step 6: Register the routes**

Inside the `auth:sanctum` group:

```php
Route::get('/notes', [NoteController::class, 'index']);
Route::post('/notes', [NoteController::class, 'store']);
Route::get('/notes/{note}', [NoteController::class, 'show']);
```

Also add this binding so trashed notes resolve, in `routes/api.php` above the groups:

```php
Route::bind('note', fn ($value) => Note::withTrashed()->where('uuid', $value)->firstOrFail());
```

- [ ] **Step 7: Run the tests**

```bash
php artisan test --filter=NoteIndexTest
```
Expected: PASS (7 tests).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(backend): note index with filters and cursor pagination, show and store"
```

---

### Task B8: Note update, version conflict and size limits

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/NoteController.php`,
  `backend/routes/api.php`
- Create: `backend/app/Http/Requests/UpdateNoteRequest.php`
- Test: `backend/tests/Feature/NoteUpdateTest.php`

**Interfaces:**
- Produces: `PATCH /notes/{uuid}`.
  - When the payload contains `body`, `version` is **required** and checked. A mismatch
    returns **409** with `{message, server_copy: NoteResource}`. A success increments
    `version` and returns the note.
  - When the payload contains **only** metadata (`title`, `folder_id`, `is_starred`),
    **no version check happens at all** — starring during an in-flight autosave must
    never 409.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/NoteUpdateTest.php`:

```php
<?php
use App\Models\Note;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
    $this->note = Note::factory()->for($this->user)->create(['version' => 3]);
});

function doc(string $text): array
{
    return ['type' => 'doc', 'content' => [
        ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]],
    ]];
}

it('saves the body and bumps the version', function () {
    $this->patchJson("/api/v1/notes/{$this->note->uuid}", [
        'body' => doc('Hello world'), 'version' => 3,
    ])->assertOk()->assertJsonPath('data.version', 4);

    expect($this->note->fresh()->plain_text)->toBe('Hello world');
});

it('derives title, excerpt and word count from the body', function () {
    $this->patchJson("/api/v1/notes/{$this->note->uuid}", [
        'body' => ['type' => 'doc', 'content' => [
            ['type' => 'heading', 'attrs' => ['level' => 1],
             'content' => [['type' => 'text', 'text' => 'My title']]],
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'two words']]],
        ]],
        'version' => 3,
    ])->assertOk();

    $fresh = $this->note->fresh();
    expect($fresh->title)->toBe('My title')
        ->and($fresh->word_count)->toBe(4);
});

it('returns 409 with the server copy on a stale version', function () {
    $this->patchJson("/api/v1/notes/{$this->note->uuid}", [
        'body' => doc('Stale write'), 'version' => 2,
    ])
        ->assertStatus(409)
        ->assertJsonPath('server_copy.data.version', 3);

    expect($this->note->fresh()->plain_text)->not->toBe('Stale write');
});

// REVIEW FOCUS 1 — the bug this guards against is subtle and maddening in production.
it('stars a note without a version and never conflicts', function () {
    $this->patchJson("/api/v1/notes/{$this->note->uuid}", ['is_starred' => true])
        ->assertOk()->assertJsonPath('data.is_starred', true);

    expect($this->note->fresh()->version)->toBe(3);  // unchanged
});

it('renames a note and locks the title against auto-derivation', function () {
    $this->patchJson("/api/v1/notes/{$this->note->uuid}", ['title' => 'Manual name'])
        ->assertOk()->assertJsonPath('data.title_locked', true);

    $this->patchJson("/api/v1/notes/{$this->note->uuid}", [
        'body' => doc('Something else entirely'), 'version' => 3,
    ])->assertOk();

    expect($this->note->fresh()->title)->toBe('Manual name');
});

it('requires a version when a body is sent', function () {
    $this->patchJson("/api/v1/notes/{$this->note->uuid}", ['body' => doc('x')])
        ->assertStatus(422);
});

// REVIEW FOCUS 2 — must be a clean 422, never a 500 or a truncated document.
it('rejects an over-large body with 422', function () {
    $huge = ['type' => 'doc', 'content' => array_fill(0, 1, [
        'type' => 'paragraph',
        'content' => [['type' => 'text', 'text' => str_repeat('a', 2_100_000)]],
    ])];

    $this->patchJson("/api/v1/notes/{$this->note->uuid}", ['body' => $huge, 'version' => 3])
        ->assertStatus(422);
});

it('rejects a body nested beyond a sane depth with 422', function () {
    $node = ['type' => 'text', 'text' => 'deep'];
    for ($i = 0; $i < 120; $i++) {
        $node = ['type' => 'blockquote', 'content' => [$node]];
    }

    $this->patchJson("/api/v1/notes/{$this->note->uuid}", [
        'body' => ['type' => 'doc', 'content' => [$node]], 'version' => 3,
    ])->assertStatus(422);
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
php artisan test --filter=NoteUpdateTest
```
Expected: FAIL — route not defined.

- [ ] **Step 3: Write the request**

`backend/app/Http/Requests/UpdateNoteRequest.php`:

```php
<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateNoteRequest extends FormRequest
{
    /** Bodies larger than this are rejected before they reach MySQL. */
    public const MAX_BODY_BYTES = 2_000_000;
    public const MAX_DEPTH = 100;

    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'body' => ['sometimes', 'array'],
            // Required only alongside a body: metadata writes must never conflict.
            'version' => ['required_with:body', 'integer', 'min:1'],
            'title' => ['sometimes', 'string', 'max:255'],
            'folder_id' => ['sometimes', 'nullable', 'uuid'],
            'is_starred' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->has('body')) {
                    return;
                }

                $encoded = json_encode($this->input('body'));

                if ($encoded === false || strlen($encoded) > self::MAX_BODY_BYTES) {
                    $validator->errors()->add('body', __('This note is too large to save.'));

                    return;
                }

                if (self::depth($this->input('body')) > self::MAX_DEPTH) {
                    $validator->errors()->add('body', __('This note is nested too deeply.'));
                }
            },
        ];
    }

    private static function depth(mixed $node, int $level = 0): int
    {
        if ($level > self::MAX_DEPTH || ! is_array($node)) {
            return $level;
        }

        $max = $level;
        foreach ($node['content'] ?? [] as $child) {
            $max = max($max, self::depth($child, $level + 1));
            if ($max > self::MAX_DEPTH) {
                return $max;
            }
        }

        return $max;
    }

    /** True when this request actually changes the document. */
    public function touchesBody(): bool
    {
        return $this->has('body');
    }
}
```

- [ ] **Step 4: Write the update service**

`backend/app/Services/Notes/UpdateNote.php`:

```php
<?php
namespace App\Services\Notes;

use App\Exceptions\NoteConflictException;
use App\Models\Note;
use App\Models\User;
use App\Queries\FolderQuery;

class UpdateNote
{
    public function __construct(
        private readonly FolderQuery $folders,
        private readonly DeriveNoteFields $derive,
    ) {}

    /**
     * @param  array  $changes  Any of body+version, title, folder_id, is_starred.
     *
     * @throws NoteConflictException when a body write carries a stale version.
     */
    public function __invoke(User $user, Note $note, array $changes): Note
    {
        if (array_key_exists('body', $changes)) {
            // Optimistic concurrency applies to document writes ONLY. Metadata
            // changes must never conflict with an in-flight autosave.
            if ((int) $changes['version'] !== (int) $note->version) {
                throw new NoteConflictException($note);
            }

            $note->body = $changes['body'];
            ($this->derive)($note);
            $note->version = $note->version + 1;
        }

        if (array_key_exists('title', $changes)) {
            $note->title = $changes['title'];
            $note->title_locked = true;   // an explicit rename wins forever
        }

        if (array_key_exists('folder_id', $changes)) {
            $note->folder_id = $this->folders->idForUuid($user, $changes['folder_id']);
        }

        if (array_key_exists('is_starred', $changes)) {
            $note->is_starred = (bool) $changes['is_starred'];
        }

        $note->save();

        return $note->fresh()->load(['folder', 'tags']);
    }
}
```

- [ ] **Step 5: Add `update` to the controller — no branching**

```php
use App\Http\Requests\UpdateNoteRequest;
use App\Services\Notes\UpdateNote;

public function update(UpdateNoteRequest $request, Note $note, UpdateNote $updateNote)
{
    $this->authorize('update', $note);

    // A stale version throws NoteConflictException, which renders itself as the
    // 409 contract. That is why there is no `if` here.
    return new NoteResource($updateNote($request->user(), $note, $request->validated()));
}
```

- [ ] **Step 6: Register the route**

```php
Route::patch('/notes/{note}', [NoteController::class, 'update'])->middleware('throttle:240,1');
```

- [ ] **Step 7: Run the tests**

```bash
php artisan test --filter=NoteUpdateTest
php artisan test --filter=ArchitectureTest
```
Expected: PASS (8 tests), including Review Focus items 1 and 2, guard green.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(backend): note update with body-only version conflict and size limits"
```

---

### Task B9: Tag assignment by name

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/NoteController.php`, `backend/routes/api.php`
- Test: `backend/tests/Feature/NoteTagTest.php`

**Interfaces:**
- Consumes: `Services\Tags\UpsertTags` from B5.
- Produces: `PUT /notes/{uuid}/tags` taking `{names: string[]}`, replacing the whole set
  and returning the updated note. Names, not ids, so the picker's type-and-create is one
  request.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/NoteTagTest.php`:

```php
<?php
use App\Models\Note;
use App\Models\Tag;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
    $this->note = Note::factory()->for($this->user)->create();
});

it('attaches tags by name, creating the missing ones', function () {
    $this->putJson("/api/v1/notes/{$this->note->uuid}/tags", ['names' => ['todo', 'release']])
        ->assertOk()
        ->assertJsonPath('data.tags', ['todo', 'release']);

    expect(Tag::where('user_id', $this->user->id)->count())->toBe(2);
});

it('replaces the whole set rather than appending', function () {
    $this->putJson("/api/v1/notes/{$this->note->uuid}/tags", ['names' => ['a', 'b']]);
    $this->putJson("/api/v1/notes/{$this->note->uuid}/tags", ['names' => ['b']])
        ->assertOk()->assertJsonPath('data.tags', ['b']);
});

it('is idempotent and de-duplicates by slug', function () {
    $this->putJson("/api/v1/notes/{$this->note->uuid}/tags", ['names' => ['To Do', 'to-do']])
        ->assertOk();

    expect($this->note->fresh()->tags)->toHaveCount(1);
});

it('clears all tags with an empty array', function () {
    $this->putJson("/api/v1/notes/{$this->note->uuid}/tags", ['names' => ['x']]);
    $this->putJson("/api/v1/notes/{$this->note->uuid}/tags", ['names' => []])
        ->assertOk()->assertJsonPath('data.tags', []);
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
php artisan test --filter=NoteTagTest
```
Expected: FAIL — 404.

- [ ] **Step 3: Write the request and the service**

`backend/app/Http/Requests/SyncNoteTagsRequest.php` validates
`['names' => ['present','array','max:50'], 'names.*' => ['string','max:60']]`.

`backend/app/Services/Notes/SyncNoteTags.php`:

```php
<?php
namespace App\Services\Notes;

use App\Models\Note;
use App\Models\User;
use App\Services\Tags\UpsertTags;

class SyncNoteTags
{
    public function __construct(private readonly UpsertTags $upsertTags) {}

    /** Replaces the whole set, creating any tag names that do not exist yet. */
    public function __invoke(User $user, Note $note, array $names): Note
    {
        $tags = ($this->upsertTags)($user, $names);
        $note->tags()->sync($tags->pluck('id'));

        return $note->fresh()->load(['folder', 'tags']);
    }
}
```

- [ ] **Step 4: Add the controller method**

```php
use App\Http\Requests\SyncNoteTagsRequest;
use App\Services\Notes\SyncNoteTags;

public function syncTags(SyncNoteTagsRequest $request, Note $note, SyncNoteTags $syncTags)
{
    $this->authorize('update', $note);

    return new NoteResource($syncTags($request->user(), $note, $request->validated('names')));
}
```

- [ ] **Step 5: Register the route**

```php
Route::put('/notes/{note}/tags', [NoteController::class, 'syncTags']);
```

- [ ] **Step 6: Run the tests**

```bash
php artisan test --filter=NoteTagTest
php artisan test --filter=ArchitectureTest
```
Expected: PASS (4 tests), guard green.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(backend): assign note tags by name in a single request"
```

---

### Task B10: Trash, restore, hard delete and duplicate

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/NoteController.php`, `backend/routes/api.php`
- Test: `backend/tests/Feature/TrashTest.php`

**Interfaces:**
- Produces: `DELETE /notes/{uuid}` (soft), `POST /notes/{uuid}/restore` (optional
  `folder_id`), `DELETE /notes/{uuid}?force=1` (hard), `DELETE /trash`,
  `POST /notes/{uuid}/duplicate`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/TrashTest.php`:

```php
<?php
use App\Models\Folder;
use App\Models\Note;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('soft deletes a note', function () {
    $note = Note::factory()->for($this->user)->create();

    $this->deleteJson("/api/v1/notes/{$note->uuid}")->assertNoContent();

    expect($note->fresh()->trashed())->toBeTrue();
});

it('restores a note', function () {
    $note = Note::factory()->for($this->user)->create();
    $note->delete();

    $this->postJson("/api/v1/notes/{$note->uuid}/restore")->assertOk();

    expect($note->fresh()->trashed())->toBeFalse();
});

it('restores into a chosen folder', function () {
    $folder = Folder::factory()->for($this->user)->create();
    $note = Note::factory()->for($this->user)->create();
    $note->delete();

    $this->postJson("/api/v1/notes/{$note->uuid}/restore", ['folder_id' => $folder->uuid])
        ->assertOk();

    expect($note->fresh()->folder_id)->toBe($folder->id);
});

it('hard deletes with force', function () {
    $note = Note::factory()->for($this->user)->create();

    $this->deleteJson("/api/v1/notes/{$note->uuid}?force=1")->assertNoContent();

    expect(Note::withTrashed()->find($note->id))->toBeNull();
});

it('empties the trash without touching live notes', function () {
    $live = Note::factory()->for($this->user)->create();
    $gone = Note::factory()->for($this->user)->create();
    $gone->delete();

    $this->deleteJson('/api/v1/trash')->assertNoContent();

    expect(Note::withTrashed()->find($gone->id))->toBeNull()
        ->and(Note::find($live->id))->not->toBeNull();
});

it('duplicates a note with a fresh version and an untrashed state', function () {
    $note = Note::factory()->for($this->user)->create(['version' => 9]);

    $this->postJson("/api/v1/notes/{$note->uuid}/duplicate")
        ->assertCreated()
        ->assertJsonPath('data.version', 1);

    expect(Note::where('user_id', $this->user->id)->count())->toBe(2);
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
php artisan test --filter=TrashTest
```
Expected: FAIL — 404.

- [ ] **Step 3: Write the services**

`backend/app/Services/Notes/DeleteNote.php`:

```php
<?php
namespace App\Services\Notes;

use App\Models\Note;

class DeleteNote
{
    /**
     * `$force` serves two very different UX paths: "Delete permanently" from the
     * Trash view, and the silent discard of an abandoned empty note. The server
     * behaviour is identical; only the client differs (no toast, no confirm).
     */
    public function __invoke(Note $note, bool $force = false): void
    {
        $force ? $note->forceDelete() : $note->delete();
    }
}
```

`backend/app/Services/Notes/RestoreNote.php`:

```php
<?php
namespace App\Services\Notes;

use App\Models\Note;
use App\Models\User;
use App\Queries\FolderQuery;

class RestoreNote
{
    public function __construct(private readonly FolderQuery $folders) {}

    public function __invoke(User $user, Note $note, ?string $folderUuid = null): Note
    {
        if ($folderUuid) {
            $note->folder_id = $this->folders->idForUuid($user, $folderUuid);
        }

        $note->restore();

        return $note->fresh()->load(['folder', 'tags']);
    }
}
```

`backend/app/Services/Notes/EmptyTrash.php`:

```php
<?php
namespace App\Services\Notes;

use App\Models\Note;
use App\Models\User;

class EmptyTrash
{
    public function __invoke(User $user): void
    {
        Note::ownedBy($user)->onlyTrashed()->forceDelete();
    }
}
```

`backend/app/Services/Notes/DuplicateNote.php`:

```php
<?php
namespace App\Services\Notes;

use App\Models\Note;
use Illuminate\Support\Facades\DB;

class DuplicateNote
{
    public function __invoke(Note $note): Note
    {
        return DB::transaction(function () use ($note) {
            $copy = $note->replicate(['uuid', 'version', 'deleted_at', 'created_at', 'updated_at']);
            $copy->version = 1;
            $copy->title = $note->title === '' ? '' : $note->title.' (copy)';
            // A copy keeps its name: it must not be renamed by body derivation.
            $copy->title_locked = $note->title !== '';
            $copy->save();
            $copy->tags()->sync($note->tags->pluck('id'));

            return $copy->fresh()->load(['folder', 'tags']);
        });
    }
}
```

- [ ] **Step 4: Add the controller methods**

`backend/app/Http/Requests/DestroyNoteRequest.php` validates
`['force' => ['nullable','boolean']]`; `RestoreNoteRequest` validates
`['folder_id' => ['nullable','uuid']]`.

```php
use App\Http\Requests\DestroyNoteRequest;
use App\Http\Requests\RestoreNoteRequest;
use App\Services\Notes\DeleteNote;
use App\Services\Notes\DuplicateNote;
use App\Services\Notes\EmptyTrash;
use App\Services\Notes\RestoreNote;

public function destroy(DestroyNoteRequest $request, Note $note, DeleteNote $deleteNote)
{
    $this->authorize('delete', $note);

    $deleteNote($note, $request->boolean('force'));

    return response()->noContent();
}

public function restore(RestoreNoteRequest $request, Note $note, RestoreNote $restoreNote)
{
    $this->authorize('delete', $note);

    return new NoteResource(
        $restoreNote($request->user(), $note, $request->validated('folder_id')),
    );
}

public function emptyTrash(Request $request, EmptyTrash $emptyTrash)
{
    $emptyTrash($request->user());

    return response()->noContent();
}

public function duplicate(Note $note, DuplicateNote $duplicateNote)
{
    $this->authorize('view', $note);

    return (new NoteResource($duplicateNote($note)))->response()->setStatusCode(201);
}
```

- [ ] **Step 5: Register the routes**

```php
Route::delete('/notes/{note}', [NoteController::class, 'destroy']);
Route::post('/notes/{note}/restore', [NoteController::class, 'restore']);
Route::post('/notes/{note}/duplicate', [NoteController::class, 'duplicate']);
Route::delete('/trash', [NoteController::class, 'emptyTrash']);
```

- [ ] **Step 6: Run the tests**

```bash
php artisan test --filter=TrashTest
php artisan test --filter=ArchitectureTest
```
Expected: PASS (6 tests), guard green.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(backend): trash, restore, hard delete, empty trash and duplicate"
```

---

### Task B11: Search

**Files:**
- Create: `backend/app/Support/SearchTerms.php`,
  `backend/app/Support/SnippetBuilder.php`,
  `backend/app/Services/Search/SearchNotes.php`,
  `backend/app/Http/Controllers/Api/V1/SearchController.php`,
  `backend/app/Http/Requests/SearchRequest.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/SearchTest.php`, `backend/tests/Unit/SnippetBuilderTest.php`

**Interfaces:**
- Produces: `GET /search?q=` returning
  `{notes: [{uuid, title, snippet, terms}], folders: [...], tags: [...]}`.
  **`snippet` is plain text and `terms` is the matched words — the server never emits
  HTML.** The client applies the `<mark>`.
- `App\Support\SearchTerms::parse(string $q): array` and `::MIN_TOKEN = 3`.
- `App\Support\SnippetBuilder::build(string $text, array $terms, int $radius = 90): string`.
- `App\Services\Search\SearchNotes::__invoke(User $user, string $q): array` — the
  whole grouped payload, so the controller only serialises it.
  `SearchTerms` and `SnippetBuilder` are stateless helpers, which is why they live in
  `Support` and are exempt from the one-action rule.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Unit/SnippetBuilderTest.php`:

```php
<?php
use App\Support\SnippetBuilder;

it('centres the snippet on the first match', function () {
    $text = str_repeat('padding ', 30).'needle '.str_repeat('tail ', 30);

    expect(SnippetBuilder::build($text, ['needle'], 20))
        ->toContain('needle')
        ->and(mb_strlen(SnippetBuilder::build($text, ['needle'], 20)))->toBeLessThan(80);
});

it('falls back to the head of the text when nothing matches', function () {
    expect(SnippetBuilder::build('alpha beta gamma', ['zzz'], 20))->toStartWith('alpha');
});

it('returns HTML-free output', function () {
    expect(SnippetBuilder::build('<script>x</script> needle', ['needle'], 20))
        ->not->toContain('<script>');
});
```

`backend/tests/Feature/SearchTest.php`:

```php
<?php
use App\Models\Note;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('finds a note by a word that appears only in its body', function () {
    $note = Note::factory()->for($this->user)->create([
        'title' => 'Untitled',
        'plain_text' => 'the quarterly forecast spreadsheet lives in finance',
    ]);

    $this->getJson('/api/v1/search?q=quarterly')
        ->assertOk()
        ->assertJsonPath('notes.0.uuid', $note->uuid)
        ->assertJsonFragment(['terms' => ['quarterly']]);
});

it('matches a prefix, so search-as-you-type works', function () {
    Note::factory()->for($this->user)->create(['plain_text' => 'release plan for r34']);

    $this->getJson('/api/v1/search?q=relea')->assertOk()->assertJsonCount(1, 'notes');
});

// REVIEW FOCUS 5 — an empty list here would read as "you have no notes".
it('rejects a term shorter than the MySQL minimum token size', function () {
    $this->getJson('/api/v1/search?q=qa')->assertStatus(422);
});

it('never returns another user\'s notes', function () {
    Note::factory()->for(User::factory())->create(['plain_text' => 'secret quarterly numbers']);

    $this->getJson('/api/v1/search?q=quarterly')->assertOk()->assertJsonCount(0, 'notes');
});

it('excludes trashed notes', function () {
    $note = Note::factory()->for($this->user)->create(['plain_text' => 'quarterly report']);
    $note->delete();

    $this->getJson('/api/v1/search?q=quarterly')->assertOk()->assertJsonCount(0, 'notes');
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
php artisan test --filter=SearchTest
php artisan test --filter=SnippetBuilderTest
```
Expected: FAIL — classes and route missing.

- [ ] **Step 3: Write the snippet builder**

`backend/app/Support/SnippetBuilder.php`:

```php
<?php
namespace App\Support;

class SnippetBuilder
{
    /**
     * Plain-text snippet centred on the first matching term. Emits no HTML:
     * the client is responsible for highlighting, so nothing we return can
     * become markup.
     */
    public static function build(string $text, array $terms, int $radius = 90): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', strip_tags($text)));

        if ($text === '') {
            return '';
        }

        $at = null;
        foreach ($terms as $term) {
            $pos = mb_stripos($text, $term);
            if ($pos !== false) {
                $at = $pos;
                break;
            }
        }

        if ($at === null) {
            return mb_substr($text, 0, $radius * 2).(mb_strlen($text) > $radius * 2 ? '…' : '');
        }

        $start = max(0, $at - $radius);
        $slice = mb_substr($text, $start, $radius * 2);

        return ($start > 0 ? '…' : '').$slice.($start + $radius * 2 < mb_strlen($text) ? '…' : '');
    }
}
```

- [ ] **Step 4: Write the term parser and the search service**

`backend/app/Support/SearchTerms.php`:

```php
<?php
namespace App\Support;

class SearchTerms
{
    /** MySQL's innodb_ft_min_token_size. Shorter terms can never match. */
    public const MIN_TOKEN = 3;

    /** @return string[] */
    public static function parse(string $q): array
    {
        return collect(preg_split('/\s+/u', trim($q)))
            ->filter(fn ($t) => mb_strlen($t) >= self::MIN_TOKEN)
            ->values()
            ->all();
    }

    /** Boolean-mode expression with a trailing wildcard per term. */
    public static function expression(array $terms): string
    {
        return collect($terms)
            ->map(fn ($t) => '+'.addcslashes($t, '+-><()~*:"@').'*')
            ->implode(' ');
    }
}
```

`backend/app/Services/Search/SearchNotes.php`:

```php
<?php
namespace App\Services\Search;

use App\Models\Note;
use App\Models\User;
use App\Support\SearchTerms;
use App\Support\SnippetBuilder;

class SearchNotes
{
    /**
     * Returns the whole grouped payload. The snippet is PLAIN TEXT and the
     * matched terms are returned beside it — the client applies the <mark>, so
     * nothing the server emits can become markup.
     */
    public function __invoke(User $user, string $q, int $limit = 20): array
    {
        $terms = SearchTerms::parse($q);

        $notes = $terms === [] ? collect() : Note::ownedBy($user)
            ->whereNull('deleted_at')
            // Boolean mode with a trailing wildcard gives search-as-you-type and
            // partly compensates for MySQL having no stemming.
            ->whereRaw(
                'MATCH(title, plain_text) AGAINST (? IN BOOLEAN MODE)',
                [SearchTerms::expression($terms)],
            )
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get()
            ->map(fn (Note $note) => [
                'uuid' => $note->uuid,
                'title' => $note->title,
                'snippet' => SnippetBuilder::build((string) $note->plain_text, $terms),
                'terms' => $terms,
            ]);

        return [
            'notes' => $notes->values(),
            'folders' => $user->folders()->where('name', 'like', $q.'%')->limit(5)->get()
                ->map(fn ($f) => ['uuid' => $f->uuid, 'name' => $f->name])->values(),
            'tags' => $user->tags()->where('name', 'like', $q.'%')->limit(5)->get()
                ->map(fn ($t) => ['uuid' => $t->uuid, 'name' => $t->name, 'slug' => $t->slug])->values(),
        ];
    }
}
```

- [ ] **Step 5: Write the request and controller**

`backend/app/Http/Requests/SearchRequest.php`:

```php
<?php
namespace App\Http\Requests;

use App\Support\SearchTerms;
use Illuminate\Foundation\Http\FormRequest;

class SearchRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            // Below the MySQL token size the query cannot match anything, so
            // reject it rather than return an empty list that reads as "no notes".
            'q' => ['required', 'string', 'min:'.SearchTerms::MIN_TOKEN, 'max:120'],
        ];
    }
}
```

`backend/app/Http/Controllers/Api/V1/SearchController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SearchRequest;
use App\Services\Search\SearchNotes;

class SearchController extends Controller
{
    public function __invoke(SearchRequest $request, SearchNotes $searchNotes)
    {
        return $searchNotes($request->user(), $request->validated('q'));
    }
}
```

- [ ] **Step 6: Register the route**

```php
Route::get('/search', SearchController::class)->middleware('throttle:60,1');
```

- [ ] **Step 7: Run the tests**

```bash
php artisan test --filter=SearchTest
php artisan test --filter=SnippetBuilderTest
```
Expected: PASS (5 + 3 tests), including Review Focus item 5.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(backend): MySQL FULLTEXT search with plain-text snippets"
```

---

### Task B12: Bootstrap endpoint

**Files:**
- Create: `backend/app/Services/Bootstrap/BuildBootstrapPayload.php`,
  `backend/app/Http/Controllers/Api/V1/BootstrapController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/BootstrapTest.php`

**Interfaces:**
- Produces: `GET /bootstrap` → `{user, folders[], tags[], counts: {all, starred,
  trashed, folders: {uuid: n}, tags: {slug: n}}, notes: <first page>}`.
  One request renders the app; without it the first paint needs six round-trips and
  nothing serves the sidebar counts.
- Counts are **two grouped queries**, never one query per folder.

- [ ] **Step 1: Write the failing test**

`backend/tests/Feature/BootstrapTest.php`:

```php
<?php
use App\Models\Folder;
use App\Models\Note;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('returns everything the app needs to render', function () {
    $folder = Folder::factory()->for($this->user)->create();
    Note::factory()->count(2)->for($this->user)->create(['folder_id' => $folder->id]);
    Note::factory()->for($this->user)->create(['is_starred' => true]);
    $trashed = Note::factory()->for($this->user)->create();
    $trashed->delete();

    $this->getJson('/api/v1/bootstrap')
        ->assertOk()
        ->assertJsonPath('user.email', $this->user->email)
        ->assertJsonPath('counts.all', 3)
        ->assertJsonPath('counts.starred', 1)
        ->assertJsonPath('counts.trashed', 1)
        ->assertJsonPath("counts.folders.{$folder->uuid}", 2)
        ->assertJsonCount(3, 'notes');
});

it('counts tags', function () {
    $tag = Tag::factory()->for($this->user)->create(['slug' => 'todo']);
    $note = Note::factory()->for($this->user)->create();
    $note->tags()->attach($tag);

    $this->getJson('/api/v1/bootstrap')->assertJsonPath('counts.tags.todo', 1);
});

it('computes counts without a query per folder', function () {
    Folder::factory()->count(8)->for($this->user)->create();

    DB::enableQueryLog();
    $this->getJson('/api/v1/bootstrap')->assertOk();

    // user, folders, tags, notes page, 2 count queries, plus eager loads.
    expect(count(DB::getQueryLog()))->toBeLessThan(12);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
php artisan test --filter=BootstrapTest
```
Expected: FAIL — 404.

- [ ] **Step 3: Write the service**

`backend/app/Services/Bootstrap/BuildBootstrapPayload.php`:

```php
<?php
namespace App\Services\Bootstrap;

use App\Http\Resources\FolderResource;
use App\Http\Resources\NoteListResource;
use App\Http\Resources\TagResource;
use App\Http\Resources\UserResource;
use App\Models\Note;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class BuildBootstrapPayload
{
    public function __invoke(User $user): array
    {
        $folders = $user->folders()->orderBy('position')->orderBy('name')->get();
        $tags = $user->tags()->orderBy('name')->get();

        // Two grouped queries, not one per folder.
        $byFolder = DB::table('notes')
            ->selectRaw('folder_id, COUNT(*) as aggregate')
            ->where('user_id', $user->id)->whereNull('deleted_at')
            ->groupBy('folder_id')->pluck('aggregate', 'folder_id');

        $byTag = DB::table('note_tag')
            ->join('notes', 'notes.id', '=', 'note_tag.note_id')
            ->selectRaw('note_tag.tag_id, COUNT(*) as aggregate')
            ->where('notes.user_id', $user->id)->whereNull('notes.deleted_at')
            ->groupBy('note_tag.tag_id')->pluck('aggregate', 'tag_id');

        $notes = Note::ownedBy($user)->with(['folder', 'tags'])
            ->orderByDesc('updated_at')->orderByDesc('id')
            ->limit(50)->get();

        return [
            'user' => new UserResource($user),
            'folders' => FolderResource::collection($folders),
            'tags' => TagResource::collection($tags),
            'counts' => [
                'all' => (int) $byFolder->sum(),
                'starred' => Note::ownedBy($user)->where('is_starred', true)->count(),
                'trashed' => Note::ownedBy($user)->onlyTrashed()->count(),
                'folders' => $folders->mapWithKeys(
                    fn ($f) => [$f->uuid => (int) ($byFolder[$f->id] ?? 0)]
                ),
                'tags' => $tags->mapWithKeys(
                    fn ($t) => [$t->slug => (int) ($byTag[$t->id] ?? 0)]
                ),
            ],
            'notes' => NoteListResource::collection($notes),
        ];
    }
}
```

- [ ] **Step 4: Write the controller — one line**

`backend/app/Http/Controllers/Api/V1/BootstrapController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Bootstrap\BuildBootstrapPayload;
use Illuminate\Http\Request;

class BootstrapController extends Controller
{
    public function __invoke(Request $request, BuildBootstrapPayload $buildPayload)
    {
        return $buildPayload($request->user());
    }
}
```

- [ ] **Step 5: Register the route and run the tests**

```php
Route::get('/bootstrap', BootstrapController::class);
```

```bash
php artisan test --filter=BootstrapTest
php artisan test --filter=ArchitectureTest
```
Expected: PASS (3 tests), guard green.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(backend): single bootstrap endpoint with grouped sidebar counts"
```

---

### Task B13: Scheduled cleanup

**Files:**
- Create: `backend/app/Console/Commands/PruneEmptyNotes.php`,
  `backend/app/Console/Commands/PurgeTrash.php`
- Modify: `backend/routes/console.php`
- Test: `backend/tests/Feature/CleanupTest.php`

**Interfaces:**
- Produces: `notes:prune-empty` (hard-deletes untouched empty notes older than 24 h) and
  `notes:purge-trash` (hard-deletes notes trashed more than 30 days ago), both scheduled
  daily.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/CleanupTest.php`:

```php
<?php
use App\Models\Note;
use App\Models\Tag;
use App\Models\User;

it('prunes empty notes older than a day', function () {
    $user = User::factory()->create();

    $old = Note::factory()->empty()->for($user)->create();
    $old->forceFill(['created_at' => now()->subDays(2), 'updated_at' => now()->subDays(2)])->save();

    $recent = Note::factory()->empty()->for($user)->create();
    $written = Note::factory()->for($user)->create();
    $written->forceFill(['created_at' => now()->subDays(2)])->save();

    $this->artisan('notes:prune-empty')->assertExitCode(0);

    expect(Note::withTrashed()->find($old->id))->toBeNull()
        ->and(Note::find($recent->id))->not->toBeNull()
        ->and(Note::find($written->id))->not->toBeNull();
});

it('keeps an empty note that has been tagged', function () {
    $user = User::factory()->create();
    $note = Note::factory()->empty()->for($user)->create();
    $note->forceFill(['created_at' => now()->subDays(2)])->save();
    $note->tags()->attach(Tag::factory()->for($user)->create());

    $this->artisan('notes:prune-empty');

    expect(Note::find($note->id))->not->toBeNull();
});

it('purges notes trashed more than 30 days ago', function () {
    $user = User::factory()->create();

    $old = Note::factory()->for($user)->create();
    $old->delete();
    $old->forceFill(['deleted_at' => now()->subDays(31)])->save();

    $fresh = Note::factory()->for($user)->create();
    $fresh->delete();

    $this->artisan('notes:purge-trash')->assertExitCode(0);

    expect(Note::withTrashed()->find($old->id))->toBeNull()
        ->and(Note::withTrashed()->find($fresh->id))->not->toBeNull();
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
php artisan test --filter=CleanupTest
```
Expected: FAIL — commands not found.

- [ ] **Step 3: Write the commands**

`backend/app/Console/Commands/PruneEmptyNotes.php`:

```php
<?php
namespace App\Console\Commands;

use App\Models\Note;
use Illuminate\Console\Command;

class PruneEmptyNotes extends Command
{
    protected $signature = 'notes:prune-empty';
    protected $description = 'Hard-delete untouched empty notes older than 24 hours';

    public function handle(): int
    {
        // The client discards abandoned empties on blur, but laptops get closed
        // and browsers crash, so the server sweeps too.
        $deleted = Note::withTrashed()
            ->where('created_at', '<', now()->subDay())
            ->where(fn ($q) => $q->whereNull('plain_text')->orWhere('plain_text', ''))
            ->whereNull('folder_id')
            ->where('is_starred', false)
            ->where('version', 1)
            ->whereDoesntHave('tags')
            ->forceDelete();

        $this->info("Pruned {$deleted} empty notes.");

        return self::SUCCESS;
    }
}
```

`backend/app/Console/Commands/PurgeTrash.php`:

```php
<?php
namespace App\Console\Commands;

use App\Models\Note;
use Illuminate\Console\Command;

class PurgeTrash extends Command
{
    protected $signature = 'notes:purge-trash';
    protected $description = 'Hard-delete notes trashed more than 30 days ago';

    public function handle(): int
    {
        $deleted = Note::onlyTrashed()
            ->where('deleted_at', '<', now()->subDays(30))
            ->forceDelete();

        $this->info("Purged {$deleted} notes from trash.");

        return self::SUCCESS;
    }
}
```

- [ ] **Step 4: Schedule them**

`backend/routes/console.php`:

```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('notes:prune-empty')->dailyAt('03:00');
Schedule::command('notes:purge-trash')->dailyAt('03:15');
```

- [ ] **Step 5: Run the tests and the whole suite**

```bash
php artisan test --filter=CleanupTest
php artisan test
```
Expected: PASS, everything green.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(backend): scheduled pruning of empty notes and trash purge"
```

---

### Task B14: Backend hardening and seeding

**Files:**
- Modify: `backend/routes/api.php`, `backend/database/seeders/DatabaseSeeder.php`
- Create: `backend/tests/Feature/AuthorizationTest.php`

**Interfaces:**
- Produces: a `demo@example.com` / `password` seed account with folders, tags and notes,
  so the frontend has something to render from Task F5 onward.

- [ ] **Step 1: Write the cross-tenant test**

`backend/tests/Feature/AuthorizationTest.php`:

```php
<?php
use App\Models\Folder;
use App\Models\Note;
use App\Models\Tag;
use App\Models\User;

it('blocks every cross-tenant access path', function () {
    $mine = User::factory()->create();
    $theirs = User::factory()->create();

    $note = Note::factory()->for($theirs)->create();
    $folder = Folder::factory()->for($theirs)->create();
    $tag = Tag::factory()->for($theirs)->create();

    $this->actingAs($mine);

    $this->getJson("/api/v1/notes/{$note->uuid}")->assertForbidden();
    $this->patchJson("/api/v1/notes/{$note->uuid}", ['is_starred' => true])->assertForbidden();
    $this->deleteJson("/api/v1/notes/{$note->uuid}")->assertForbidden();
    $this->putJson("/api/v1/notes/{$note->uuid}/tags", ['names' => []])->assertForbidden();
    $this->patchJson("/api/v1/folders/{$folder->uuid}", ['name' => 'x'])->assertForbidden();
    $this->deleteJson("/api/v1/folders/{$folder->uuid}")->assertForbidden();
    $this->patchJson("/api/v1/tags/{$tag->uuid}", ['name' => 'x'])->assertForbidden();
});

it('requires authentication everywhere', function () {
    $this->getJson('/api/v1/bootstrap')->assertUnauthorized();
    $this->getJson('/api/v1/notes')->assertUnauthorized();
    $this->getJson('/api/v1/search?q=abc')->assertUnauthorized();
});
```

- [ ] **Step 2: Run it**

```bash
php artisan test --filter=AuthorizationTest
```
Expected: PASS. If any assertion fails, the missing `$this->authorize()` call is the bug
— fix it in the owning controller before continuing.

- [ ] **Step 3: Write the seeder**

`backend/database/seeders/DatabaseSeeder.php`:

```php
<?php
namespace Database\Seeders;

use App\Models\Folder;
use App\Models\Note;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::factory()->create([
            'name' => 'Demo User',
            'email' => 'demo@example.com',
            'password' => 'password',
        ]);

        $work = Folder::factory()->for($user)->create(['name' => 'Work', 'color' => '#228be6']);
        Folder::factory()->for($user)->create(['name' => 'Releases', 'parent_id' => $work->id]);
        Folder::factory()->for($user)->create(['name' => 'Personal', 'color' => '#40c057']);

        $todo = Tag::factory()->for($user)->create(['name' => 'todo', 'slug' => 'todo']);
        Tag::factory()->for($user)->create(['name' => 'draft', 'slug' => 'draft']);

        $notes = Note::factory()->count(12)->for($user)->create(['folder_id' => $work->id]);
        $notes->first()->update(['is_starred' => true]);
        $notes->first()->tags()->attach($todo);

        $trashed = Note::factory()->for($user)->create();
        $trashed->delete();
    }
}
```

- [ ] **Step 4: Seed and verify by hand**

```bash
php artisan migrate:fresh --seed
php artisan serve --port=8000
# In another shell:
curl -s http://127.0.0.1:8000/api/v1/health
```
Expected: `{"status":"ok"}`, and the database holds the demo account.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test(backend): cross-tenant authorization coverage; chore: demo seeder"
```

---

### Task B15: Accept a client-minted UUID on note create

**Files:**
- Modify: `backend/app/Http/Requests/StoreNoteRequest.php`,
  `backend/app/Services/Notes/CreateNote.php`
- Test: `backend/tests/Feature/NoteCreateIdempotencyTest.php`

**Interfaces:**
- Produces: `POST /notes` accepting an optional `uuid`. **Idempotent** — a create with
  a UUID that already exists for that user returns the existing note with **200**
  instead of creating a second one. Offline clients mint their own UUIDv7, and a
  flaky reconnect must not produce twins.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/NoteCreateIdempotencyTest.php`:

```php
<?php
use App\Models\Note;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('creates a note with a client-supplied uuid', function () {
    $uuid = '0193c5a1-0000-7000-8000-000000000001';

    $this->postJson('/api/v1/notes', ['uuid' => $uuid])
        ->assertCreated()
        ->assertJsonPath('data.uuid', $uuid);
});

it('is idempotent: replaying the same create returns the existing note', function () {
    $uuid = '0193c5a1-0000-7000-8000-000000000002';

    $this->postJson('/api/v1/notes', ['uuid' => $uuid])->assertCreated();
    $this->postJson('/api/v1/notes', ['uuid' => $uuid])
        ->assertOk()                    // 200, not 201
        ->assertJsonPath('data.uuid', $uuid);

    expect(Note::where('user_id', $this->user->id)->count())->toBe(1);
});

it('still generates a uuid when the client sends none', function () {
    $this->postJson('/api/v1/notes')->assertCreated()
        ->assertJsonPath('data.version', 1);
});

it('does not let one user claim another user\'s uuid', function () {
    $theirs = Note::factory()->for(User::factory())->create();

    $this->postJson('/api/v1/notes', ['uuid' => $theirs->uuid])->assertStatus(422);
});
```

- [ ] **Step 2: Run them and watch them fail**

```powershell
docker compose exec app php artisan test --filter=NoteCreateIdempotencyTest
```
Expected: FAIL — `uuid` is ignored, so the second create makes a second note.

- [ ] **Step 3: Accept the uuid in the request**

`backend/app/Http/Requests/StoreNoteRequest.php`:

```php
<?php
namespace App\Http\Requests;

use App\Models\Note;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreNoteRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'folder_id' => ['nullable', 'uuid'],
            'uuid' => ['nullable', 'uuid'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->filled('uuid')) {
                    return;
                }

                // Taken by somebody else: reject rather than leak its existence
                // through an idempotent 200.
                $ownedByAnother = Note::withTrashed()
                    ->where('uuid', $this->input('uuid'))
                    ->where('user_id', '!=', $this->user()->id)
                    ->exists();

                if ($ownedByAnother) {
                    $validator->errors()->add('uuid', __('That identifier is not available.'));
                }
            },
        ];
    }
}
```

- [ ] **Step 4: Make the service idempotent**

`backend/app/Services/Notes/CreateNote.php` — replace `__invoke`:

```php
    /**
     * @return array{0: Note, 1: bool}  the note, and whether it was newly created
     */
    public function __invoke(User $user, ?string $folderUuid = null, ?string $uuid = null): array
    {
        if ($uuid) {
            $existing = Note::withTrashed()
                ->where('user_id', $user->id)
                ->where('uuid', $uuid)
                ->first();

            // A replayed offline create must not produce twins.
            if ($existing) {
                return [$existing->load(['folder', 'tags']), false];
            }
        }

        $note = new Note([
            'folder_id' => $this->folders->idForUuid($user, $folderUuid),
            'body' => ['type' => 'doc', 'content' => []],
        ]);

        $note->user_id = $user->id;
        if ($uuid) {
            $note->uuid = $uuid;
        }
        ($this->derive)($note);
        $note->save();

        return [$note->load(['folder', 'tags']), true];
    }
```

- [ ] **Step 5: Update the controller**

```php
public function store(StoreNoteRequest $request, CreateNote $createNote)
{
    [$note, $created] = $createNote(
        $request->user(),
        $request->validated('folder_id'),
        $request->validated('uuid'),
    );

    return (new NoteResource($note))->response()->setStatusCode($created ? 201 : 200);
}
```

- [ ] **Step 6: Run the tests**

```powershell
docker compose exec app php artisan test --filter=NoteCreateIdempotencyTest
docker compose exec app php artisan test --filter=ArchitectureTest
docker compose exec app php artisan test
```
Expected: PASS throughout. Task B7's "creates an empty note" test still passes, because
`uuid` is optional.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(backend): idempotent note create with client-supplied uuid"
```

---

### Task B16: Token authentication for native clients

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/TokenController.php`,
  `backend/app/Http/Requests/IssueTokenRequest.php`,
  `backend/app/Services/Auth/IssueToken.php`,
  `backend/app/Services/Auth/RevokeCurrentToken.php`
- Modify: `backend/routes/api.php`, `backend/config/sanctum.php`
- Test: `backend/tests/Feature/TokenAuthTest.php`

**Interfaces:**
- Produces: `POST /api/v1/tokens` `{email, password, device_name}` → `{token}` shown
  once, and `DELETE /api/v1/tokens/current`. Both auth mechanisms work on the same
  `auth:sanctum` routes — cookies for the browser, Bearer for native.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/TokenAuthTest.php`:

```php
<?php
use App\Models\User;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->user = User::factory()->create(['password' => Hash::make('correct-horse-battery')]);
});

it('issues a token for valid credentials', function () {
    $this->postJson('/api/v1/tokens', [
        'email' => $this->user->email,
        'password' => 'correct-horse-battery',
        'device_name' => "Akash's ThinkPad",
    ])->assertCreated()->assertJsonStructure(['token']);

    expect($this->user->tokens()->count())->toBe(1)
        ->and($this->user->tokens()->first()->name)->toBe("Akash's ThinkPad");
});

it('refuses a bad password', function () {
    $this->postJson('/api/v1/tokens', [
        'email' => $this->user->email, 'password' => 'wrong', 'device_name' => 'x',
    ])->assertStatus(422);
});

it('authenticates an API request with the token', function () {
    $token = $this->postJson('/api/v1/tokens', [
        'email' => $this->user->email,
        'password' => 'correct-horse-battery',
        'device_name' => 'Desktop',
    ])->json('token');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.email', $this->user->email);
});

it('revokes only the calling token on sign-out', function () {
    $a = $this->user->createToken('Device A')->plainTextToken;
    $this->user->createToken('Device B');

    $this->withHeader('Authorization', "Bearer {$a}")
        ->deleteJson('/api/v1/tokens/current')->assertNoContent();

    // Signing out one device must not sign out the others.
    expect($this->user->fresh()->tokens()->count())->toBe(1)
        ->and($this->user->fresh()->tokens()->first()->name)->toBe('Device B');
});

it('rejects a revoked token', function () {
    $token = $this->user->createToken('Gone')->plainTextToken;
    $this->user->tokens()->delete();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')->assertUnauthorized();
});

it('still accepts a cookie session on the same route', function () {
    // Both guards coexist: this is the whole reason for choosing Sanctum.
    $this->actingAs($this->user);
    $this->getJson('/api/v1/me')->assertOk();
});
```

- [ ] **Step 2: Run them and watch them fail**

```powershell
docker compose exec app php artisan test --filter=TokenAuthTest
```
Expected: FAIL — 404 on `/tokens`.

- [ ] **Step 3: Write the request**

`backend/app/Http/Requests/IssueTokenRequest.php`:

```php
<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class IssueTokenRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            // Shown in a future device list, so it must be meaningful and bounded.
            'device_name' => ['required', 'string', 'max:120'],
        ];
    }
}
```

- [ ] **Step 4: Write the services**

`backend/app/Services/Auth/IssueToken.php`:

```php
<?php
namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class IssueToken
{
    public function __invoke(string $email, string $password, string $deviceName): string
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            // Same generic message as cookie login: never reveal whether the
            // address is registered.
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        // One token per device. Re-issuing for the same device name replaces the
        // old one, so a reinstall does not accumulate dead tokens.
        $user->tokens()->where('name', $deviceName)->delete();

        return $user->createToken($deviceName)->plainTextToken;
    }
}
```

`backend/app/Services/Auth/RevokeCurrentToken.php`:

```php
<?php
namespace App\Services\Auth;

use App\Models\User;

class RevokeCurrentToken
{
    /** Revokes only the calling device's token, never the others. */
    public function __invoke(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }
}
```

- [ ] **Step 5: Write the controller and routes**

`backend/app/Http/Controllers/Api/V1/TokenController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\IssueTokenRequest;
use App\Services\Auth\IssueToken;
use App\Services\Auth\RevokeCurrentToken;
use Illuminate\Http\Request;

class TokenController extends Controller
{
    public function store(IssueTokenRequest $request, IssueToken $issueToken)
    {
        $token = $issueToken(
            $request->validated('email'),
            $request->validated('password'),
            $request->validated('device_name'),
        );

        return response()->json(['token' => $token], 201);
    }

    public function destroy(Request $request, RevokeCurrentToken $revoke)
    {
        $revoke($request->user());

        return response()->noContent();
    }
}
```

```php
// routes/api.php
Route::post('/tokens', [TokenController::class, 'store'])->middleware('throttle:5,1');
Route::middleware('auth:sanctum')->delete('/tokens/current', [TokenController::class, 'destroy']);
```

- [ ] **Step 6: Set a token expiry**

`backend/config/sanctum.php`:

```php
// 90 days. Tokens are revocable server-side, so this is a backstop, not the
// primary control.
'expiration' => 60 * 24 * 90,
```

- [ ] **Step 7: Run the tests**

```powershell
docker compose exec app php artisan test --filter=TokenAuthTest
docker compose exec app php artisan test --filter=ArchitectureTest
```
Expected: PASS (6 tests), guard green.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(backend): Bearer token auth for native clients alongside cookie sessions"
```

---

### Task B17: Revision counter and tombstones

**Files:**
- Create: `backend/database/migrations/*_add_sync_revisions.php`,
  `backend/app/Models/Tombstone.php`,
  `backend/app/Services/Sync/BumpRevision.php`,
  `backend/app/Services/Sync/RecordTombstone.php`
- Modify: `backend/app/Models/Note.php`, `Folder.php`, `Tag.php` (a `booted` hook),
  `backend/app/Services/Notes/DeleteNote.php`, `EmptyTrash.php`,
  `backend/app/Console/Commands/PruneEmptyNotes.php`, `PurgeTrash.php`
- Test: `backend/tests/Feature/SyncRevisionTest.php`

**Interfaces:**
- Produces: a monotonic `revision` per account, stamped on every syncable write, and
  a `tombstones` row for every **hard** delete.
- `BumpRevision::__invoke(User $user): int` — the next revision, inside a transaction.
- `RecordTombstone::__invoke(User $user, string $type, string $uuid): void`.

- [ ] **Step 1: Write the migration**

```php
Schema::create('user_sync_counters', function (Blueprint $table) {
    $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
    $table->unsignedBigInteger('last_revision')->default(0);
});

Schema::create('tombstones', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('entity_type', 16);           // note | folder | tag
    $table->uuid('uuid');
    $table->unsignedBigInteger('revision');
    $table->timestamp('created_at')->useCurrent();
    $table->index(['user_id', 'revision']);
});

foreach (['notes', 'folders', 'tags'] as $table) {
    Schema::table($table, function (Blueprint $t) {
        $t->unsignedBigInteger('revision')->default(0);
        $t->index(['user_id', 'revision']);
    });
}
```

- [ ] **Step 2: Write the failing tests**

`backend/tests/Feature/SyncRevisionTest.php`:

```php
<?php
use App\Models\Note;
use App\Models\Tombstone;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('stamps an increasing revision on every write', function () {
    $a = Note::factory()->for($this->user)->create();
    $b = Note::factory()->for($this->user)->create();

    expect($b->fresh()->revision)->toBeGreaterThan($a->fresh()->revision);
});

it('bumps the revision when a note is updated', function () {
    $note = Note::factory()->for($this->user)->create();
    $before = $note->fresh()->revision;

    $this->patchJson("/api/v1/notes/{$note->uuid}", ['is_starred' => true])->assertOk();

    expect($note->fresh()->revision)->toBeGreaterThan($before);
});

it('keeps revisions separate per account', function () {
    $mine = Note::factory()->for($this->user)->create();
    $theirs = Note::factory()->for(User::factory())->create();

    // Two accounts must not share a counter, or one leaks the other's write rate.
    expect($theirs->fresh()->revision)->toBe(1)
        ->and($mine->fresh()->revision)->toBe(1);
});

it('writes a tombstone on hard delete but not on soft delete', function () {
    $note = Note::factory()->for($this->user)->create();

    $this->deleteJson("/api/v1/notes/{$note->uuid}")->assertNoContent();
    expect(Tombstone::count())->toBe(0);          // trashed, still discoverable

    $this->deleteJson("/api/v1/notes/{$note->uuid}?force=1")->assertNoContent();
    expect(Tombstone::where('uuid', $note->uuid)->exists())->toBeTrue();
});

it('writes tombstones when the trash is emptied', function () {
    $a = Note::factory()->for($this->user)->create();
    $b = Note::factory()->for($this->user)->create();
    $a->delete(); $b->delete();

    $this->deleteJson('/api/v1/trash')->assertNoContent();

    expect(Tombstone::where('user_id', $this->user->id)->count())->toBe(2);
});

it('writes tombstones when the purge command runs', function () {
    $note = Note::factory()->for($this->user)->create();
    $note->delete();
    $note->forceFill(['deleted_at' => now()->subDays(31)])->save();

    $this->artisan('notes:purge-trash');

    // Otherwise a device offline for 31 days never learns the note is gone.
    expect(Tombstone::where('uuid', $note->uuid)->exists())->toBeTrue();
});
```

- [ ] **Step 3: Run them and watch them fail**

```powershell
docker compose exec app php artisan test --filter=SyncRevisionTest
```
Expected: FAIL — no `revision` column, no `Tombstone`.

- [ ] **Step 4: Write the services**

`backend/app/Services/Sync/BumpRevision.php`:

```php
<?php
namespace App\Services\Sync;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class BumpRevision
{
    /**
     * The next revision for this account. A row-level counter rather than a
     * timestamp: clock adjustment and same-millisecond writes silently lose
     * notes from a timestamp-based sync.
     */
    public function __invoke(User $user): int
    {
        return DB::transaction(function () use ($user) {
            DB::table('user_sync_counters')->upsert(
                ['user_id' => $user->id, 'last_revision' => 0], ['user_id'], []
            );

            DB::table('user_sync_counters')->where('user_id', $user->id)
                ->lockForUpdate()->increment('last_revision');

            return (int) DB::table('user_sync_counters')
                ->where('user_id', $user->id)->value('last_revision');
        });
    }
}
```

`backend/app/Services/Sync/RecordTombstone.php`:

```php
<?php
namespace App\Services\Sync;

use App\Models\Tombstone;
use App\Models\User;

class RecordTombstone
{
    public function __construct(private readonly BumpRevision $bump) {}

    public function __invoke(User $user, string $entityType, string $uuid): void
    {
        Tombstone::create([
            'user_id' => $user->id,
            'entity_type' => $entityType,
            'uuid' => $uuid,
            'revision' => ($this->bump)($user),
        ]);
    }
}
```

- [ ] **Step 5: Stamp the revision automatically**

Add to `Note`, `Folder` and `Tag`:

```php
protected static function booted(): void
{
    static::saving(function (self $model) {
        if ($model->user_id && $model->isDirty(array_diff($model->getDirty() ? array_keys($model->getDirty()) : [], ['revision']))) {
            $model->revision = app(\App\Services\Sync\BumpRevision::class)($model->user);
        }
    });
}
```

- [ ] **Step 6: Record tombstones on every hard-delete path**

`DeleteNote` (when `$force`), `EmptyTrash` (one per note), `PurgeTrash` and
`PruneEmptyNotes` all call `RecordTombstone` before the row disappears. Collect the
UUIDs first — once `forceDelete()` has run there is nothing left to record.

- [ ] **Step 7: Prune tombstones, but not too soon**

Add to `routes/console.php`:

```php
// Retained 90 days — three times the 30-day trash purge. A device offline
// longer than this is told to full-resync rather than silently reconciled.
Schedule::call(fn () => \App\Models\Tombstone::where('created_at', '<', now()->subDays(90))->delete())
    ->dailyAt('03:30');
```

- [ ] **Step 8: Run the tests**

```powershell
docker compose exec app php artisan test --filter=SyncRevisionTest
docker compose exec app php artisan test
```
Expected: PASS (6 tests) and the full suite green.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(backend): per-account revision counter and tombstones for sync"
```

---

### Task B18: The sync pull endpoint

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/SyncController.php`,
  `backend/app/Http/Requests/SyncRequest.php`,
  `backend/app/Services/Sync/BuildSyncDelta.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/SyncPullTest.php`

**Interfaces:**
- Produces: `GET /api/v1/sync?since=<revision>&limit=200` →
  `{revision, notes[], folders[], tags[], deletions[{type,uuid}], has_more}`.
  `since=0` is a full sync. A `since` older than the oldest tombstone returns
  `{full_resync_required: true}`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/SyncPullTest.php`:

```php
<?php
use App\Models\Note;
use App\Models\Tombstone;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('returns everything for since=0', function () {
    Note::factory()->count(3)->for($this->user)->create();

    $this->getJson('/api/v1/sync?since=0')
        ->assertOk()->assertJsonCount(3, 'notes')->assertJsonPath('has_more', false);
});

it('returns only what changed after the given revision', function () {
    $old = Note::factory()->for($this->user)->create();
    $mark = $old->fresh()->revision;
    $new = Note::factory()->for($this->user)->create();

    $res = $this->getJson("/api/v1/sync?since={$mark}")->assertOk();

    expect($res->json('notes'))->toHaveCount(1)
        ->and($res->json('notes.0.uuid'))->toBe($new->uuid);
});

it('reports deletions so an offline device can drop its copy', function () {
    $note = Note::factory()->for($this->user)->create();
    $mark = $note->fresh()->revision;
    $this->deleteJson("/api/v1/notes/{$note->uuid}?force=1");

    $this->getJson("/api/v1/sync?since={$mark}")
        ->assertOk()
        ->assertJsonPath('deletions.0.uuid', $note->uuid)
        ->assertJsonPath('deletions.0.type', 'note');
});

it('includes trashed notes as rows, not deletions', function () {
    $note = Note::factory()->for($this->user)->create();
    $mark = $note->fresh()->revision;
    $this->deleteJson("/api/v1/notes/{$note->uuid}");

    // Soft deletes travel as ordinary rows with deleted_at set, so Trash syncs.
    $this->getJson("/api/v1/sync?since={$mark}")
        ->assertOk()->assertJsonCount(1, 'notes')->assertJsonCount(0, 'deletions');
});

it('paginates and advances the high-water mark', function () {
    Note::factory()->count(5)->for($this->user)->create();

    $first = $this->getJson('/api/v1/sync?since=0&limit=2')->assertOk();
    expect($first->json('has_more'))->toBeTrue()->and($first->json('notes'))->toHaveCount(2);

    $second = $this->getJson('/api/v1/sync?since='.$first->json('revision').'&limit=2');
    expect($second->json('notes'))->toHaveCount(2);
});

// REVIEW FOCUS 10
it('demands a full resync when since predates the oldest tombstone', function () {
    Tombstone::create([
        'user_id' => $this->user->id, 'entity_type' => 'note',
        'uuid' => '0193c5a1-0000-7000-8000-00000000aaaa', 'revision' => 50,
    ]);

    $this->getJson('/api/v1/sync?since=10')
        ->assertOk()->assertJsonPath('full_resync_required', true);
});

it('never returns another account\'s rows', function () {
    Note::factory()->count(2)->for(User::factory())->create();

    $this->getJson('/api/v1/sync?since=0')->assertOk()->assertJsonCount(0, 'notes');
});
```

- [ ] **Step 2: Run them and watch them fail**

```powershell
docker compose exec app php artisan test --filter=SyncPullTest
```
Expected: FAIL — 404.

- [ ] **Step 3: Write the request and the service**

`backend/app/Http/Requests/SyncRequest.php` validates
`['since' => ['required','integer','min:0'], 'limit' => ['nullable','integer','min:1','max:500']]`.

`backend/app/Services/Sync/BuildSyncDelta.php`:

```php
<?php
namespace App\Services\Sync;

use App\Http\Resources\FolderResource;
use App\Http\Resources\NoteResource;
use App\Http\Resources\TagResource;
use App\Models\Note;
use App\Models\Tombstone;
use App\Models\User;

class BuildSyncDelta
{
    public function __invoke(User $user, int $since, int $limit = 200): array
    {
        // A device that has been away longer than tombstone retention cannot be
        // reconciled incrementally: it would keep notes that were hard-deleted.
        $oldestTombstone = Tombstone::where('user_id', $user->id)->min('revision');

        if ($since > 0 && $oldestTombstone !== null && $since < $oldestTombstone) {
            return ['full_resync_required' => true];
        }

        $notes = Note::withTrashed()->ownedBy($user)
            ->where('revision', '>', $since)
            ->with(['folder', 'tags'])
            ->orderBy('revision')->limit($limit + 1)->get();

        $hasMore = $notes->count() > $limit;
        $notes = $notes->take($limit);

        $folders = $user->folders()->where('revision', '>', $since)->orderBy('revision')->get();
        $tags = $user->tags()->where('revision', '>', $since)->orderBy('revision')->get();

        $deletions = Tombstone::where('user_id', $user->id)
            ->where('revision', '>', $since)->orderBy('revision')->limit($limit)->get()
            ->map(fn ($t) => ['type' => $t->entity_type, 'uuid' => $t->uuid]);

        // The high-water mark is the largest revision actually returned, so a
        // truncated page never advances the client past rows it has not seen.
        $revision = max([
            $since,
            (int) $notes->max('revision'),
            (int) $folders->max('revision'),
            (int) $tags->max('revision'),
            (int) $deletions->count() ? (int) Tombstone::where('user_id', $user->id)
                ->where('revision', '>', $since)->limit($limit)->max('revision') : $since,
        ]);

        return [
            'revision' => $revision,
            'notes' => NoteResource::collection($notes),
            'folders' => FolderResource::collection($folders),
            'tags' => TagResource::collection($tags),
            'deletions' => $deletions->values(),
            'has_more' => $hasMore,
        ];
    }
}
```

- [ ] **Step 4: Write the controller and route**

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SyncRequest;
use App\Services\Sync\BuildSyncDelta;

class SyncController extends Controller
{
    public function __invoke(SyncRequest $request, BuildSyncDelta $buildDelta)
    {
        return $buildDelta(
            $request->user(),
            (int) $request->validated('since'),
            (int) ($request->validated('limit') ?? 200),
        );
    }
}
```

```php
Route::get('/sync', SyncController::class)->middleware('throttle:120,1');
```

- [ ] **Step 5: Run the tests**

```powershell
docker compose exec app php artisan test --filter=SyncPullTest
docker compose exec app php artisan test --filter=ArchitectureTest
```
Expected: PASS (7 tests), including Review Focus item 10.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(backend): sync pull endpoint with tombstones and full-resync guard"
```

---

# PHASE 2 — FRONTEND

### Task F1: Verify and configure the provided Vite app

> **The app already exists.** Do not run `npm create vite`. This task installs the
> pinned dependencies and replaces the starter files with the project's own.

**Files:**
- Create: `frontend/src/theme.ts`, `frontend/.env.development`
- Copy in: the contents of `assets/brand/` (see Step 7) — **already generated**
- Modify: `frontend/vite.config.ts`, `frontend/tsconfig.json`,
  `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`,
  `frontend/index.html`, `frontend/package.json`
- Delete: `frontend/src/assets/react.svg`, `frontend/src/App.css`,
  `frontend/public/vite.svg`
- Test: `frontend/src/theme.test.ts`

**Interfaces:**
- Produces: a running Vite dev server on port 5173 with `MantineProvider`,
  `Notifications`, `ModalsProvider` mounted and the `@` path alias pointing at `src/`.

- [ ] **Step 1: Verify the scaffold, then install the pinned dependencies**

Node runs on the Windows host, not in Docker:

```powershell
cd frontend
node --version        # v20 or newer
npm --version
```

Confirm this is a React + TypeScript Vite project — `package.json` should list `react`,
`react-dom` and `@vitejs/plugin-react`, and `src/main.tsx` should exist. If it is a
JavaScript template instead of TypeScript, **stop and report it**.

```powershell
npm install

npm install @mantine/core@9.7.1 @mantine/hooks@9.7.1 @mantine/tiptap@9.7.1 \
  @mantine/spotlight@9.7.1 @mantine/notifications@9.7.1 @mantine/modals@9.7.1 \
  @mantine/form@9.7.1 @tabler/icons-react@3.49.0 \
  @tanstack/react-query@5.104.1 zustand@5.0.15 react-router@8.4.0 axios@1.20.0 \
  dayjs@1.11.23 idb-keyval@6.2.2

npm install -D vitest@latest @testing-library/react@latest @testing-library/jest-dom@latest \
  jsdom@latest @playwright/test@latest
```

Remove the Vite starter leftovers so they cannot be mistaken for project files:

```powershell
Remove-Item -Force src/App.css, src/assets/react.svg -ErrorAction SilentlyContinue
```

- [ ] **Step 2: Configure Vite**

`frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    // Same-origin in development, so there is no cross-site cookie at all.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/sanctum': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  test: { environment: 'jsdom', globals: true },
})
```

`frontend/tsconfig.json` — add to `compilerOptions`:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "baseUrl": ".",
  "paths": { "@/*": ["src/*"] }
}
```

`frontend/.env.development`:

```dotenv
VITE_API_URL=/api/v1
```

- [ ] **Step 3: Write the failing theme test**

`frontend/src/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { theme } from './theme'

describe('theme', () => {
  it('uses blue as the primary colour', () => {
    expect(theme.primaryColor).toBe('blue')
  })

  it('sets a default radius', () => {
    expect(theme.defaultRadius).toBe('md')
  })
})
```

- [ ] **Step 4: Run it and watch it fail**

```bash
npx vitest run src/theme.test.ts
```
Expected: FAIL — cannot resolve `./theme`.

- [ ] **Step 5: Write the theme**

`frontend/src/theme.ts`:

```ts
import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  headings: { fontWeight: '650' },
  components: {
    // Mobile Safari zooms the page when a focused input is under 16px.
    Input: { styles: { input: { fontSize: 16 } } },
  },
})
```

- [ ] **Step 6: Mount the providers**

`frontend/src/main.tsx`:

```tsx
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/spotlight/styles.css'
import '@mantine/tiptap/styles.css'
import './index.css'

import { ColorSchemeScript, MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { theme } from './theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorSchemeScript defaultColorScheme="auto" />
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider>
        <Notifications position="bottom-center" />
        <App />
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
)
```

`frontend/src/App.tsx` — a placeholder until Task F3:

```tsx
import { Text } from '@mantine/core'

export function App() {
  return <Text p="md">Notes</Text>
}
```

`frontend/src/index.css`:

```css
html, body, #root { height: 100dvh; margin: 0; }
```

- [ ] **Step 7: Install the brand assets**

The icons already exist in `assets/brand/` — **generate nothing**. Copy them in and
delete Vite's own logo, or every browser tab will say "Vite + React":

```powershell
Copy-Item assets\brand\favicon.svg, assets\brand\favicon.ico,
          assets\brand\apple-touch-icon.png, assets\brand\icon-192.png,
          assets\brand\icon-512.png, assets\brand\icon-512-maskable.png,
          assets\brand\og-image.png  frontend\public\

New-Item -ItemType Directory -Force frontend\src\assets | Out-Null
Copy-Item assets\brand\logo.svg, assets\brand\logo-dark.svg  frontend\src\assets\

Remove-Item frontend\public\vite.svg -ErrorAction SilentlyContinue
```

Replace the `<head>` of `frontend/index.html` with:

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />

<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />

<meta name="theme-color" content="#228be6" />
<meta name="description" content="Write, organise and search your notes." />
<meta property="og:title" content="Notes" />
<meta property="og:description" content="Write, organise and search your notes." />
<meta property="og:image" content="/og-image.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />

<title>Notes</title>
```

Set the package name in `frontend/package.json`:

```json
{ "name": "notes-app", "private": true }
```

`assets/brand/manifest.webmanifest` is **not** copied — Task F16 has
`vite-plugin-pwa` generate the manifest instead, so there is one source of truth.

> `assets/brand/README.md` documents what every file is for. Do not generate,
> redraw, recolour or replace any of them.

- [ ] **Step 8: Run the test and the dev server**

```bash
npx vitest run src/theme.test.ts   # PASS
npm run dev                        # http://localhost:5173 renders "Notes"
```

Check the browser tab shows the new icon and the title "Notes", not "Vite + React".

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(frontend): scaffold Vite + React 19 + Mantine with strict TypeScript"
```

---

### Task F2: API client and query layer

**Files:**
- Create: `frontend/src/api/client.ts`, `frontend/src/types/api.ts`,
  `frontend/src/lib/queryClient.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces:
  - `api` — a configured axios instance with `withCredentials` **and**
    `withXSRFToken`.
  - `ensureCsrf(): Promise<void>` — calls `/sanctum/csrf-cookie` once.
  - `ApiError` — `{status, message, errors?: Record<string,string[]>, serverCopy?: Note}`.
  - `queryClient` — a TanStack `QueryClient` that does not retry 4xx.
  - Types `Note`, `NoteListItem`, `Folder`, `Tag`, `User`, `Bootstrap`, `SearchResults`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/api/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { api, normalizeError } from './client'

describe('api client', () => {
  it('sends credentials and the XSRF header', () => {
    // Both are required. Without withXSRFToken every write returns 419.
    expect(api.defaults.withCredentials).toBe(true)
    expect(api.defaults.withXSRFToken).toBe(true)
  })

  it('normalises a 422 into field errors', () => {
    const err = normalizeError({
      response: { status: 422, data: { message: 'Invalid', errors: { email: ['taken'] } } },
    })

    expect(err.status).toBe(422)
    expect(err.errors?.email?.[0]).toBe('taken')
  })

  it('carries the server copy out of a 409', () => {
    const err = normalizeError({
      response: { status: 409, data: { message: 'Conflict', server_copy: { data: { version: 9 } } } },
    })

    expect(err.status).toBe(409)
    expect(err.serverCopy?.version).toBe(9)
  })

  it('reports a network failure without a response', () => {
    expect(normalizeError({ message: 'Network Error' }).status).toBe(0)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/api/client.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the types**

`frontend/src/types/api.ts`:

```ts
export type UUID = string
export type ISODate = string

export interface User {
  uuid: UUID
  name: string
  email: string
  preferences: Preferences
}

export interface Preferences {
  theme?: 'light' | 'dark' | 'system'
  sort?: 'updated' | 'created' | 'title'
  group_by_date?: boolean
  show_snippets?: boolean
}

export interface Folder {
  uuid: UUID
  name: string
  parent_uuid: UUID | null
  color: string | null
  position: number
}

export interface Tag {
  uuid: UUID
  name: string
  slug: string
}

export interface NoteListItem {
  uuid: UUID
  title: string
  excerpt: string
  is_starred: boolean
  folder: { uuid: UUID; name: string } | null
  tags: string[]
  updated_at: ISODate
  deleted_at: ISODate | null
}

/** A ProseMirror document. Opaque to everything outside the editor. */
export interface ProseMirrorDoc {
  type: 'doc'
  content: unknown[]
}

export interface Note extends NoteListItem {
  body: ProseMirrorDoc | null
  version: number
  word_count: number
  title_locked: boolean
}

export interface Counts {
  all: number
  starred: number
  trashed: number
  folders: Record<UUID, number>
  tags: Record<string, number>
}

export interface Bootstrap {
  user: { data: User }
  folders: { data: Folder[] }
  tags: { data: Tag[] }
  counts: Counts
  notes: { data: NoteListItem[] }
}

export interface SearchHit {
  uuid: UUID
  title: string
  /** Plain text. The server never sends HTML; the client highlights `terms`. */
  snippet: string
  terms: string[]
}

export interface SearchResults {
  notes: SearchHit[]
  folders: { uuid: UUID; name: string }[]
  tags: Tag[]
}
```

- [ ] **Step 4: Write the client**

`frontend/src/api/client.ts`:

```ts
import axios, { type AxiosInstance } from 'axios'
import type { Note } from '@/types/api'

export interface ApiError {
  status: number
  message: string
  errors?: Record<string, string[]>
  serverCopy?: Note
}

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  withCredentials: true,
  // Required since axios 1.6: without it the X-XSRF-TOKEN header is not
  // attached and every write returns 419 CSRF token mismatch.
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

let csrfPrimed = false

export async function ensureCsrf(): Promise<void> {
  if (csrfPrimed) return
  await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
  csrfPrimed = true
}

export function normalizeError(e: unknown): ApiError {
  const err = e as { response?: { status: number; data?: Record<string, unknown> }; message?: string }

  if (!err.response) {
    return { status: 0, message: err.message ?? 'Network error' }
  }

  const data = err.response.data ?? {}
  const serverCopy = (data.server_copy as { data?: Note } | undefined)?.data

  return {
    status: err.response.status,
    message: (data.message as string) ?? 'Request failed',
    errors: data.errors as Record<string, string[]> | undefined,
    serverCopy,
  }
}

// 419 means the CSRF cookie expired: re-prime it and retry exactly once.
api.interceptors.response.use(undefined, async (error) => {
  const status = error?.response?.status
  const config = error?.config

  if (status === 419 && config && !config.__retried) {
    config.__retried = true
    csrfPrimed = false
    await ensureCsrf()
    return api.request(config)
  }

  return Promise.reject(error)
})
```

- [ ] **Step 5: Write the query client**

`frontend/src/lib/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Never retry a client error: 403 and 422 will not succeed on a retry.
      retry: (count, error: unknown) => {
        const status = (error as { response?: { status: number } })?.response?.status ?? 0
        if (status >= 400 && status < 500) return false
        return count < 2
      },
    },
    mutations: { retry: false },
  },
})
```

- [ ] **Step 6: Run the tests**

```bash
npx vitest run src/api/client.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(frontend): axios client with CSRF handling and typed API contracts"
```

---

### Task F3: Auth pages and route guard

**Files:**
- Create: `frontend/src/api/auth.ts`, `frontend/src/hooks/queries/useAuth.ts`,
  `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx`,
  `frontend/src/components/RequireAuth.tsx`, `frontend/src/routes.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/hooks/queries/useAuth.test.tsx`

**Interfaces:**
- Produces:
  - `useMe()` — `{data: User | null, isLoading}`.
  - `useLogin()`, `useRegister()`, `useLogout()` — TanStack mutations.
  - `<RequireAuth>` — renders children when signed in, redirects to `/login` otherwise.
  - Routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/` (app).

- [ ] **Step 1: Write the API functions**

`frontend/src/api/auth.ts`:

```ts
import { api, ensureCsrf } from './client'
import type { User } from '@/types/api'

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<{ data: User }>('/me')
  return data.data
}

export async function login(payload: { email: string; password: string }): Promise<User> {
  await ensureCsrf()
  const { data } = await api.post<{ data: User }>('/login', payload)
  return data.data
}

export async function register(payload: {
  name: string
  email: string
  password: string
  password_confirmation: string
}): Promise<User> {
  await ensureCsrf()
  const { data } = await api.post<{ data: User }>('/register', payload)
  return data.data
}

export async function logout(): Promise<void> {
  await api.post('/logout')
}
```

- [ ] **Step 2: Write the failing hook test**

`frontend/src/hooks/queries/useAuth.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/api/client'
import { useMe } from './useAuth'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useMe', () => {
  it('returns the signed-in user', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: { data: { uuid: 'u1', name: 'Akash', email: 'a@b.com', preferences: {} } },
    } as never)

    const { result } = renderHook(() => useMe(), { wrapper })

    await waitFor(() => expect(result.current.data?.name).toBe('Akash'))
  })

  it('returns null rather than throwing when signed out', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce({ response: { status: 401 } })

    const { result } = renderHook(() => useMe(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeNull()
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run src/hooks/queries/useAuth.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 4: Write the hooks**

`frontend/src/hooks/queries/useAuth.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/api/auth'
import type { User } from '@/types/api'

export const AUTH_KEY = ['me'] as const

export function useMe() {
  return useQuery<User | null>({
    queryKey: AUTH_KEY,
    queryFn: async () => {
      try {
        return await authApi.fetchMe()
      } catch (e) {
        // Signed out is a normal state, not an error the UI should surface.
        if ((e as { response?: { status: number } })?.response?.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => qc.setQueryData(AUTH_KEY, user),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (user) => qc.setQueryData(AUTH_KEY, user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      qc.setQueryData(AUTH_KEY, null)
      qc.clear()
    },
  })
}
```

- [ ] **Step 5: Write the login page**

`frontend/src/pages/LoginPage.tsx`:

```tsx
import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { Link, useNavigate } from 'react-router'

import { normalizeError } from '@/api/client'
import { useLogin } from '@/hooks/queries/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useLogin()

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Enter a valid email address'),
      password: (v) => (v.length > 0 ? null : 'Enter your password'),
    },
  })

  const error = login.error ? normalizeError(login.error) : null

  return (
    <Center h="100dvh" p="md">
      <Paper withBorder p="xl" w={400} maw="100%">
        <Title order={2} mb="lg">Sign in</Title>

        <form
          onSubmit={form.onSubmit((values) =>
            login.mutate(values, { onSuccess: () => navigate('/') }),
          )}
        >
          <Stack>
            {error && <Alert color="red">{error.message}</Alert>}

            <TextInput label="Email" autoComplete="email" {...form.getInputProps('email')} />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              {...form.getInputProps('password')}
            />

            {/* Spinner inside the button, never a full-screen loader. */}
            <Button type="submit" loading={login.isPending} fullWidth>
              Sign in
            </Button>

            <Button component={Link} to="/register" variant="subtle" size="compact-sm">
              Create an account
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
```

`frontend/src/pages/RegisterPage.tsx` — the same structure with `name`, `email`,
`password`, `password_confirmation`, calling `useRegister()`, validating that the two
passwords match and that the password is at least 8 characters.

- [ ] **Step 6: Write the guard and routes**

`frontend/src/components/RequireAuth.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { AppSkeleton } from '@/components/common/Skeletons'
import { useMe } from '@/hooks/queries/useAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe()

  // A skeleton of the real layout, not a centred spinner.
  if (isLoading) return <AppSkeleton />
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
```

`frontend/src/routes.tsx`:

```tsx
import { createBrowserRouter } from 'react-router'

import { RequireAuth } from '@/components/RequireAuth'
import { AppPage } from '@/pages/AppPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/', element: <RequireAuth><AppPage /></RequireAuth> },
  { path: '/notes/:uuid', element: <RequireAuth><AppPage /></RequireAuth> },
])
```

`frontend/src/App.tsx`:

```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'

import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 7: Run the tests**

```bash
npx vitest run src/hooks/queries/useAuth.test.tsx
```
Expected: PASS (2 tests).

- [ ] **Step 8: Verify against the real backend**

With `php artisan serve` running and the database seeded, sign in at
`http://localhost:5173/login` as `demo@example.com` / `password`, then reload the page
and confirm you are still signed in.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(frontend): auth pages, session hooks and route guard"
```

---

### Task F4: App shell and responsive layout

**Files:**
- Create: `frontend/src/components/layout/AppShell.tsx`,
  `frontend/src/components/layout/Header.tsx`,
  `frontend/src/components/layout/StatusBar.tsx`,
  `frontend/src/stores/uiStore.ts`, `frontend/src/components/layout/shell.module.css`
- Create: `frontend/src/pages/AppPage.tsx`
- Test: `frontend/src/stores/uiStore.test.ts`

**Interfaces:**
- Produces:
  - `useUiStore` (Zustand) — `{view, setView, navOpen, toggleNav, listCollapsed,
    toggleList, scope, setScope}` where `view: 'folders' | 'list' | 'editor'` drives the
    phone stack and `scope` is the list pane's current filter.
  - `<AppShellLayout>` — three panes at ≥1100px, two panes plus a drawer at 768–1099px,
    one pane at ≤767px.

- [ ] **Step 1: Write the failing store test**

`frontend/src/stores/uiStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from './uiStore'

describe('uiStore', () => {
  beforeEach(() => useUiStore.setState(useUiStore.getInitialState()))

  it('starts on the list pane', () => {
    expect(useUiStore.getState().view).toBe('list')
  })

  it('navigates the phone stack', () => {
    useUiStore.getState().setView('editor')
    expect(useUiStore.getState().view).toBe('editor')
  })

  it('toggles the sidebar', () => {
    useUiStore.getState().toggleNav()
    expect(useUiStore.getState().navOpen).toBe(true)
  })

  it('clears the filter when the scope changes', () => {
    useUiStore.setState({ filter: 'rele' })
    useUiStore.getState().setScope({ kind: 'folder', uuid: 'f1', label: 'Work' })

    // A sticky filter after a scope change makes notes look deleted.
    expect(useUiStore.getState().filter).toBe('')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/stores/uiStore.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the store**

`frontend/src/stores/uiStore.ts`:

```ts
import { create } from 'zustand'
import type { UUID } from '@/types/api'

export type View = 'folders' | 'list' | 'editor'

export type Scope =
  | { kind: 'all'; label: string }
  | { kind: 'starred'; label: string }
  | { kind: 'trash'; label: string }
  | { kind: 'folder'; uuid: UUID; label: string }
  | { kind: 'tag'; slug: string; label: string }
  | { kind: 'search'; q: string; label: string }

interface UiState {
  view: View
  navOpen: boolean
  listCollapsed: boolean
  scope: Scope
  filter: string
  setView: (v: View) => void
  toggleNav: () => void
  closeNav: () => void
  toggleList: () => void
  setScope: (s: Scope) => void
  setFilter: (f: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  view: 'list',
  navOpen: false,
  listCollapsed: false,
  scope: { kind: 'all', label: 'All notes' },
  filter: '',
  setView: (view) => set({ view }),
  toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
  closeNav: () => set({ navOpen: false }),
  toggleList: () => set((s) => ({ listCollapsed: !s.listCollapsed })),
  // Changing scope always clears the filter: a sticky filter makes notes
  // look deleted.
  setScope: (scope) => set({ scope, filter: '' }),
  setFilter: (filter) => set({ filter }),
}))
```

- [ ] **Step 4: Write the layout CSS**

`frontend/src/components/layout/shell.module.css`:

```css
.app {
  height: 100dvh;                 /* never 100vh: mobile chrome collapses */
  display: grid;
  grid-template-rows: 52px 1fr 28px;
}

.panes {
  display: grid;
  grid-template-columns: 232px 300px 1fr;
  min-height: 0;
  transition: grid-template-columns 0.18s ease;
}

.app[data-nav-collapsed='true'] .panes { grid-template-columns: 0 300px 1fr; }
.app[data-list-collapsed='true'] .panes { grid-template-columns: 232px 0 1fr; }

.nav { border-right: 1px solid var(--mantine-color-default-border); overflow-y: auto; }
.list { border-right: 1px solid var(--mantine-color-default-border); display: flex;
        flex-direction: column; min-height: 0; }
.editor { display: flex; flex-direction: column; min-width: 0; min-height: 0; }

/* The scrim must never be a grid child, or it claims the 1fr row. */
.scrim { display: none; }

/* ---- Tablet 768–1099px: two panes, sidebar becomes a drawer ---- */
@media (max-width: 1099px) {
  .panes, .app[data-nav-collapsed='true'] .panes { grid-template-columns: 0 minmax(250px, 34%) 1fr; }

  .nav {
    position: fixed; left: 0; top: 52px; bottom: 28px; width: 232px; z-index: 30;
    background: var(--mantine-color-body);
    transform: translateX(-100%); transition: transform 0.2s ease;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .app[data-nav-open='true'] .nav { transform: none; }

  .scrim {
    display: block; position: fixed; inset: 52px 0 28px 0; z-index: 29;
    background: rgba(0, 0, 0, 0.4); opacity: 0; pointer-events: none;
    transition: opacity 0.2s ease;
  }
  .app[data-nav-open='true'] .scrim { opacity: 1; pointer-events: auto; }
}

/* ---- Phone ≤767px: one pane at a time ---- */
@media (max-width: 767px) {
  .panes { grid-template-columns: 1fr !important; }
  .nav, .list, .editor { display: none; }
  .nav { position: static; transform: none; border-right: 0; }
  .scrim { display: none; }

  .app[data-view='folders'] .nav { display: block; }
  .app[data-view='list'] .list { display: flex; }
  .app[data-view='editor'] .editor { display: flex; }
}

/* Touch devices of any size cannot use hover-only affordances. */
@media (hover: none) {
  .rowAction { opacity: 1 !important; }
}
```

- [ ] **Step 5: Write the shell**

`frontend/src/components/layout/AppShell.tsx`:

```tsx
import { useMediaQuery } from '@mantine/hooks'
import type { ReactNode } from 'react'

import { useUiStore } from '@/stores/uiStore'
import classes from './shell.module.css'

export function AppShellLayout({
  nav, list, editor, header, status,
}: {
  nav: ReactNode; list: ReactNode; editor: ReactNode; header: ReactNode; status: ReactNode
}) {
  const { view, navOpen, listCollapsed, closeNav } = useUiStore()

  return (
    <div
      className={classes.app}
      data-view={view}
      data-nav-open={navOpen}
      data-nav-collapsed={!navOpen}
      data-list-collapsed={listCollapsed}
    >
      {header}
      <div className={classes.panes}>
        <aside className={classes.nav}>{nav}</aside>
        <section className={classes.list}>{list}</section>
        <section className={classes.editor}>{editor}</section>
      </div>
      <div className={classes.scrim} onClick={closeNav} />
      {status}
    </div>
  )
}

export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 767px)') ?? false
}
```

- [ ] **Step 6: Write the header**

`frontend/src/components/layout/Header.tsx`:

```tsx
import { ActionIcon, Center, Group, Text, UnstyledButton, useMantineColorScheme } from '@mantine/core'
import {
  IconChevronLeft, IconMenu2, IconMoon, IconNotes, IconSearch, IconSun,
} from '@tabler/icons-react'
import { spotlight } from '@mantine/spotlight'

import { useIsPhone } from './AppShell'
import { AccountMenu } from './AccountMenu'
import { useUiStore } from '@/stores/uiStore'

export function Header() {
  const isPhone = useIsPhone()
  const { view, setView, toggleNav, scope } = useUiStore()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()

  return (
    <Group h={52} px="sm" gap="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
      {isPhone ? (
        <ActionIcon
          variant="subtle" size="lg" aria-label="Back"
          style={{ visibility: view === 'folders' ? 'hidden' : 'visible' }}
          onClick={() => setView(view === 'editor' ? 'list' : 'folders')}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
      ) : (
        // The sidebar toggle sits next to what it controls, at the far left.
        <ActionIcon variant="subtle" size="lg" aria-label="Toggle sidebar" onClick={toggleNav}>
          <IconMenu2 size={18} />
        </ActionIcon>
      )}

      {/* Brand mark: the favicon's shape, drawn with the icon set already
          installed. No image asset, so it stays crisp and follows the theme. */}
      <Group gap={8} visibleFrom="sm" wrap="nowrap">
        <Center w={26} h={26} bg="blue.6" style={{ borderRadius: 7, flex: 'none' }}>
          <IconNotes size={16} color="white" stroke={2} />
        </Center>
        <Text fw={600} size="sm">Notes</Text>
      </Group>
      {isPhone && <Text fw={600} size="md" truncate style={{ flex: 1 }}>{scope.label}</Text>}

      <UnstyledButton
        onClick={spotlight.open}
        style={{ flex: 1, maxWidth: 460 }}
        visibleFrom="sm"
        aria-label="Search notes and actions"
      >
        <Group gap="xs" px="sm" h={32} style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
        }}>
          <IconSearch size={15} opacity={0.6} />
          <Text size="sm" c="dimmed" style={{ flex: 1 }}>Search notes and actions…</Text>
          <Text size="xs" c="dimmed">⌘K</Text>
        </Group>
      </UnstyledButton>

      {isPhone && (
        <ActionIcon variant="subtle" size="lg" onClick={spotlight.open} aria-label="Search">
          <IconSearch size={18} />
        </ActionIcon>
      )}

      <Group gap={4} ml="auto">
        <ActionIcon variant="subtle" size="lg" onClick={toggleColorScheme} aria-label="Toggle colour scheme">
          {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
        <AccountMenu />
      </Group>
    </Group>
  )
}
```

- [ ] **Step 7: Run the tests**

```bash
npx vitest run src/stores/uiStore.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(frontend): responsive three-pane shell with phone stack and tablet drawer"
```

---

### Task F5: Bootstrap query, skeletons and delayed loading

**Files:**
- Create: `frontend/src/api/bootstrap.ts`, `frontend/src/hooks/queries/useBootstrap.ts`,
  `frontend/src/lib/useDelayedLoading.ts`, `frontend/src/components/common/Skeletons.tsx`,
  `frontend/src/components/common/TopProgress.tsx`
- Test: `frontend/src/lib/useDelayedLoading.test.tsx`

**Interfaces:**
- Produces:
  - `useBootstrap()` → `{user, folders, tags, counts, notes}` from one request.
  - `useDelayedLoading(isLoading: boolean, delayMs = 250): boolean` — true only once
    loading has lasted longer than the delay.
  - `<AppSkeleton />`, `<ListSkeleton />`, `<EditorSkeleton />`, `<TopProgress />`.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/useDelayedLoading.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDelayedLoading } from './useDelayedLoading'

describe('useDelayedLoading', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stays false for a fast request', () => {
    const { result, rerender } = renderHook(({ l }) => useDelayedLoading(l, 250), {
      initialProps: { l: true },
    })

    act(() => { vi.advanceTimersByTime(100) })
    rerender({ l: false })

    // A spinner that flashes for one frame reads as jank.
    expect(result.current).toBe(false)
  })

  it('becomes true once the delay elapses', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 250))

    act(() => { vi.advanceTimersByTime(300) })

    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/useDelayedLoading.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

`frontend/src/lib/useDelayedLoading.ts`:

```ts
import { useEffect, useState } from 'react'

/**
 * Most requests return in under 100ms. Showing a spinner for one frame makes a
 * fast app feel broken, so nothing is shown until loading outlasts `delayMs`.
 */
export function useDelayedLoading(isLoading: boolean, delayMs = 250): boolean {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setShow(false)
      return
    }

    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [isLoading, delayMs])

  return show
}
```

- [ ] **Step 4: Write the bootstrap API and hook**

`frontend/src/api/bootstrap.ts`:

```ts
import { api } from './client'
import type { Bootstrap } from '@/types/api'

export async function fetchBootstrap(): Promise<Bootstrap> {
  const { data } = await api.get<Bootstrap>('/bootstrap')
  return data
}
```

`frontend/src/hooks/queries/useBootstrap.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { fetchBootstrap } from '@/api/bootstrap'

export const BOOTSTRAP_KEY = ['bootstrap'] as const

export function useBootstrap() {
  const query = useQuery({ queryKey: BOOTSTRAP_KEY, queryFn: fetchBootstrap })

  return {
    ...query,
    user: query.data?.user.data ?? null,
    folders: query.data?.folders.data ?? [],
    tags: query.data?.tags.data ?? [],
    counts: query.data?.counts ?? null,
    initialNotes: query.data?.notes.data ?? [],
  }
}
```

- [ ] **Step 5: Write the skeletons**

`frontend/src/components/common/Skeletons.tsx`:

```tsx
import { Box, Group, Skeleton, Stack } from '@mantine/core'

/** The shape of the loaded app, so nothing jumps when data arrives. */
export function AppSkeleton() {
  return (
    <Box h="100dvh" style={{ display: 'grid', gridTemplateRows: '52px 1fr 28px' }}>
      <Group px="sm" h={52}><Skeleton h={24} w={120} /></Group>
      <Group align="stretch" gap={0}>
        <Stack p="sm" w={232} gap="xs" visibleFrom="md">
          <Skeleton h={34} /><Skeleton h={18} w="60%" mt="md" />
          <Skeleton h={18} /><Skeleton h={18} /><Skeleton h={18} />
        </Stack>
        <Box w={300} p="sm" visibleFrom="sm"><ListSkeleton /></Box>
        <Box style={{ flex: 1 }} p="xl"><EditorSkeleton /></Box>
      </Group>
      <Box />
    </Box>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Stack gap="md">
      {Array.from({ length: rows }, (_, i) => (
        <Stack key={i} gap={6}>
          <Skeleton h={12} w="55%" /><Skeleton h={9} w="85%" /><Skeleton h={8} w="30%" />
        </Stack>
      ))}
    </Stack>
  )
}

export function EditorSkeleton() {
  return (
    <Stack gap="md">
      <Skeleton h={26} w="45%" />
      <Skeleton h={11} /><Skeleton h={11} /><Skeleton h={11} w="80%" />
    </Stack>
  )
}
```

`frontend/src/components/common/TopProgress.tsx`:

```tsx
import { Box } from '@mantine/core'
import { useIsFetching } from '@tanstack/react-query'
import { useDelayedLoading } from '@/lib/useDelayedLoading'

/** Catch-all indicator for fetches with no better home. Never blocks. */
export function TopProgress() {
  const show = useDelayedLoading(useIsFetching() > 0)
  if (!show) return null

  return (
    <Box
      pos="fixed" top={0} left={0} right={0} h={2} bg="blue.5"
      style={{ zIndex: 1000, animation: 'pulse 1s ease-in-out infinite' }}
    />
  )
}
```

- [ ] **Step 6: Run the test**

```bash
npx vitest run src/lib/useDelayedLoading.test.tsx
```
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(frontend): bootstrap query, layout skeletons and delayed loading"
```

---

### Task F6: Sidebar

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`,
  `frontend/src/api/folders.ts`, `frontend/src/api/tags.ts`,
  `frontend/src/hooks/queries/useFolders.ts`, `frontend/src/hooks/queries/useTags.ts`
- Test: `frontend/src/hooks/queries/useFolders.test.tsx`

**Interfaces:**
- Produces: the sidebar — New note, All notes / Recent / Starred with counts, a folder
  tree with `＋` create and a `⋯` menu (New subfolder · Rename · **Delete folder**),
  tag chips with `＋` create and right-click (**Rename · Delete** only), and Trash.
- `useCreateFolder()`, `useRenameFolder()`, `useDeleteFolder()`, `useCreateTag()`,
  `useRenameTag()`, `useDeleteTag()` — all invalidate `BOOTSTRAP_KEY`.

- [ ] **Step 1: Write the API functions**

`frontend/src/api/folders.ts`:

```ts
import { api } from './client'
import type { Folder, UUID } from '@/types/api'

export async function createFolder(payload: { name: string; parent_uuid?: UUID }): Promise<Folder> {
  const { data } = await api.post<{ data: Folder }>('/folders', payload)
  return data.data
}

export async function renameFolder(uuid: UUID, name: string): Promise<Folder> {
  const { data } = await api.patch<{ data: Folder }>(`/folders/${uuid}`, { name })
  return data.data
}

export async function deleteFolder(uuid: UUID): Promise<void> {
  await api.delete(`/folders/${uuid}`)
}
```

`frontend/src/api/tags.ts` — the same three functions against `/tags`.

- [ ] **Step 2: Write the failing test**

`frontend/src/hooks/queries/useFolders.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/api/client'
import { BOOTSTRAP_KEY } from './useBootstrap'
import { useCreateFolder } from './useFolders'

describe('useCreateFolder', () => {
  it('invalidates the bootstrap cache so the counts refresh', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'invalidateQueries')
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { data: { uuid: 'f1', name: 'Work' } } } as never)

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useCreateFolder(), { wrapper })
    result.current.mutate({ name: 'Work' })

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: BOOTSTRAP_KEY }))
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run src/hooks/queries/useFolders.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 4: Write the hooks**

`frontend/src/hooks/queries/useFolders.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'

import * as foldersApi from '@/api/folders'
import { BOOTSTRAP_KEY } from './useBootstrap'
import { NOTES_KEY } from './useNotes'

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: foldersApi.createFolder,
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useRenameFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) =>
      foldersApi.renameFolder(uuid, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: foldersApi.deleteFolder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      // Destructive actions must say what SURVIVES, not just what went.
      notifications.show({
        message: 'Folder deleted. Its notes moved to All notes — nothing was deleted.',
      })
    },
  })
}
```

`frontend/src/hooks/queries/useTags.ts` — the same three hooks for tags, whose delete
notification reads `Tag deleted. It was removed from your notes — the notes stay.`

- [ ] **Step 5: Write the sidebar**

`frontend/src/components/layout/Sidebar.tsx`:

```tsx
import { ActionIcon, Badge, Button, Group, Menu, NavLink, Stack, Text, TextInput } from '@mantine/core'
import {
  IconClock, IconDots, IconFolder, IconNote, IconPlus, IconStar, IconTrash,
} from '@tabler/icons-react'
import { useState } from 'react'

import { useBootstrap } from '@/hooks/queries/useBootstrap'
import { useCreateFolder, useDeleteFolder, useRenameFolder } from '@/hooks/queries/useFolders'
import { useCreateTag, useDeleteTag } from '@/hooks/queries/useTags'
import { useCreateNote } from '@/hooks/queries/useNotes'
import { useUiStore } from '@/stores/uiStore'
import { useIsPhone } from './AppShell'

export function Sidebar() {
  const { folders, tags, counts } = useBootstrap()
  const { scope, setScope, setView, closeNav } = useUiStore()
  const isPhone = useIsPhone()

  const createFolder = useCreateFolder()
  const renameFolder = useRenameFolder()
  const deleteFolder = useDeleteFolder()
  const createTag = useCreateTag()
  const deleteTag = useDeleteTag()
  const createNote = useCreateNote()

  // Inline create, not a modal: naming a folder is one field.
  const [creating, setCreating] = useState<'folder' | 'tag' | null>(null)
  const [draftName, setDraftName] = useState('')

  function pick(next: Parameters<typeof setScope>[0]) {
    setScope(next)
    closeNav()
    if (isPhone) setView('list')
  }

  function commitInline() {
    const name = draftName.trim()
    if (name) {
      creating === 'folder' ? createFolder.mutate({ name }) : createTag.mutate({ name })
    }
    setCreating(null)
    setDraftName('')
  }

  return (
    <Stack p="xs" gap={2} h="100%">
      <Button
        leftSection={<IconPlus size={16} />}
        loading={createNote.isPending}
        onClick={() => createNote.mutate({})}
      >
        New note
      </Button>

      <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="md" px="xs">Library</Text>
      <NavLink
        label="All notes" leftSection={<IconNote size={16} />}
        rightSection={<Text size="xs" c="dimmed">{counts?.all ?? 0}</Text>}
        active={scope.kind === 'all'}
        onClick={() => pick({ kind: 'all', label: 'All notes' })}
      />
      <NavLink
        label="Starred" leftSection={<IconStar size={16} />}
        rightSection={<Text size="xs" c="dimmed">{counts?.starred ?? 0}</Text>}
        active={scope.kind === 'starred'}
        onClick={() => pick({ kind: 'starred', label: 'Starred' })}
      />

      <Group justify="space-between" mt="md" px="xs">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Folders</Text>
        <ActionIcon size="sm" variant="subtle" aria-label="New folder"
          onClick={() => { setCreating('folder'); setDraftName('') }}>
          <IconPlus size={14} />
        </ActionIcon>
      </Group>

      {creating === 'folder' && (
        <TextInput
          autoFocus size="xs" placeholder="Folder name" value={draftName}
          onChange={(e) => setDraftName(e.currentTarget.value)}
          onBlur={commitInline}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitInline()
            if (e.key === 'Escape') setCreating(null)
          }}
        />
      )}

      {folders.map((f) => (
        <NavLink
          key={f.uuid} label={f.name} leftSection={<IconFolder size={16} />}
          active={scope.kind === 'folder' && scope.uuid === f.uuid}
          onClick={() => pick({ kind: 'folder', uuid: f.uuid, label: f.name })}
          rightSection={
            <Group gap={4} wrap="nowrap">
              <Text size="xs" c="dimmed">{counts?.folders[f.uuid] ?? 0}</Text>
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon size="sm" variant="subtle" aria-label="Folder actions"
                    onClick={(e) => e.stopPropagation()}>
                    <IconDots size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => {
                    const name = window.prompt('Rename folder', f.name)
                    if (name) renameFolder.mutate({ uuid: f.uuid, name })
                  }}>Rename</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={() => deleteFolder.mutate(f.uuid)}>
                    Delete folder
                  </Menu.Item>
                  <Text size="xs" c="dimmed" px="sm" pb="xs">
                    Notes inside move to All notes — nothing is deleted.
                  </Text>
                </Menu.Dropdown>
              </Menu>
            </Group>
          }
        />
      ))}

      <Group justify="space-between" mt="md" px="xs">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Tags</Text>
        <ActionIcon size="sm" variant="subtle" aria-label="New tag"
          onClick={() => { setCreating('tag'); setDraftName('') }}>
          <IconPlus size={14} />
        </ActionIcon>
      </Group>

      {creating === 'tag' && (
        <TextInput
          autoFocus size="xs" placeholder="Tag name" value={draftName}
          onChange={(e) => setDraftName(e.currentTarget.value)}
          onBlur={commitInline}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitInline()
            if (e.key === 'Escape') setCreating(null)
          }}
        />
      )}

      <Group gap={5} px="xs" wrap="wrap">
        {tags.map((t) => (
          <Menu key={t.uuid} position="bottom-start" withinPortal trigger="click">
            <Menu.Target>
              <Badge
                variant="light" style={{ cursor: 'pointer' }}
                onClick={() => pick({ kind: 'tag', slug: t.slug, label: `#${t.name}` })}
                onContextMenu={(e) => e.preventDefault()}
              >
                #{t.name} {counts?.tags[t.slug] ?? 0}
              </Badge>
            </Menu.Target>
            <Menu.Dropdown>
              {/* Tag menu is exactly two items. */}
              <Menu.Item>Rename</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" onClick={() => deleteTag.mutate(t.uuid)}>Delete tag</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ))}
      </Group>

      <NavLink
        mt="auto" label="Trash" leftSection={<IconTrash size={16} />}
        rightSection={<Text size="xs" c="dimmed">{counts?.trashed ?? 0}</Text>}
        active={scope.kind === 'trash'}
        onClick={() => pick({ kind: 'trash', label: 'Trash' })}
      />
    </Stack>
  )
}
```

- [ ] **Step 6: Run the test**

```bash
npx vitest run src/hooks/queries/useFolders.test.tsx
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(frontend): sidebar with folder tree, tags, counts and inline create"
```

---

### Task F7: Note list and the hybrid filter

**Files:**
- Create: `frontend/src/api/notes.ts`, `frontend/src/hooks/queries/useNotes.ts`,
  `frontend/src/components/notes/NoteList.tsx`,
  `frontend/src/components/notes/NoteRow.tsx`,
  `frontend/src/components/notes/FilterInput.tsx`,
  `frontend/src/lib/filterNotes.ts`
- Test: `frontend/src/lib/filterNotes.test.ts`

**Interfaces:**
- Produces:
  - `useNotes(scope)` — infinite query over `GET /notes`, keyed by scope.
  - `useCreateNote()`, `useStarNote()`, `useTrashNote()`, `useRestoreNote()`,
    `useForceDeleteNote()`, `useDuplicateNote()` — all **optimistic**, rolling back with
    a toast on failure.
  - `filterNotes(notes, q): NoteListItem[]` — case-insensitive match on title and
    excerpt.
  - `<FilterInput>` — instant local filter; a background scoped request when the scope
    has more pages, with an inline spinner and then a `4 of 24` count.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/filterNotes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { filterNotes } from './filterNotes'
import type { NoteListItem } from '@/types/api'

const note = (title: string, excerpt = ''): NoteListItem => ({
  uuid: title, title, excerpt, is_starred: false, folder: null, tags: [],
  updated_at: '2026-10-09T00:00:00Z', deleted_at: null,
})

describe('filterNotes', () => {
  const notes = [note('Release plan', 'ship r34'), note('Groceries', 'milk and eggs')]

  it('matches the title case-insensitively', () => {
    expect(filterNotes(notes, 'RELE')).toHaveLength(1)
  })

  it('matches the excerpt', () => {
    expect(filterNotes(notes, 'milk')[0]?.title).toBe('Groceries')
  })

  it('returns everything for an empty query', () => {
    expect(filterNotes(notes, '  ')).toHaveLength(2)
  })

  it('returns nothing when there is no match', () => {
    expect(filterNotes(notes, 'zzz')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/filterNotes.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the filter**

`frontend/src/lib/filterNotes.ts`:

```ts
import type { NoteListItem } from '@/types/api'

export function filterNotes(notes: NoteListItem[], q: string): NoteListItem[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return notes

  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(needle) || n.excerpt.toLowerCase().includes(needle),
  )
}
```

- [ ] **Step 4: Write the notes API**

`frontend/src/api/notes.ts`:

```ts
import { api } from './client'
import type { Note, NoteListItem, ProseMirrorDoc, UUID } from '@/types/api'

export interface NotesPage {
  data: NoteListItem[]
  meta: { next_cursor: string | null }
}

export async function fetchNotes(params: Record<string, string | undefined>): Promise<NotesPage> {
  const { data } = await api.get<NotesPage>('/notes', { params })
  return data
}

export async function fetchNote(uuid: UUID): Promise<Note> {
  const { data } = await api.get<{ data: Note }>(`/notes/${uuid}`)
  return data.data
}

export async function createNote(payload: { folder_id?: UUID }): Promise<Note> {
  const { data } = await api.post<{ data: Note }>('/notes', payload)
  return data.data
}

export async function patchNote(
  uuid: UUID,
  payload: Partial<{ body: ProseMirrorDoc; version: number; title: string; folder_id: UUID | null; is_starred: boolean }>,
): Promise<Note> {
  const { data } = await api.patch<{ data: Note }>(`/notes/${uuid}`, payload)
  return data.data
}

export async function syncNoteTags(uuid: UUID, names: string[]): Promise<Note> {
  const { data } = await api.put<{ data: Note }>(`/notes/${uuid}/tags`, { names })
  return data.data
}

export async function trashNote(uuid: UUID): Promise<void> { await api.delete(`/notes/${uuid}`) }
export async function restoreNote(uuid: UUID): Promise<void> { await api.post(`/notes/${uuid}/restore`) }
export async function forceDeleteNote(uuid: UUID): Promise<void> {
  await api.delete(`/notes/${uuid}`, { params: { force: 1 } })
}
export async function duplicateNote(uuid: UUID): Promise<Note> {
  const { data } = await api.post<{ data: Note }>(`/notes/${uuid}/duplicate`)
  return data.data
}
```

- [ ] **Step 5: Write the note hooks**

`frontend/src/hooks/queries/useNotes.ts`:

```ts
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'

import * as notesApi from '@/api/notes'
import { BOOTSTRAP_KEY } from './useBootstrap'
import type { Scope } from '@/stores/uiStore'
import type { NoteListItem } from '@/types/api'

export const NOTES_KEY = ['notes'] as const

function scopeParams(scope: Scope): Record<string, string | undefined> {
  switch (scope.kind) {
    case 'folder': return { folder_id: scope.uuid }
    case 'tag': return { tag: scope.slug }
    case 'starred': return { starred: '1' }
    case 'trash': return { trashed: '1' }
    case 'search': return { q: scope.q }
    default: return {}
  }
}

export function useNotes(scope: Scope) {
  return useInfiniteQuery({
    queryKey: [...NOTES_KEY, scope],
    queryFn: ({ pageParam }) =>
      notesApi.fetchNotes({ ...scopeParams(scope), cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  })
}

/** Optimistic star: waiting on a round-trip to see a star fill feels slow. */
export function useStarNote(scope: Scope) {
  const qc = useQueryClient()
  const key = [...NOTES_KEY, scope]

  return useMutation({
    mutationFn: ({ uuid, is_starred }: { uuid: string; is_starred: boolean }) =>
      notesApi.patchNote(uuid, { is_starred }),
    onMutate: async ({ uuid, is_starred }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData(key)

      qc.setQueryData(key, (old: { pages: notesApi.NotesPage[] } | undefined) =>
        old && {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.map((n: NoteListItem) => (n.uuid === uuid ? { ...n, is_starred } : n)),
          })),
        })

      return { previous }
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      notifications.show({ color: 'red', message: "Couldn't update that note." })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.createNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useTrashNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.trashNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      notifications.show({ message: 'Moved to Trash' })
    },
  })
}

export function useRestoreNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.restoreNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}

export function useForceDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.forceDeleteNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    },
  })
}
```

- [ ] **Step 6: Write the filter input**

`frontend/src/components/notes/FilterInput.tsx`:

```tsx
import { Loader, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconFilter } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { fetchNotes } from '@/api/notes'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useUiStore } from '@/stores/uiStore'

/**
 * Hybrid filter. Loaded rows are filtered instantly with no loader; if the scope
 * has further pages, a scoped server query tops up the results. Filtering only
 * the loaded page would silently miss notes and make them look deleted.
 */
export function FilterInput({
  hasMore, localCount, totalCount, params,
}: {
  hasMore: boolean; localCount: number; totalCount: number
  params: Record<string, string | undefined>
}) {
  const { filter, setFilter, scope } = useUiStore()
  const [debounced] = useDebouncedValue(filter, 250)

  const server = useQuery({
    queryKey: ['notes-filter', scope, debounced],
    queryFn: () => fetchNotes({ ...params, q: debounced }),
    enabled: hasMore && debounced.trim().length > 0,
  })

  const showSpinner = useDelayedLoading(server.isFetching)

  return (
    <TextInput
      value={filter}
      onChange={(e) => setFilter(e.currentTarget.value)}
      // Naming the scope is what stops this reading as a second search box.
      placeholder={`Filter in ${scope.label}`}
      leftSection={<IconFilter size={15} />}
      rightSection={
        showSpinner ? <Loader size={14} />
          : filter ? <Text size="xs" c="dimmed">{localCount} of {totalCount}</Text>
          : null
      }
      rightSectionWidth={filter ? 64 : 36}
    />
  )
}
```

- [ ] **Step 7: Write the row and the list**

`frontend/src/components/notes/NoteRow.tsx`:

```tsx
import { ActionIcon, Badge, Group, Menu, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconDots, IconStar, IconStarFilled } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import type { NoteListItem } from '@/types/api'
import classes from '../layout/shell.module.css'

dayjs.extend(relativeTime)

export function NoteRow({
  note, active, onOpen, onStar, onTrash, onDuplicate,
}: {
  note: NoteListItem; active: boolean
  onOpen: () => void; onStar: () => void; onTrash: () => void; onDuplicate: () => void
}) {
  return (
    <UnstyledButton
      onClick={onOpen}
      p="xs"
      style={{
        display: 'block', width: '100%', borderRadius: 'var(--mantine-radius-md)',
        borderLeft: `3px solid ${active ? 'var(--mantine-color-blue-6)' : 'transparent'}`,
        background: active ? 'var(--mantine-color-blue-light)' : undefined,
        minHeight: 44,
      }}
    >
      <Stack gap={3}>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
            {note.title || 'New note'}
          </Text>

          <ActionIcon
            component="div" size="sm" variant="subtle" aria-label={note.is_starred ? 'Unstar' : 'Star'}
            className={classes.rowAction}
            style={{ opacity: note.is_starred ? 1 : 0 }}
            onClick={(e) => { e.stopPropagation(); onStar() }}
          >
            {note.is_starred ? <IconStarFilled size={14} color="var(--mantine-color-yellow-6)" />
              : <IconStar size={14} />}
          </ActionIcon>

          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                component="div" size="sm" variant="subtle" aria-label="Note actions"
                className={classes.rowAction} style={{ opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={onStar}>{note.is_starred ? 'Unstar' : 'Star'}</Menu.Item>
              <Menu.Item onClick={onDuplicate}>Duplicate</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" onClick={onTrash}>Move to trash</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Text size="xs" c="dimmed" truncate>{note.excerpt}</Text>

        <Group gap={6}>
          <Text size="xs" c="dimmed">{dayjs(note.updated_at).fromNow()}</Text>
          {note.folder && <Badge size="xs" variant="light">{note.folder.name}</Badge>}
        </Group>
      </Stack>
    </UnstyledButton>
  )
}
```

`frontend/src/components/notes/NoteList.tsx` composes the header (scope label, count,
sort `Menu` with Date updated / Date created / Title A–Z and the Group-by-date and
Show-snippets toggles), `<FilterInput>`, and the rows — rendering `<ListSkeleton />`
while `useNotes` is loading and an empty state offering **New note** when there are none.

- [ ] **Step 8: Run the tests**

```bash
npx vitest run src/lib/filterNotes.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(frontend): note list with optimistic star and hybrid scoped filter"
```

---

### Task F8: Editor tabs

**Files:**
- Create: `frontend/src/stores/tabsStore.ts`,
  `frontend/src/components/editor/TabBar.tsx`
- Test: `frontend/src/stores/tabsStore.test.ts`

**Interfaces:**
- Produces: `useTabsStore` — `{tabs: Tab[], activeUuid, open(uuid, title), close(uuid),
  closeOthers(uuid), closeAll(), reopen(), setDirty(uuid, dirty), setTitle(uuid, title)}`.
  `Tab = {uuid, title, dirty}`.
  **Persisted to `localStorage`, per device.** Tabs are window state, not user data —
  syncing them across devices would be wrong, and there is no endpoint.

- [ ] **Step 1: Write the failing test**

`frontend/src/stores/tabsStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useTabsStore } from './tabsStore'

describe('tabsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useTabsStore.setState({ tabs: [], activeUuid: null, closed: [] })
  })

  it('opens a tab and makes it active', () => {
    useTabsStore.getState().open('n1', 'Release plan')

    expect(useTabsStore.getState().tabs).toHaveLength(1)
    expect(useTabsStore.getState().activeUuid).toBe('n1')
  })

  it('does not open the same note twice', () => {
    useTabsStore.getState().open('n1', 'A')
    useTabsStore.getState().open('n1', 'A')

    expect(useTabsStore.getState().tabs).toHaveLength(1)
  })

  it('activates the neighbour when the active tab closes', () => {
    useTabsStore.getState().open('n1', 'A')
    useTabsStore.getState().open('n2', 'B')
    useTabsStore.getState().close('n2')

    expect(useTabsStore.getState().activeUuid).toBe('n1')
  })

  it('reopens the most recently closed tab', () => {
    useTabsStore.getState().open('n1', 'A')
    useTabsStore.getState().close('n1')
    useTabsStore.getState().reopen()

    expect(useTabsStore.getState().tabs.map((t) => t.uuid)).toEqual(['n1'])
  })

  it('tracks the dirty flag per tab', () => {
    useTabsStore.getState().open('n1', 'A')
    useTabsStore.getState().setDirty('n1', true)

    expect(useTabsStore.getState().tabs[0]?.dirty).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/stores/tabsStore.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the store**

`frontend/src/stores/tabsStore.ts`:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UUID } from '@/types/api'

export interface Tab { uuid: UUID; title: string; dirty: boolean }

interface TabsState {
  tabs: Tab[]
  activeUuid: UUID | null
  closed: Tab[]
  open: (uuid: UUID, title: string) => void
  close: (uuid: UUID) => void
  closeOthers: (uuid: UUID) => void
  closeAll: () => void
  reopen: () => void
  setDirty: (uuid: UUID, dirty: boolean) => void
  setTitle: (uuid: UUID, title: string) => void
  activate: (uuid: UUID) => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeUuid: null,
      closed: [],

      open: (uuid, title) => {
        const { tabs } = get()
        if (tabs.some((t) => t.uuid === uuid)) {
          set({ activeUuid: uuid })
          return
        }
        set({ tabs: [...tabs, { uuid, title, dirty: false }], activeUuid: uuid })
      },

      close: (uuid) => {
        const { tabs, activeUuid, closed } = get()
        const index = tabs.findIndex((t) => t.uuid === uuid)
        if (index === -1) return

        const removed = tabs[index]!
        const next = tabs.filter((t) => t.uuid !== uuid)
        const neighbour = next[index - 1] ?? next[index] ?? null

        set({
          tabs: next,
          activeUuid: activeUuid === uuid ? neighbour?.uuid ?? null : activeUuid,
          closed: [...closed, removed].slice(-10),
        })
      },

      closeOthers: (uuid) =>
        set((s) => ({ tabs: s.tabs.filter((t) => t.uuid === uuid), activeUuid: uuid })),

      closeAll: () => set({ tabs: [], activeUuid: null }),

      reopen: () => {
        const { closed } = get()
        const last = closed[closed.length - 1]
        if (!last) return
        set({ closed: closed.slice(0, -1) })
        get().open(last.uuid, last.title)
      },

      setDirty: (uuid, dirty) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.uuid === uuid ? { ...t, dirty } : t)) })),

      setTitle: (uuid, title) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.uuid === uuid ? { ...t, title } : t)) })),

      activate: (uuid) => set({ activeUuid: uuid }),
    }),
    // Per device, never synced: tabs are window state, not user data.
    { name: 'notes.tabs' },
  ),
)
```

- [ ] **Step 4: Write the tab bar**

`frontend/src/components/editor/TabBar.tsx` renders a horizontally scrollable row of
tabs, each with an amber dot when `dirty`, a close `×` on hover, a right-click `Menu`
(Close ⌘W · Close others · Close all · Reopen closed tab ⌘⇧T), and a trailing `＋`.
It renders `null` when `useIsPhone()` is true — tabs are a mouse metaphor and eight of
them do not fit on a 390px screen.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/stores/tabsStore.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(frontend): editor tabs persisted per device"
```

---

### Task F9: The editor — full TipTap control set

**Files:**
- Create: `frontend/src/components/editor/extensions.ts`,
  `frontend/src/components/editor/Editor.tsx`,
  `frontend/src/components/editor/EditorToolbar.tsx`,
  `frontend/src/components/editor/TableBar.tsx`,
  `frontend/src/components/editor/TagStrip.tsx`
- Test: `frontend/src/components/editor/extensions.test.ts`

**Interfaces:**
- Produces: `editorExtensions` — the full MIT extension list; `<Editor note>` rendering
  a `RichTextEditor` with the toolbar, a contextual table bar, a tag strip above the
  title and a `BubbleMenu` on non-phone widths.

- [ ] **Step 1: Install the extensions**

```bash
cd frontend
npm install @tiptap/react@3.31.4 @tiptap/starter-kit@3.31.4 \
  @tiptap/extension-highlight@3.31.4 @tiptap/extension-text-style@3.31.4 \
  @tiptap/extension-color@3.31.4 @tiptap/extension-subscript@3.31.4 \
  @tiptap/extension-superscript@3.31.4 @tiptap/extension-text-align@3.31.4 \
  @tiptap/extension-task-list@3.31.4 @tiptap/extension-task-item@3.31.4 \
  @tiptap/extension-table@3.31.4 @tiptap/extension-image@3.31.4 \
  @tiptap/extension-link@3.31.4 @tiptap/extension-underline@3.31.4 \
  @tiptap/extension-placeholder@3.31.4 @tiptap/extension-character-count@3.31.4 \
  @tiptap/extension-details@3.31.4 @tiptap/extension-invisible-characters@3.31.4 \
  @tiptap/extension-code-block-lowlight@3.31.4 @tiptap/extension-typography@3.31.4 \
  lowlight@3.3.0
```

- [ ] **Step 2: Write the failing test**

`frontend/src/components/editor/extensions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { editorExtensions } from './extensions'

describe('editorExtensions', () => {
  it('includes every control the toolbar exposes', () => {
    const names = editorExtensions.map((e) => e.name)

    for (const required of [
      'highlight', 'textStyle', 'color', 'subscript', 'superscript', 'textAlign',
      'taskList', 'taskItem', 'table', 'image', 'link', 'underline',
      'details', 'invisibleCharacters', 'characterCount',
    ]) {
      expect(names).toContain(required)
    }
  })

  it('disables merged table cells, which GFM export cannot represent', () => {
    const table = editorExtensions.find((e) => e.name === 'table')
    expect(table?.options?.allowTableNodeSelection).toBe(false)
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run src/components/editor/extensions.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Write the extension list**

`frontend/src/components/editor/extensions.ts`:

```ts
import CharacterCount from '@tiptap/extension-character-count'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Color from '@tiptap/extension-color'
import Details from '@tiptap/extension-details'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import InvisibleCharacters from '@tiptap/extension-invisible-characters'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'

/**
 * Every extension here is MIT. Do not add @tiptap-pro/* — the project has no
 * TipTap Pro licence, and nothing in Phase 1 needs one.
 */
export const editorExtensions = [
  StarterKit.configure({ codeBlock: false }),
  Underline,
  Link.configure({ openOnClick: false, autolink: true }),
  Highlight,
  TextStyle,
  Color,
  Subscript,
  Superscript,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  // Merged cells cannot be represented if a markdown export is ever added,
  // and node selection is what exposes merging in the UI.
  Table.configure({ resizable: true, allowTableNodeSelection: false }),
  TableRow,
  TableHeader,
  TableCell,
  Image,
  Details,
  InvisibleCharacters.configure({ visible: false }),
  CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
  Typography,
  CharacterCount,
  Placeholder.configure({ placeholder: 'Start writing…' }),
]
```

- [ ] **Step 5: Write the toolbar**

`frontend/src/components/editor/EditorToolbar.tsx`:

```tsx
import { RichTextEditor, useRichTextEditorContext } from '@mantine/tiptap'
import { ColorPicker, Popover, SegmentedControl } from '@mantine/core'
import { IconTable } from '@tabler/icons-react'

import { useIsPhone } from '../layout/AppShell'

export function EditorToolbar({ mode, onMode }: { mode: 'rich' | 'source'; onMode: (m: 'rich' | 'source') => void }) {
  const { editor } = useRichTextEditorContext()
  const isPhone = useIsPhone()

  return (
    <RichTextEditor.Toolbar sticky stickyOffset={0}>
      <RichTextEditor.ControlsGroup>
        <RichTextEditor.Bold /><RichTextEditor.Italic /><RichTextEditor.Underline />
        <RichTextEditor.Strikethrough /><RichTextEditor.ClearFormatting />
        <RichTextEditor.Highlight /><RichTextEditor.Code />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.H1 /><RichTextEditor.H2 />
        <RichTextEditor.H3 /><RichTextEditor.H4 />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.ColorPicker
          colors={['#212529', '#fa5252', '#e8590c', '#f08c00', '#2f9e44',
                   '#12b886', '#1971c2', '#4dabf7', '#7950f2', '#e64980']}
        />
        <RichTextEditor.UnsetColor />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.BulletList /><RichTextEditor.OrderedList />
        <RichTextEditor.TaskList /><RichTextEditor.Blockquote />
        <RichTextEditor.Subscript /><RichTextEditor.Superscript />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.Link /><RichTextEditor.Unlink />
        <RichTextEditor.CodeBlock /><RichTextEditor.Hr />
        <RichTextEditor.Control
          aria-label="Insert table" title="Insert table"
          onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <IconTable size={16} />
        </RichTextEditor.Control>
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.AlignLeft /><RichTextEditor.AlignCenter />
        <RichTextEditor.AlignRight /><RichTextEditor.AlignJustify />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.Undo /><RichTextEditor.Redo />
      </RichTextEditor.ControlsGroup>

      {!isPhone && (
        <SegmentedControl
          ml="auto" size="xs" value={mode}
          onChange={(v) => onMode(v as 'rich' | 'source')}
          data={[{ label: 'Rich text', value: 'rich' }, { label: 'Source', value: 'source' }]}
        />
      )}
    </RichTextEditor.Toolbar>
  )
}
```

- [ ] **Step 6: Write the contextual table bar**

`frontend/src/components/editor/TableBar.tsx`:

```tsx
import { Button, Group, Text } from '@mantine/core'
import type { Editor } from '@tiptap/react'

/**
 * Only rendered while the cursor is inside a table. Eleven more buttons in the
 * permanent toolbar would make it unusable.
 */
export function TableBar({ editor }: { editor: Editor | null }) {
  if (!editor?.isActive('table')) return null

  const chain = () => editor.chain().focus()

  return (
    <Group gap="xs" p={6} bg="var(--mantine-color-blue-light)" wrap="wrap">
      <Text size="xs" fw={700} tt="uppercase" c="blue">Table</Text>

      <Button.Group>
        <Button size="compact-xs" variant="default" onClick={() => chain().addColumnBefore().run()}>+ Col ←</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().addColumnAfter().run()}>+ Col →</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().deleteColumn().run()}>− Col</Button>
      </Button.Group>

      <Button.Group>
        <Button size="compact-xs" variant="default" onClick={() => chain().addRowBefore().run()}>+ Row ↑</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().addRowAfter().run()}>+ Row ↓</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().deleteRow().run()}>− Row</Button>
      </Button.Group>

      <Button.Group>
        <Button size="compact-xs" variant="default" onClick={() => chain().toggleHeaderRow().run()}>Header row</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().toggleHeaderColumn().run()}>Header col</Button>
      </Button.Group>

      <Button size="compact-xs" variant="default" color="red" onClick={() => chain().deleteTable().run()}>
        Delete table
      </Button>
    </Group>
  )
}
```

- [ ] **Step 7: Write the editor**

`frontend/src/components/editor/Editor.tsx`:

```tsx
import { RichTextEditor } from '@mantine/tiptap'
import { Box } from '@mantine/core'
import { BubbleMenu, useEditor } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { useIsPhone } from '../layout/AppShell'
import { EditorToolbar } from './EditorToolbar'
import { TableBar } from './TableBar'
import { TagStrip } from './TagStrip'
import { editorExtensions } from './extensions'
import { useAutosave } from '@/hooks/useAutosave'
import type { Note } from '@/types/api'

export function Editor({ note }: { note: Note }) {
  const isPhone = useIsPhone()
  const [mode, setMode] = useState<'rich' | 'source'>('rich')

  const editor = useEditor(
    {
      extensions: editorExtensions,
      content: note.body ?? { type: 'doc', content: [] },
      // ProseMirror's schema is a strict whitelist; anything unrecognised is dropped.
      editorProps: { attributes: { 'aria-label': 'Note body' } },
    },
    [note.uuid],
  )

  const { onChange } = useAutosave(note, editor)

  useEffect(() => {
    if (!editor) return
    editor.on('update', onChange)
    return () => { editor.off('update', onChange) }
  }, [editor, onChange])

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <RichTextEditor editor={editor} style={{ display: 'contents' }}>
        <EditorToolbar mode={mode} onMode={setMode} />
        <TableBar editor={editor} />

        {/* The bubble menu collides with iOS selection handles. */}
        {!isPhone && editor && (
          <BubbleMenu editor={editor}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold /><RichTextEditor.Italic />
              <RichTextEditor.Strikethrough /><RichTextEditor.Link />
              <RichTextEditor.H2 />
            </RichTextEditor.ControlsGroup>
          </BubbleMenu>
        )}

        <Box style={{ overflowY: 'auto', minHeight: 0, flex: 1 }} px={{ base: 16, sm: 28, lg: 48 }} py="lg">
          <TagStrip note={note} />
          {/* Full width: no max-width column. */}
          <RichTextEditor.Content />
        </Box>
      </RichTextEditor>
    </Box>
  )
}
```

`frontend/src/components/editor/TagStrip.tsx` renders the note's tags as `Badge`s plus a
dashed `＋ Add tag` button opening a `Popover` with a search field, the matching tags
with ticks, and a `Create #<term>` row; selecting any of them calls
`syncNoteTags(note.uuid, names)` with the full resulting array.

- [ ] **Step 8: Run the tests**

```bash
npx vitest run src/components/editor/extensions.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(frontend): TipTap editor with the full Mantine control set and contextual table bar"
```

---

### Task F10: Autosave, drafts and conflict resolution

**Files:**
- Create: `frontend/src/hooks/useAutosave.ts`, `frontend/src/lib/drafts.ts`,
  `frontend/src/components/common/ConflictSheet.tsx`,
  `frontend/src/components/layout/StatusBar.tsx`
- Test: `frontend/src/hooks/useAutosave.test.tsx`, `frontend/src/lib/drafts.test.ts`

**Interfaces:**
- Produces:
  - `useAutosave(note, editor)` → `{status: 'idle'|'saving'|'saved'|'error', onChange,
    saveNow}`.
  - `saveDraft(uuid, doc)`, `loadDraft(uuid)`, `clearDraft(uuid)` over IndexedDB.
  - `<ConflictSheet>` — Keep mine / Keep theirs / Save mine as a copy.
  - `<StatusBar>` — `Saved · 2 min ago`, `Saving…`, `Couldn't save · retrying in 4s`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/hooks/useAutosave.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as notesApi from '@/api/notes'
import { useAutosave } from './useAutosave'
import type { Note } from '@/types/api'

const note: Note = {
  uuid: 'n1', title: 'T', excerpt: '', is_starred: false, folder: null, tags: [],
  updated_at: '2026-10-09T00:00:00Z', deleted_at: null,
  body: { type: 'doc', content: [] }, version: 3, word_count: 0, title_locked: false,
}

const editor = { getJSON: () => ({ type: 'doc', content: [{ type: 'paragraph' }] }) } as never

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('debounces by 800ms rather than saving per keystroke', async () => {
    const patch = vi.spyOn(notesApi, 'patchNote').mockResolvedValue({ ...note, version: 4 })
    const { result } = renderHook(() => useAutosave(note, editor))

    act(() => { result.current.onChange(); result.current.onChange(); result.current.onChange() })
    expect(patch).not.toHaveBeenCalled()

    await act(async () => { vi.advanceTimersByTime(900) })
    expect(patch).toHaveBeenCalledTimes(1)
  })

  it('sends the current version with the body', async () => {
    const patch = vi.spyOn(notesApi, 'patchNote').mockResolvedValue({ ...note, version: 4 })
    const { result } = renderHook(() => useAutosave(note, editor))

    act(() => { result.current.onChange() })
    await act(async () => { vi.advanceTimersByTime(900) })

    expect(patch).toHaveBeenCalledWith('n1', expect.objectContaining({ version: 3 }))
  })

  it('surfaces a conflict instead of discarding the edit', async () => {
    vi.spyOn(notesApi, 'patchNote').mockRejectedValue({
      response: { status: 409, data: { message: 'Conflict', server_copy: { data: { ...note, version: 9 } } } },
    })

    const { result } = renderHook(() => useAutosave(note, editor))
    act(() => { result.current.onChange() })
    await act(async () => { vi.advanceTimersByTime(900) })

    await waitFor(() => expect(result.current.conflict?.version).toBe(9))
  })

  it('goes to the error state on a network failure and keeps the draft', async () => {
    vi.spyOn(notesApi, 'patchNote').mockRejectedValue({ message: 'Network Error' })

    const { result } = renderHook(() => useAutosave(note, editor))
    act(() => { result.current.onChange() })
    await act(async () => { vi.advanceTimersByTime(900) })

    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})
```

`frontend/src/lib/drafts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from './drafts'

describe('drafts', () => {
  it('round-trips a document', async () => {
    const doc = { type: 'doc' as const, content: [{ type: 'paragraph' }] }
    await saveDraft('n1', doc)

    expect((await loadDraft('n1'))?.doc).toEqual(doc)
  })

  it('returns null when there is no draft', async () => {
    expect(await loadDraft('missing')).toBeNull()
  })

  it('clears a draft', async () => {
    await saveDraft('n2', { type: 'doc', content: [] })
    await clearDraft('n2')

    expect(await loadDraft('n2')).toBeNull()
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/hooks/useAutosave.test.tsx src/lib/drafts.test.ts
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the draft buffer**

`frontend/src/lib/drafts.ts`:

```ts
import { del, get, set } from 'idb-keyval'
import type { ProseMirrorDoc, UUID } from '@/types/api'

export interface Draft { doc: ProseMirrorDoc; savedAt: number }

const key = (uuid: UUID) => `note-draft:${uuid}`

/** Written on every keystroke so a crash or reload never loses typing. */
export async function saveDraft(uuid: UUID, doc: ProseMirrorDoc): Promise<void> {
  try {
    await set(key(uuid), { doc, savedAt: Date.now() } satisfies Draft)
  } catch {
    // Private windows and blocked site data throw. A missing draft must never
    // break editing.
  }
}

export async function loadDraft(uuid: UUID): Promise<Draft | null> {
  try {
    return (await get<Draft>(key(uuid))) ?? null
  } catch {
    return null
  }
}

export async function clearDraft(uuid: UUID): Promise<void> {
  try { await del(key(uuid)) } catch { /* ignore */ }
}
```

- [ ] **Step 4: Write the autosave hook**

`frontend/src/hooks/useAutosave.ts`:

```ts
import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { patchNote } from '@/api/notes'
import { normalizeError } from '@/api/client'
import { clearDraft, saveDraft } from '@/lib/drafts'
import { NOTES_KEY } from '@/hooks/queries/useNotes'
import { useTabsStore } from '@/stores/tabsStore'
import type { Note } from '@/types/api'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 800
const MIN_SAVING_MS = 400   // below this, "Saving…" strobes

export function useAutosave(note: Note, editor: Editor | null) {
  const qc = useQueryClient()
  const setDirty = useTabsStore((s) => s.setDirty)

  const [status, setStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [conflict, setConflict] = useState<Note | null>(null)

  const version = useRef(note.version)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retries = useRef(0)

  useEffect(() => { version.current = note.version }, [note.version, note.uuid])

  const save = useCallback(async () => {
    if (!editor) return

    const body = editor.getJSON() as Note['body']
    if (!body) return

    const startedAt = Date.now()
    setStatus('saving')

    try {
      const updated = await patchNote(note.uuid, { body, version: version.current })
      version.current = updated.version
      retries.current = 0

      await clearDraft(note.uuid)
      setDirty(note.uuid, false)
      qc.invalidateQueries({ queryKey: NOTES_KEY })

      // Hold "Saving…" long enough to be readable.
      const elapsed = Date.now() - startedAt
      setTimeout(() => {
        setStatus('saved')
        setSavedAt(Date.now())
      }, Math.max(0, MIN_SAVING_MS - elapsed))
    } catch (e) {
      const err = normalizeError(e)

      if (err.status === 409 && err.serverCopy) {
        // Never discard the user's text: hand it to the conflict sheet.
        setConflict(err.serverCopy)
        setStatus('error')
        return
      }

      setStatus('error')
      retries.current += 1
      const backoff = Math.min(30_000, 2 ** retries.current * 1000)
      timer.current = setTimeout(save, backoff)
    }
  }, [editor, note.uuid, qc, setDirty])

  const onChange = useCallback(() => {
    if (!editor) return

    setDirty(note.uuid, true)
    void saveDraft(note.uuid, editor.getJSON() as Note['body'] as never)

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, DEBOUNCE_MS)
  }, [editor, note.uuid, save, setDirty])

  // Flush on anything that can end the session. visibilitychange matters most:
  // mobile browsers discard backgrounded tabs without firing beforeunload.
  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        void save()
      }
    }

    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('blur', flush)

    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('blur', flush)
    }
  }, [save])

  // ⌘S forces a save: an explicit request earns an explicit acknowledgement.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (timer.current) clearTimeout(timer.current)
        void save()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  return { status, savedAt, conflict, clearConflict: () => setConflict(null), onChange, saveNow: save }
}
```

- [ ] **Step 5: Write the conflict sheet and status bar**

`frontend/src/components/common/ConflictSheet.tsx`:

```tsx
import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import type { Note } from '@/types/api'

export function ConflictSheet({
  serverCopy, onKeepMine, onKeepTheirs, onSaveCopy, onClose,
}: {
  serverCopy: Note
  onKeepMine: () => void; onKeepTheirs: () => void; onSaveCopy: () => void; onClose: () => void
}) {
  return (
    <Modal opened onClose={onClose} title="This note changed somewhere else" centered>
      <Stack>
        <Text size="sm">
          Another tab or device saved version {serverCopy.version} while you were typing.
          Nothing has been lost — choose what to keep.
        </Text>
        <Group>
          <Button onClick={onKeepMine}>Keep mine</Button>
          <Button variant="default" onClick={onKeepTheirs}>Keep theirs</Button>
          <Button variant="default" onClick={onSaveCopy}>Save mine as a copy</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
```

`frontend/src/components/layout/StatusBar.tsx`:

```tsx
import { Group, Text } from '@mantine/core'
import dayjs from 'dayjs'

import type { SaveStatus } from '@/hooks/useAutosave'

export function StatusBar({
  status, savedAt, words, folderPath, onRetry,
}: {
  status: SaveStatus; savedAt: number | null; words: number
  folderPath: string | null; onRetry: () => void
}) {
  return (
    <Group h={28} px="sm" gap="lg" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      {/* No spinner: autosave fires every ~800ms and a spinner that often is noise. */}
      {status === 'saving' && <Text size="xs" c="dimmed">Saving…</Text>}
      {status === 'saved' && savedAt && (
        <Text size="xs" c="dimmed">Saved · {dayjs(savedAt).fromNow()}</Text>
      )}
      {status === 'error' && (
        <Text size="xs" c="orange" style={{ cursor: 'pointer' }} onClick={onRetry}>
          Couldn&apos;t save · retrying — Retry now
        </Text>
      )}

      <Text size="xs" c="dimmed" visibleFrom="sm">{words} words</Text>
      {folderPath && <Text size="xs" c="dimmed" visibleFrom="sm">{folderPath}</Text>}
      <Text size="xs" c="dimmed" ml="auto">Autosave on</Text>
    </Group>
  )
}
```

- [ ] **Step 6: Run the tests**

```bash
npx vitest run src/hooks/useAutosave.test.tsx src/lib/drafts.test.ts
```
Expected: PASS (4 + 3 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(frontend): debounced autosave with IndexedDB drafts and conflict resolution"
```

---

### Task F11: Spotlight search

**Files:**
- Create: `frontend/src/api/search.ts`, `frontend/src/hooks/queries/useSearch.ts`,
  `frontend/src/components/search/SpotlightSearch.tsx`,
  `frontend/src/components/search/Highlight.tsx`
- Test: `frontend/src/components/search/Highlight.test.tsx`

**Interfaces:**
- Produces: `<SpotlightSearch />` mounted once in `AppPage`, opened with ⌘K.
  `<HighlightTerms text terms />` applies the `<mark>` client-side — the server sends
  plain text only.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/search/Highlight.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HighlightTerms } from './Highlight'

describe('HighlightTerms', () => {
  it('marks each matching term', () => {
    render(<HighlightTerms text="the release plan" terms={['release']} />)

    expect(screen.getByText('release').tagName).toBe('MARK')
  })

  it('renders plain text when nothing matches', () => {
    render(<HighlightTerms text="nothing here" terms={['zzz']} />)

    expect(screen.queryByRole('mark')).toBeNull()
  })

  it('does not interpret the text as HTML', () => {
    render(<HighlightTerms text="<img src=x onerror=alert(1)> release" terms={['release']} />)

    expect(document.querySelector('img')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/search/Highlight.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the highlighter**

`frontend/src/components/search/Highlight.tsx`:

```tsx
import { Fragment } from 'react'

/**
 * The API returns plain text plus the matched terms, never HTML. Highlighting
 * happens here, as React nodes, so note content can never become markup.
 */
export function HighlightTerms({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'ig'))

  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => t.toLowerCase() === part.toLowerCase())
          ? <mark key={i}>{part}</mark>
          : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  )
}
```

- [ ] **Step 4: Write the search API and hook**

`frontend/src/api/search.ts`:

```ts
import { api } from './client'
import type { SearchResults } from '@/types/api'

export async function search(q: string, signal?: AbortSignal): Promise<SearchResults> {
  const { data } = await api.get<SearchResults>('/search', { params: { q }, signal })
  return data
}
```

`frontend/src/hooks/queries/useSearch.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { search } from '@/api/search'

/** MySQL's innodb_ft_min_token_size: below this the server cannot match anything. */
export const MIN_QUERY = 3

export function useSearch(q: string) {
  const trimmed = q.trim()

  return useQuery({
    queryKey: ['search', trimmed],
    // The query key is the search string, so an out-of-order response can
    // never overwrite a newer one. The signal aborts superseded keystrokes.
    queryFn: ({ signal }) => search(trimmed, signal),
    enabled: trimmed.length >= MIN_QUERY,
    // Stale results stay on screen while the next query runs.
    placeholderData: (previous) => previous,
  })
}
```

- [ ] **Step 5: Write the Spotlight component**

`frontend/src/components/search/SpotlightSearch.tsx`:

```tsx
import { Progress, Text } from '@mantine/core'
import { Spotlight, spotlight } from '@mantine/spotlight'
import { IconFolder, IconNote, IconPlus, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'

import { HighlightTerms } from './Highlight'
import { MIN_QUERY, useSearch } from '@/hooks/queries/useSearch'
import { useCreateNote } from '@/hooks/queries/useNotes'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useTabsStore } from '@/stores/tabsStore'
import { useUiStore } from '@/stores/uiStore'

export function SpotlightSearch() {
  const [query, setQuery] = useState('')
  const { data, isFetching } = useSearch(query)
  const showBar = useDelayedLoading(isFetching)
  const openTab = useTabsStore((s) => s.open)
  const setScope = useUiStore((s) => s.setScope)
  const createNote = useCreateNote()

  const short = query.trim().length > 0 && query.trim().length < MIN_QUERY

  return (
    <Spotlight.Root query={query} onQueryChange={setQuery} scrollable>
      <Spotlight.Search placeholder="Search notes and actions…" leftSection={<IconSearch size={18} />} />

      {/* Stale results stay visible and dim rather than vanishing. */}
      {showBar && <Progress value={100} size={2} animated />}

      <Spotlight.ActionsList style={{ opacity: isFetching ? 0.45 : 1 }}>
        {short && (
          <Text p="md" size="sm" c="dimmed" ta="center">Type at least {MIN_QUERY} characters</Text>
        )}

        {data?.notes.map((hit) => (
          <Spotlight.Action key={hit.uuid} onClick={() => openTab(hit.uuid, hit.title)}
            leftSection={<IconNote size={18} />}>
            <div>
              <Text size="sm" fw={500}><HighlightTerms text={hit.title} terms={hit.terms} /></Text>
              <Text size="xs" c="dimmed"><HighlightTerms text={hit.snippet} terms={hit.terms} /></Text>
            </div>
          </Spotlight.Action>
        ))}

        {data?.folders.map((f) => (
          <Spotlight.Action key={f.uuid} leftSection={<IconFolder size={18} />}
            onClick={() => setScope({ kind: 'folder', uuid: f.uuid, label: f.name })}>
            {f.name}
          </Spotlight.Action>
        ))}

        {query.trim().length >= MIN_QUERY && (
          <Spotlight.Action
            leftSection={<IconSearch size={18} />}
            onClick={() => {
              // Hand off to the list pane instead of competing with it.
              setScope({ kind: 'search', q: query.trim(), label: `Results for “${query.trim()}”` })
              spotlight.close()
            }}
          >
            See all results for “{query.trim()}”
          </Spotlight.Action>
        )}

        {data && data.notes.length === 0 && query.trim().length >= MIN_QUERY && (
          <Spotlight.Action leftSection={<IconPlus size={18} />} onClick={() => createNote.mutate({})}>
            No results — create note “{query.trim()}”
          </Spotlight.Action>
        )}
      </Spotlight.ActionsList>
    </Spotlight.Root>
  )
}
```

- [ ] **Step 6: Run the tests**

```bash
npx vitest run src/components/search/Highlight.test.tsx
```
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(frontend): spotlight search with client-side highlighting and list handoff"
```

---

### Task F12: Trash view, account menu and profile

**Files:**
- Create: `frontend/src/components/layout/AccountMenu.tsx`,
  `frontend/src/components/layout/ProfileModal.tsx`
- Modify: `frontend/src/components/notes/NoteRow.tsx`,
  `frontend/src/components/notes/NoteList.tsx`
- Test: `frontend/src/components/notes/NoteRow.test.tsx`

**Interfaces:**
- Produces: a Trash scope whose rows offer **Restore · Restore to… · Delete
  permanently** with the retention countdown; an avatar `Menu` with exactly **Profile**
  and **Sign out**; a Profile modal (name, email, change password).

- [ ] **Step 1: Write the failing test**

`frontend/src/components/notes/NoteRow.test.tsx`:

```tsx
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NoteRow } from './NoteRow'
import type { NoteListItem } from '@/types/api'

const base: NoteListItem = {
  uuid: 'n1', title: 'Release plan', excerpt: 'ship r34', is_starred: false,
  folder: null, tags: [], updated_at: '2026-10-09T00:00:00Z', deleted_at: null,
}

function renderRow(note: NoteListItem, props: Partial<Parameters<typeof NoteRow>[0]> = {}) {
  return render(
    <MantineProvider>
      <NoteRow note={note} active={false} onOpen={vi.fn()} onStar={vi.fn()}
        onTrash={vi.fn()} onDuplicate={vi.fn()} {...props} />
    </MantineProvider>,
  )
}

describe('NoteRow', () => {
  it('shows a placeholder for an untitled note', () => {
    renderRow({ ...base, title: '' })
    expect(screen.getByText('New note')).toBeDefined()
  })

  it('does not open the note when the star is clicked', async () => {
    const onOpen = vi.fn()
    const onStar = vi.fn()
    renderRow(base, { onOpen, onStar })

    await userEvent.click(screen.getByLabelText('Star'))

    expect(onStar).toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('offers restore and permanent delete for a trashed note', () => {
    renderRow({ ...base, deleted_at: '2026-10-01T00:00:00Z' })
    expect(screen.getByLabelText('Note actions')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/notes/NoteRow.test.tsx
```
Expected: FAIL — the star click bubbles and `onOpen` fires.

- [ ] **Step 3: Branch the row menu on trashed state**

In `NoteRow.tsx`, replace the `Menu.Dropdown` contents with:

```tsx
<Menu.Dropdown>
  {note.deleted_at ? (
    <>
      <Menu.Item onClick={onRestore}>Restore</Menu.Item>
      <Menu.Item onClick={onRestoreTo}>Restore to…</Menu.Item>
      <Menu.Divider />
      <Menu.Item color="red" onClick={onForceDelete}>Delete permanently</Menu.Item>
      {/* The retention clock only helps if it is visible while deciding. */}
      <Text size="xs" c="dimmed" px="sm" pb="xs">
        Auto-deleted {dayjs(note.deleted_at).add(30, 'day').fromNow()}.
      </Text>
    </>
  ) : (
    <>
      <Menu.Item onClick={onStar}>{note.is_starred ? 'Unstar' : 'Star'}</Menu.Item>
      <Menu.Item onClick={onDuplicate}>Duplicate</Menu.Item>
      <Menu.Divider />
      <Menu.Item color="red" onClick={onTrash}>Move to trash</Menu.Item>
    </>
  )}
</Menu.Dropdown>
```

- [ ] **Step 4: Write the account menu**

`frontend/src/components/layout/AccountMenu.tsx`:

```tsx
import { Avatar, Menu, Stack, Text } from '@mantine/core'
import { IconLogout, IconUser } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { ProfileModal } from './ProfileModal'
import { useLogout, useMe } from '@/hooks/queries/useAuth'

/** Exactly two items. There is no gear icon anywhere in the app. */
export function AccountMenu() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)

  const initials = (user?.name ?? '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Avatar size={28} radius="xl" color="blue" style={{ cursor: 'pointer' }}>{initials}</Avatar>
        </Menu.Target>
        <Menu.Dropdown>
          <Stack gap={0} px="sm" py="xs">
            {/* Confirming which account you are in, before you sign out of it. */}
            <Text size="sm" fw={600}>{user?.name}</Text>
            <Text size="xs" c="dimmed" truncate>{user?.email}</Text>
          </Stack>
          <Menu.Divider />
          <Menu.Item leftSection={<IconUser size={16} />} onClick={() => setProfileOpen(true)}>
            Profile
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red" leftSection={<IconLogout size={16} />}
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
          >
            Sign out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  )
}
```

`frontend/src/components/layout/ProfileModal.tsx` is a Mantine `Modal` — not a route, so
open tabs and unsaved drafts survive it — with name and email fields saved through
`PATCH /me`, and a change-password section posting to `PUT /me/password`. Both buttons
use `loading` while pending.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/components/notes/NoteRow.test.tsx
```
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(frontend): trash actions, account menu and profile modal"
```

---

### Task F13: New-note lifecycle and abandoned-note discard

**Files:**
- Create: `frontend/src/hooks/useAbandonedNote.ts`
- Modify: `frontend/src/components/editor/Editor.tsx`
- Test: `frontend/src/hooks/useAbandonedNote.test.tsx`

**Interfaces:**
- Produces: `useAbandonedNote(note, editor)` — on unmount or note switch, if the document
  is empty **and** nothing else changed, hard-deletes the note with
  `DELETE /notes/{uuid}?force=1` and **no toast and no confirmation**.

- [ ] **Step 1: Write the failing test**

`frontend/src/hooks/useAbandonedNote.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import * as notesApi from '@/api/notes'
import { useAbandonedNote } from './useAbandonedNote'
import type { Note } from '@/types/api'

const emptyNote: Note = {
  uuid: 'n1', title: '', excerpt: '', is_starred: false, folder: null, tags: [],
  updated_at: '2026-10-09T00:00:00Z', deleted_at: null,
  body: { type: 'doc', content: [] }, version: 1, word_count: 0, title_locked: false,
}

const emptyEditor = { getText: () => '   ' } as never

describe('useAbandonedNote', () => {
  it('hard-deletes an untouched empty note on unmount', () => {
    const force = vi.spyOn(notesApi, 'forceDeleteNote').mockResolvedValue()

    const { unmount } = renderHook(() => useAbandonedNote(emptyNote, emptyEditor))
    unmount()

    expect(force).toHaveBeenCalledWith('n1')
  })

  it('keeps an empty note that was starred', () => {
    const force = vi.spyOn(notesApi, 'forceDeleteNote').mockResolvedValue()

    const { unmount } = renderHook(() =>
      useAbandonedNote({ ...emptyNote, is_starred: true }, emptyEditor))
    unmount()

    expect(force).not.toHaveBeenCalled()
  })

  it('keeps an empty note that was tagged or filed', () => {
    const force = vi.spyOn(notesApi, 'forceDeleteNote').mockResolvedValue()

    const { unmount } = renderHook(() =>
      useAbandonedNote({ ...emptyNote, tags: ['todo'] }, emptyEditor))
    unmount()

    expect(force).not.toHaveBeenCalled()
  })

  it('keeps a note that has been written in', () => {
    const force = vi.spyOn(notesApi, 'forceDeleteNote').mockResolvedValue()

    const { unmount } = renderHook(() =>
      useAbandonedNote(emptyNote, { getText: () => 'hello' } as never))
    unmount()

    expect(force).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/hooks/useAbandonedNote.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

`frontend/src/hooks/useAbandonedNote.ts`:

```ts
import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/react'
import { useEffect, useRef } from 'react'

import { forceDeleteNote } from '@/api/notes'
import { BOOTSTRAP_KEY } from '@/hooks/queries/useBootstrap'
import { NOTES_KEY } from '@/hooks/queries/useNotes'
import { clearDraft } from '@/lib/drafts'
import { useTabsStore } from '@/stores/tabsStore'
import type { Note } from '@/types/api'

/**
 * A blank, untouched note was never a note. Discard it silently rather than
 * sending it to Trash, which would just move the litter. No toast, no confirm —
 * the user never asked for it to exist.
 */
export function useAbandonedNote(note: Note, editor: Editor | null) {
  const qc = useQueryClient()
  const closeTab = useTabsStore((s) => s.close)

  const latest = useRef({ note, editor })
  latest.current = { note, editor }

  useEffect(() => {
    return () => {
      const { note: n, editor: e } = latest.current

      const untouched =
        (e?.getText() ?? '').trim() === '' &&
        !n.is_starred &&
        n.tags.length === 0 &&
        n.folder === null &&
        !n.title_locked &&
        n.version === 1

      if (!untouched) return

      void clearDraft(n.uuid)
      void forceDeleteNote(n.uuid).then(() => {
        closeTab(n.uuid)
        qc.invalidateQueries({ queryKey: NOTES_KEY })
        qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      })
    }
  }, [note.uuid, qc, closeTab])
}
```

- [ ] **Step 4: Wire it into the editor**

In `frontend/src/components/editor/Editor.tsx`, after `useAutosave`:

```tsx
useAbandonedNote(note, editor)
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/hooks/useAbandonedNote.test.tsx
```
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(frontend): silently discard abandoned empty notes"
```

---

### Task F14: Mobile polish

**Files:**
- Create: `frontend/src/hooks/useVisualViewport.ts`,
  `frontend/src/components/editor/mobile.module.css`
- Modify: `frontend/src/components/editor/Editor.tsx`,
  `frontend/src/components/layout/shell.module.css`
- Test: `frontend/src/hooks/useVisualViewport.test.ts`

**Interfaces:**
- Produces: `useKeyboardInset(): number` — pixels the virtual keyboard covers, from the
  `visualViewport` API. The editor toolbar is translated by it so iOS Safari cannot hide
  the toolbar behind the keyboard. CSS alone does not solve this.

- [ ] **Step 1: Write the failing test**

`frontend/src/hooks/useVisualViewport.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardInset } from './useVisualViewport'

describe('useKeyboardInset', () => {
  it('returns 0 when the API is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined)
    const { result } = renderHook(() => useKeyboardInset())
    expect(result.current).toBe(0)
  })

  it('reports the covered height when the keyboard opens', () => {
    const listeners: Record<string, () => void> = {}
    vi.stubGlobal('visualViewport', {
      height: 400,
      addEventListener: (ev: string, fn: () => void) => { listeners[ev] = fn },
      removeEventListener: () => {},
    })
    vi.stubGlobal('innerHeight', 800)

    const { result } = renderHook(() => useKeyboardInset())
    act(() => { listeners.resize?.() })

    expect(result.current).toBe(400)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/hooks/useVisualViewport.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

`frontend/src/hooks/useVisualViewport.ts`:

```ts
import { useEffect, useState } from 'react'

/**
 * A sticky bottom toolbar still gets covered by the keyboard on iOS Safari.
 * The visualViewport API is the only reliable way to know how much is hidden.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => setInset(Math.max(0, window.innerHeight - vv.height))

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
```

- [ ] **Step 4: Move the toolbar to the bottom on phones**

`frontend/src/components/editor/mobile.module.css`:

```css
@media (max-width: 767px) {
  .editorRoot { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  .content { order: 1; overflow-y: auto; min-height: 0; flex: 1; }

  /* A 45-control wrapping toolbar would eat half a phone screen. */
  .toolbar {
    order: 2;
    position: sticky;
    bottom: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    border-top: 1px solid var(--mantine-color-default-border);
    border-bottom: 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .toolbar::-webkit-scrollbar { display: none; }

  /* Touch targets. */
  .toolbar button { min-width: 38px; min-height: 38px; }

  /* Tables scroll rather than forcing the page to. */
  .content table { display: block; overflow-x: auto; }
}
```

In `Editor.tsx`, apply the keyboard inset:

```tsx
const keyboardInset = useKeyboardInset()
// …
<Box className={mobile.toolbar} style={{ transform: `translateY(-${keyboardInset}px)` }}>
```

- [ ] **Step 5: Add the phone bottom-sheet rule for menus**

In `shell.module.css`:

```css
@media (max-width: 767px) {
  /* Dropdowns become bottom sheets: a menu anchored to a 20px ⋯ is a dart throw. */
  :global(.mantine-Menu-dropdown) {
    position: fixed !important;
    left: 8px !important;
    right: 8px !important;
    top: auto !important;
    bottom: calc(8px + env(safe-area-inset-bottom)) !important;
    width: auto !important;
    max-width: none !important;
  }
  :global(.mantine-Menu-item) { padding: 12px 14px; font-size: 15px; }
}
```

- [ ] **Step 6: Run the tests and check the three widths by hand**

```bash
npx vitest run src/hooks/useVisualViewport.test.ts
npm run dev
```

In the browser, at 1440px, 900px and 390px confirm: three panes / two panes with a
drawer / a single pane with back navigation; no horizontal page scroll at 390px; the
toolbar scrolls horizontally at the bottom; focusing an input does not zoom the page.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(frontend): mobile toolbar, keyboard inset handling and bottom sheets"
```

---

### Task F15: End-to-end acceptance

**Files:**
- Create: `frontend/playwright.config.ts`, `frontend/e2e/notes.spec.ts`
- Test: the spec itself

**Interfaces:**
- Consumes: the running backend (`php artisan serve`, seeded) and frontend
  (`npm run dev`).
- Produces: a Playwright suite covering the spec's acceptance criteria.

- [ ] **Step 1: Configure Playwright**

`frontend/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'] } },
    { name: 'phone', use: { ...devices['iPhone 14'] } },
  ],
})
```

- [ ] **Step 2: Write the acceptance spec**

`frontend/e2e/notes.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('demo@example.com')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'New note' })).toBeVisible()
}

test('a session survives a reload', async ({ page }) => {
  await signIn(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'New note' })).toBeVisible()
})

test('typing is persisted by autosave', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'New note' }).click()
  await page.getByLabel('Note body').fill('Autosaved content')

  await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 5000 })
  await page.reload()

  await expect(page.getByText('Autosaved content')).toBeVisible()
})

test('an abandoned empty note disappears', async ({ page }) => {
  await signIn(page)
  const before = await page.getByRole('button', { name: /note/i }).count()

  await page.getByRole('button', { name: 'New note' }).click()
  await page.getByText('All notes').click()

  await expect.poll(async () => page.getByRole('button', { name: /note/i }).count())
    .toBe(before)
})

test('search finds a word that is only in the body', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'New note' }).click()
  await page.getByLabel('Note body').fill('quarterly forecast spreadsheet')
  await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 5000 })

  await page.keyboard.press('Meta+k')
  await page.getByPlaceholder('Search notes and actions…').fill('quarterly')

  await expect(page.getByText('quarterly', { exact: false })).toBeVisible()
})

test('a two-character search sends no request', async ({ page }) => {
  await signIn(page)
  let requests = 0
  page.on('request', (r) => { if (r.url().includes('/search')) requests++ })

  await page.keyboard.press('Meta+k')
  await page.getByPlaceholder('Search notes and actions…').fill('qa')
  await page.waitForTimeout(800)

  expect(requests).toBe(0)
  await expect(page.getByText('Type at least 3 characters')).toBeVisible()
})

test('deleting a folder keeps its notes', async ({ page }) => {
  await signIn(page)
  await page.getByText('Work').hover()
  await page.getByLabel('Folder actions').first().click()
  await page.getByText('Delete folder').click()

  await expect(page.getByText(/nothing was deleted/)).toBeVisible()
  await page.getByText('All notes').click()
  await expect(page.getByRole('button', { name: /Note 1/ })).toBeVisible()
})

test('every pane is reachable on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only')

  await signIn(page)
  await page.getByLabel('Back').click()
  await expect(page.getByRole('button', { name: 'New note' })).toBeVisible()

  await page.getByText('All notes').click()
  await page.getByRole('button', { name: /Note/ }).first().click()
  await expect(page.getByLabel('Note body')).toBeVisible()

  // No horizontal page scroll.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('rich formatting survives a reload', async ({ page, isMobile }) => {
  test.skip(isMobile, 'bubble menu and full toolbar are desktop-only')

  await signIn(page)
  await page.getByRole('button', { name: 'New note' }).click()
  await page.getByLabel('Note body').fill('highlight me')
  await page.getByLabel('Note body').press('Meta+a')
  await page.getByLabel('Highlight').click()

  await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 5000 })
  await page.reload()

  await expect(page.locator('mark')).toBeVisible()
})
```

- [ ] **Step 3: Run the suite**

```bash
# Terminal 1
cd backend && php artisan migrate:fresh --seed && php artisan serve
# Terminal 2
cd frontend && npm run dev
# Terminal 3
cd frontend && npx playwright test
```
Expected: all projects green.

- [ ] **Step 4: Walk the remaining acceptance criteria by hand**

From `docs/SPEC.md` §7, verify by hand the ones E2E does not cover:
criterion 3 (two tabs, conflict sheet), criterion 4 (star during an in-flight save),
criterion 13 (tablet drawer at 800px), criterion 14 (both themes),
criterion 15 (offline — kill the network mid-type, confirm the amber status and that the
draft survives a reload).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test(frontend): end-to-end acceptance suite across desktop, tablet and phone"
```

---

## Running the whole thing

```powershell
# Containers (PHP + MySQL). The app container serves on :8000 automatically.
docker compose up -d

# Backend
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate:fresh --seed

# Frontend, on the Windows host
cd frontend
npm run dev                          # http://localhost:5173

# Sign in as demo@example.com / password
```

Tests (run each from its own directory — PowerShell has no `&&` chaining before v7):

```powershell
docker compose exec app php artisan test
cd frontend; npx vitest run; npx playwright test
```

---

## Self-review

**Spec coverage.** Every section of `docs/SPEC.md` maps to a task: auth §3.1 → B1–B3, F3;
storage §3.2 → B6, B8; search §3.3 → B11, F11; identifiers §3.4 → B2, B4–B6; new-note
lifecycle §3.5 → B7, B13, F13; autosave §3.6 → B8, F10; tabs §3.7 → F8; data model §4 →
B4–B6; API §5 → B7–B12; layout §6.1 → F4; search controls §6.2 → F7, F11; editor §6.3 →
F9; dropdowns §6.4 → F6, F7, F12; loading §6.5 → F5, F7, F11; saving §6.6 → F10;
responsive §6.7 → F4, F14; shortcuts §6.8 → F8, F10, F11. Acceptance §7 → F15.

**PWA coverage:** spec §3.7 → F16 (shell, update prompt, install), F17 (offline reads,
sign-out purge), F18 (write queue), F19 (offline E2E), with B15 providing the
idempotent create the queue depends on.

**Deferred items carry no tasks, deliberately:** import/export, Settings, version
history, attachments, sharing. `note_versions` is created in B6 and nothing writes to it.

**Type consistency.** `NoteListItem` (no body) and `Note` (with body) are used
consistently; `uuid` is the public id everywhere; `Scope` is defined once in F4 and
consumed by F6, F7 and F11; `NOTES_KEY` and `BOOTSTRAP_KEY` are defined once each and
imported by every mutation that invalidates them.

**Review Focus coverage.** Item 1 → B8 "stars a note without a version"; item 2 → B8
"rejects an over-large body" and "nested beyond a sane depth"; item 3 → B4 "rejects two
root folders with the same name"; item 4 → B4 "moves notes to root when a folder is
deleted"; item 5 → B11 "rejects a term shorter than the MySQL minimum token size".

**Layering.** No controller in this plan contains a conditional, a loop, a query, a
transaction or a `save()`. Each action is a single-method service under
`app/Services/<Domain>`; read filtering lives in `app/Queries`; stateless helpers live
in `app/Support`; models carry relations, casts and one scope. `ArchitectureTest` (B1b)
fails the build if that slips, and every backend task re-runs it before committing.

**Known gap, stated rather than hidden:** the Rich text ⇄ Source toggle appears in the F9
toolbar but has no implementation task. It is Phase 2 in the spec. Either wire it to
`@mantine/tiptap`'s `SourceCode` control in F9 or remove the control — do not ship a
toggle that does nothing.
