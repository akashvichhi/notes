#!/bin/sh
# Dumps the database, uploads it, and deletes the backups the retention no longer needs.
# Runs nightly from start_backups.sh; by hand: docker compose exec backup sh /usr/local/bin/backup_now.sh
# Logs file names and sizes only, never credentials.
set -eu

# Same rule as run_daily_at.sh: Asia/Kolkata, the app's time zone.
APP_TIME_ZONE="IST-5:30"
REMOTE="backup"

if [ -z "${BACKUP_REMOTE_TYPE:-}" ]; then
    echo "backups are off: BACKUP_REMOTE_TYPE is empty"
    exit 0
fi
for setting in BACKUP_REMOTE_USER BACKUP_REMOTE_PASSWORD BACKUP_REMOTE_FOLDER; do
    eval "value=\${$setting:-}"
    if [ -z "$value" ]; then
        echo "backup failed: $setting is empty in .env" >&2
        exit 1
    fi
done

# rclone reads the remote "backup" from RCLONE_CONFIG_BACKUP_*; it wants the password in
# its obscured form, made here so .env can hold the plain one.
export RCLONE_CONFIG_BACKUP_TYPE="$BACKUP_REMOTE_TYPE"
export RCLONE_CONFIG_BACKUP_USER="$BACKUP_REMOTE_USER"
RCLONE_CONFIG_BACKUP_PASS=$(printf '%s' "$BACKUP_REMOTE_PASSWORD" | rclone obscure -)
export RCLONE_CONFIG_BACKUP_PASS
# Deleted backups skip the trash, where they would still use the storage quota.
export RCLONE_CONFIG_BACKUP_HARD_DELETE=true

# One name per day: a second run on the same day replaces that day's file.
name="notes-$(TZ="$APP_TIME_ZONE" date +%Y-%m-%d).dump"
file="/tmp/$name"
trap 'rm -f "$file"' EXIT

pg_dump --format=custom --file="$file"
# The upload creates the folder, and any folder above it, when it does not exist yet.
rclone copyto "$file" "$REMOTE:$BACKUP_REMOTE_FOLDER/$name"
# Only after the upload, so the newest backup is always among the kept ones. Only files
# named like a backup are touched, whatever else the folder holds.
rclone lsf --files-only --max-depth 1 "$REMOTE:$BACKUP_REMOTE_FOLDER" \
    | sh /usr/local/bin/expired_backups.sh \
    | while IFS= read -r expired; do
        rclone deletefile "$REMOTE:$BACKUP_REMOTE_FOLDER/$expired"
        echo "deleted old backup: $expired"
    done

date +%s > "$BACKUP_STATUS_FILE"
echo "backup ok: $name ($(du -h "$file" | cut -f1))"
