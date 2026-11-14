# Building with a coding agent

How this project was built: a coding agent worked from a written spec, an
architecture document and a task plan, and stopped at each delivery gate for me to
review and test. This file was the repository's original README. Paths in it are
relative to the repository root.

---

## Start here

**→ [`GETTING-STARTED.md`](../GETTING-STARTED.md)** — setup, the prompt to give the
coding agent, and what to watch while it builds.

**→ [`WHEN-IT-GOES-WRONG.md`](../WHEN-IT-GOES-WRONG.md)** — keep this to hand.

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
