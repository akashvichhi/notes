# Notes — brand assets

Ready to use. Copy them into the frontend once `frontend/` exists.

```powershell
Copy-Item assets\brand\favicon.svg,
          assets\brand\favicon.ico,
          assets\brand\apple-touch-icon.png,
          assets\brand\icon-192.png,
          assets\brand\icon-512.png,
          assets\brand\icon-512-maskable.png,
          assets\brand\og-image.png,
          assets\brand\manifest.webmanifest  frontend\public\

Remove-Item frontend\public\vite.svg -ErrorAction SilentlyContinue
```

```bash
# macOS / Linux
cp assets/brand/{favicon.svg,favicon.ico,apple-touch-icon.png,icon-192.png,\
icon-512.png,icon-512-maskable.png,og-image.png,manifest.webmanifest} frontend/public/
rm -f frontend/public/vite.svg
```

The `logo*.svg` files are **not** copied to `public/` — import them in components
instead, so Vite can inline and tree-shake them.

---

## What each file is for

| File | Size | Where it is used |
|---|---|---|
| **`favicon.svg`** | vector | The browser tab. Primary favicon for every modern browser. **Theme-aware** — the strokes flip to dark on a light-blue square under `prefers-color-scheme: dark`, so it stays legible on dark browser chrome |
| **`favicon.ico`** | 16/32/48/64 | Legacy fallback for older browsers and Windows shortcuts. Served from the site root |
| **`apple-touch-icon.png`** | 180×180 | iOS and iPadOS home screen. Full-bleed with **no rounded corners and no transparency** — iOS applies its own mask, and a pre-rounded icon ends up with a double-rounded edge |
| **`icon-192.png`** | 192×192 | Android home screen, PWA install prompt |
| **`icon-512.png`** | 512×512 | PWA splash screen, store listings |
| **`icon-512-maskable.png`** | 512×512 | Android adaptive icons. Background fills the canvas and the glyph sits inside the central 80% safe zone, so it survives being cropped to a circle, squircle or rounded square |
| **`icon-1024.png`** | 1024×1024 | Master raster. Keep for anything that needs a large PNG later |
| **`og-image.png`** | 1200×630 | Link previews in Slack, WhatsApp, iMessage, Twitter/X, LinkedIn |
| **`logo.svg`** | vector | Horizontal lockup, mark + wordmark, **for light backgrounds**. Login page, emails, docs |
| **`logo-dark.svg`** | vector | Same lockup **for dark backgrounds** |
| **`logo-mark.svg`** | vector | Square mark alone, fixed blue. Use where the lockup is too wide |
| **`logo-mark-mono.svg`** | vector | Square mark whose background is `currentColor`, so it inherits the surrounding text colour. For single-colour contexts |
| **`manifest.webmanifest`** | — | PWA metadata. Optional in Phase 1; harmless to ship |

---

## `index.html`

```html
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

Order matters for the two `icon` links: browsers that understand SVG take the first
and ignore the `.ico`; older ones skip the SVG and fall back.

---

## Using the lockup in React

```tsx
import logo from '@/assets/logo.svg'
import logoDark from '@/assets/logo-dark.svg'
import { useComputedColorScheme } from '@mantine/core'

export function Logo({ height = 28 }: { height?: number }) {
  const scheme = useComputedColorScheme('light')
  return <img src={scheme === 'dark' ? logoDark : logo} alt="Notes" height={height} />
}
```

Copy `logo.svg` and `logo-dark.svg` into `frontend/src/assets/` for this.

The **header brand mark is not an image** — Task F4 draws it with the Tabler
`IconNotes` glyph inside a blue square, so it scales and themes without a round trip.
These SVGs are for the login page, emails and anywhere outside the app shell.

---

## Design tokens

| Token | Value | Notes |
|---|---|---|
| Brand blue | `#228be6` | Mantine `blue.6`. The mark's background on light surfaces |
| Brand blue, dark theme | `#4dabf7` | Mantine `blue.4`. Keeps contrast on dark chrome |
| Mark foreground | `#ffffff` light · `#1a1b1e` dark | The three strokes |
| Ink | `#212529` | Wordmark on light |
| Ink, dark theme | `#e9ecef` | Wordmark on dark |

**Geometry**, as fractions of the mark's size, if you ever need to redraw it:
corner radius `0.22`, stroke width `0.075` with round caps, three horizontal strokes
at `0.344` / `0.5` / `0.656` of the height, running from `0.3125` to `0.6875` of the
width — the third stopping at `0.53`.

**Clear space:** keep at least half the mark's height clear on every side.
**Minimum size:** 16px for the mark, 80px wide for the lockup.
Do not recolour, rotate, stretch, or add effects to the mark.

---

## Regenerating

The PNGs and the `.ico` were drawn with Pillow at 4× and downsampled with Lanczos.
The SVGs are hand-written. To change the colour, edit the SVGs and the `BLUE`
constant in the generator, then re-run it.
