#!/bin/sh
# Reads backup file names on stdin, one per line, and prints the ones the retention no
# longer needs (decision 12). Kept: the newest backup of each of the last 7 days, the
# last 4 weeks (Monday to Sunday) and the last 6 months that have a backup, the rule
# restic and borg use. Counting only periods that have a backup means a stretch of
# failed nights never pushes the older backups out.
# Names that don't look like a backup are never printed, so they are never deleted.
set -eu

KEEP_DAILY=7
KEEP_WEEKLY=4
KEEP_MONTHLY=6
# backup_now.sh names each file notes-YYYY-MM-DD.dump.
BACKUP_NAME_REGEX='^notes-[0-9]{4}-[0-9]{2}-[0-9]{2}\.dump$'

daily=0
weekly=0
monthly=0
last_week=""
last_month=""

# Newest first, so the first backup seen in a period is that period's newest.
grep -E "$BACKUP_NAME_REGEX" | sort -r | while IFS= read -r name; do
    day=${name#notes-}
    day=${day%.dump}
    # A name with an impossible date is skipped, never deleted.
    week=$(date -d "$day" +%G-%V 2>/dev/null) || continue
    month=${day%-??}
    keep=false

    # One backup per day, so every backup starts a new day.
    if [ "$daily" -lt "$KEEP_DAILY" ]; then
        daily=$((daily + 1))
        keep=true
    fi
    if [ "$week" != "$last_week" ] && [ "$weekly" -lt "$KEEP_WEEKLY" ]; then
        weekly=$((weekly + 1))
        keep=true
    fi
    if [ "$month" != "$last_month" ] && [ "$monthly" -lt "$KEEP_MONTHLY" ]; then
        monthly=$((monthly + 1))
        keep=true
    fi
    last_week=$week
    last_month=$month

    if [ "$keep" = false ]; then
        echo "$name"
    fi
done
