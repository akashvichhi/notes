# Restoring the database from a backup

The `backup` container uploads one dump of the database every night at 23:10 India time, named `notes-YYYY-MM-DD.dump` (decision 11). Only the newest backup is kept. This page explains how to put one back.

Run every command on the server, from the repo root (`/var/www/notes`).

## Before you start

- **Restore before 23:10.** The nightly run replaces the only backup. If the data was damaged by a mistake, that night's run would overwrite the good backup with the damaged data. Download the good file first, so you have a copy that the nightly run can't touch.
- **Everything after the backup is lost.** The database goes back to exactly how it was at 23:10 on the backup's date.
- **Everyone signs in again.** Login sessions are restored along with everything else.

## 1. Copy the backup file to the server

Download `notes-YYYY-MM-DD.dump` from the folder set in `BACKUP_REMOTE_FOLDER`, then copy it to the server:

```sh
scp notes-YYYY-MM-DD.dump <user>@<server>:/var/www/notes/
```

## 2. Restore it

```sh
docker compose stop app scheduler
docker cp notes-YYYY-MM-DD.dump notes-postgres:/tmp/restore.dump
docker compose exec postgres pg_restore -U notes -d notes --clean --if-exists --no-owner /tmp/restore.dump
docker compose exec postgres rm /tmp/restore.dump
docker compose start app scheduler
rm notes-YYYY-MM-DD.dump
```

- Stopping `app` and `scheduler` means nothing writes to the database during the restore, and nobody sees half-restored data.
- `--clean --if-exists` drops each table before recreating it from the backup, so the backup replaces what is there.
- `--no-owner` skips the ownership commands, so it doesn't matter which database user made the dump.

## Test a backup without touching the live data

Restore into a scratch database, count the notes, then remove the scratch database:

```sh
docker cp notes-YYYY-MM-DD.dump notes-postgres:/tmp/restore.dump
docker compose exec postgres createdb -U notes restore_test
docker compose exec postgres pg_restore -U notes -d restore_test --no-owner /tmp/restore.dump
docker compose exec postgres psql -U notes -d restore_test -c "select count(*) from notes"
docker compose exec postgres dropdb -U notes restore_test
docker compose exec postgres rm /tmp/restore.dump
```

The backup is good if the count matches the number of notes in the app, including the ones in the Trash.
