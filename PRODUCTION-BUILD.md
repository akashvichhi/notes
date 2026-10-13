# Production Build Guide: Serving React App from Laravel

This guide explains how to build the React application for production, clean previous builds, and serve the application directly from the Laravel root route.

---

## 1. Overview of the Setup

- **Frontend Build Output:** Vite compiles the React app directly into `api/public/`.
- **Laravel Catch-All Route:** `api/routes/web.php` catches all non-API web traffic and serves `api/public/index.html`.
- **Preserving Backend Files:** Vite has `emptyOutDir: false` enabled to avoid accidentally deleting Laravel's `index.php`, `.htaccess`, and backend assets.

---

## 2. Configuration Already in Place

### `web/vite.config.ts`
```ts
export default defineConfig({
  // ...
  build: {
    outDir: path.resolve(import.meta.dirname, '../api/public'),
    emptyOutDir: false, // Prevents deleting index.php and Laravel assets
  },
})
```

### `api/routes/web.php`
```php
use Illuminate\Support\Facades\Route;

// Serve the React SPA for the root and any client-side routes
Route::get('/{any?}', function () {
    return response()->file(public_path('index.html'));
})->where('any', '^(?!api|sanctum).*$'); // Ensures /api and /sanctum are not captured
```

---

## 3. Step-by-Step: Rebuilding After Making Changes

Because `emptyOutDir: false` is used to protect Laravel files, **previous hashed bundles in `api/public/assets/` and `api/public/index.html` should be removed before creating a new build** to avoid stale files accumulating.

### Step 1: Clean Previous Build

From the `web/` folder:

**Windows PowerShell:**
```powershell
Remove-Item -Recurse -Force ../api/public/assets, ../api/public/index.html -ErrorAction SilentlyContinue
```

**Bash / macOS / Linux:**
```bash
rm -rf ../api/public/assets ../api/public/index.html
```

---

### Step 2: Build the React Application

From the `web/` folder:

```bash
npm run build
```

This compiles TypeScript and outputs the fresh `index.html` and `assets/` into `api/public/`.

---

### Step 3: Run / Verify in Laravel

From the `api/` folder:

```bash
php artisan serve
```

Open `http://localhost:8000` in your browser. Laravel will serve the updated production build.

---

## 4. Quick Helper Command (Optional)

You can add a clean script to `web/package.json` for convenience:

```json
"scripts": {
  "clean": "node -e \"const fs = require('fs'); fs.rmSync('../api/public/assets', { recursive: true, force: true }); fs.rmSync('../api/public/index.html', { force: true });\"",
  "build:prod": "npm run clean && npm run build"
}
```

Then you can rebuild cleanly in a single command:
```bash
npm run build:prod
```
