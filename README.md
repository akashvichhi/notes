# Notes

A cross-platform notes app — one React codebase shipping as a web app and as native
apps for Windows, macOS, Linux, Android and iOS, against a Laravel API on MySQL.

Notes live in one of two containers: **Cloud**, synced across every device and
editable offline, or **On This Device**, which never leaves the machine.

---

## Start here

**→ [`GETTING-STARTED.md`](GETTING-STARTED.md)** — setup, the prompt to give the
coding agent, and what to watch while it builds.

**→ [`WHEN-IT-GOES-WRONG.md`](WHEN-IT-GOES-WRONG.md)** — keep this to hand.

---

## What is where

| | |
|---|---|
| **Root `.md` files** | **For you.** Runbook and recovery guide |
| **`docs/`** | **For the coding agent.** Spec, plan, principles, context |
| `mockup/index.html` | Interactive UI reference — open it in a browser |
| `assets/brand/` | Icons and logos, already generated |
| `docker-compose.yml`, `docker/` | PHP 8.3 and MySQL 8.4 for local development |

The agent's entry point is `docs/START.md`; you point it there and it reads the rest
itself.

## Delivery

| Stage | Tasks | Ends |
|---|---|---|
| 1 · Backend + web app | `B1`–`B18`, `F1`–`F15` | ⛔ stops for you to test |
| 2 · Desktop | `D1`–`D12` | ⛔ stops for you to test |
| 3 · Mobile | `M1`–`M8` | ⛔ complete |
