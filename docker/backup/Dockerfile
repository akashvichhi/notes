# The backup container (decision 11): pg_dump from the same Postgres image as the
# database, so its version always matches the server, plus rclone for the upload.
FROM postgres:18.4-bookworm

COPY --from=rclone/rclone:1.75.2 /usr/local/bin/rclone /usr/local/bin/rclone
# rclone verifies the storage provider's HTTPS certificate; the Postgres image has no CA bundle.
COPY --from=rclone/rclone:1.75.2 /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY docker/scripts/run_daily_at.sh /usr/local/bin/run_daily_at.sh
COPY docker/backup/start_backups.sh docker/backup/backup_now.sh docker/backup/check_backup.sh \
    docker/backup/expired_backups.sh /usr/local/bin/

# When the last backup succeeded (seconds since the epoch), for the healthcheck.
ENV BACKUP_STATUS_FILE=/tmp/last_backup_at

USER postgres
