# Setup — Windows with Docker

PHP and MySQL run in Docker containers. **Nothing but Node is installed on Windows.**
All commands are PowerShell, run from the repository root (`notes-app`).

---

## 1. Check what you already have

```powershell
docker --version      # need this — you have it
node --version        # need v20 or newer
php --version         # NOT needed; it runs in Docker
```

`docker --version` must print something. If `node --version` errors or prints below
v20, install Node — see step 2. Ignore `php` entirely; you are not installing it.

---

## 2. Install Node (the only host install)

```powershell
winget install OpenJS.NodeJS.LTS
```

Or download the **LTS** installer from `https://nodejs.org`. Close and reopen
PowerShell, then confirm:

```powershell
node --version        # v20.x or v22.x
npm --version
```

Node runs the frontend. It stays on the host rather than in Docker because Vite's
hot reload is much faster that way on Windows.

---

## 3. Start PHP and MySQL

```powershell
docker compose up -d --build
```

First run takes a few minutes — it builds a PHP 8.3 image with `pdo_mysql`, `zip`,
`bcmath` and `intl`, and pulls MySQL 8.4.

Check both are up:

```powershell
docker compose ps
```

You want `notes-mysql` showing **healthy** and `notes-app` **running**. The `app`
container waits for `backend/artisan` to exist before it starts serving, so it sitting
idle before Task B1 is expected, not a fault.

The `notes` database is created automatically with the right charset and collation.
Credentials: user `root`, password `secret`, and MySQL is published on
`localhost:3306` if you want to connect a GUI such as DBeaver or Workbench.

---

## 4. How to run commands

PHP never runs on the host. Everything goes through the container:

| Instead of | Run |
|---|---|
| `php artisan migrate` | `docker compose exec app php artisan migrate` |
| `php artisan test` | `docker compose exec app php artisan test` |
| `composer install` | `docker compose exec app composer install` |
| `php artisan serve` | nothing — the container already serves on `localhost:8000` |

Save typing with a PowerShell function (add it to `$PROFILE` to keep it):

```powershell
function art { docker compose exec app php artisan @args }
# then:  art migrate      art test      art migrate:fresh --seed
```

Node commands run normally on the host:

```powershell
cd frontend
npm install
npm run dev
```

---

## 5. One setting that differs under Docker

Inside the container, MySQL is **not** on `127.0.0.1` — it is reachable by its service
name. In `backend/.env`:

```dotenv
DB_HOST=mysql           # the compose service name, NOT 127.0.0.1
DB_PORT=3306
DB_DATABASE=notes
DB_USERNAME=root
DB_PASSWORD=secret
```

Everything else in the plan's `.env` block is unchanged. `127.0.0.1` is correct only
if you later run PHP on the host instead.

---

## 6. Creating the Laravel app (Task B1, Docker form)

The plan's `laravel new backend` uses a global installer you do not have. Inside the
container, use Composer directly — this is the other command the Laravel docs give:

```powershell
docker compose exec app composer create-project laravel/laravel .
docker compose exec app php artisan install:api
```

The `.` is deliberate: `/var/www/html` inside the container **is** your `backend/`
folder on Windows, so the project is created straight into it.

If `backend/` does not exist yet, create it first so the bind mount has something to
point at:

```powershell
New-Item -ItemType Directory -Force backend | Out-Null
docker compose up -d
```

---

## 7. Verify the whole stack

```powershell
docker compose exec app php artisan migrate
docker compose exec app php artisan db:show        # should report the notes database
```

Then open `http://localhost:8000/api/v1/health` — it should return
`{"status":"ok"}` once Task B1 is complete.

---

## Everyday commands

```powershell
docker compose up -d        # start
docker compose down         # stop (data survives)
docker compose down -v      # stop AND delete the database
docker compose logs -f app  # watch Laravel output
docker compose logs -f mysql
```

---

## Troubleshooting

**`port is already allocated` on 3306** — another MySQL is running on Windows. Either
stop that service, or change the published port to `3307:3306` in `docker-compose.yml`
(the container-internal port stays 3306, so `DB_HOST=mysql`/`DB_PORT=3306` is unchanged).

**`SQLSTATE[HY000] [2002] Connection refused`** — MySQL has not finished starting, or
`DB_HOST` is `127.0.0.1` instead of `mysql`. Check `docker compose ps` for *healthy*.

**`notes-app` keeps restarting** — look at `docker compose logs app`. Before Task B1
it should be idle, not restarting.

**Changes to files are not picked up** — confirm the bind mount is working:
`docker compose exec app ls` should list your `backend/` contents.

**Docker Desktop will not start** — enable virtualisation in the BIOS and make sure
the WSL2 backend is installed (`wsl --install` in an admin PowerShell).
