#!/bin/sh
set -e

echo "[db_backup] Installing aws-cli..."
apk add --no-cache aws-cli >/dev/null 2>&1 || echo "[db_backup] aws-cli install failed (S3 sync disabled)"

echo "[db_backup] Registering cron schedule: $BACKUP_SCHEDULE"
echo "$BACKUP_SCHEDULE /deploy/scripts/backup.sh >> /backups/backup.log 2>&1" | crontab -

echo "[db_backup] Starting crond..."
crond -f -l 8

