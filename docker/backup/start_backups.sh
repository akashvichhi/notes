#!/bin/sh
# The backup container's entry point: start_backups.sh HH:MM
# The start time counts as the last backup, so the healthcheck allows a day for the first one.
set -eu

date +%s > "$BACKUP_STATUS_FILE"
exec sh /usr/local/bin/run_daily_at.sh "$1" sh /usr/local/bin/backup_now.sh
