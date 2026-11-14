#!/bin/sh
# The container's entry point: migrate, then serve.
set -eu

alembic upgrade head

# One worker: the rate limiter keeps its counters in memory.
# --proxy-headers: Caddy is the only thing that can reach this port, so the client
# address it forwards is trusted. --no-access-log: the raw path and query string can hold
# search terms; app/core/request_logging_middleware.py logs a safe line instead.
exec uvicorn app.main:create_app --factory \
    --host 0.0.0.0 --port 8000 \
    --proxy-headers --forwarded-allow-ips='*' \
    --no-access-log
