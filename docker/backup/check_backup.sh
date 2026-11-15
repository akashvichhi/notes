#!/bin/sh
# The backup container's healthcheck: unhealthy once the last backup is more than a day
# old, plus two hours of slack for a slow run.
set -eu

MAX_AGE_SECONDS=93600

if [ -z "${BACKUP_REMOTE_TYPE:-}" ]; then
    exit 0
fi
last=$(cat "$BACKUP_STATUS_FILE")
[ $(( $(date +%s) - last )) -lt "$MAX_AGE_SECONDS" ]
