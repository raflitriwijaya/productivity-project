#!/bin/sh
set -e

F=/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz

echo "[backup] Starting backup at $(date)"

pg_dump postgresql://productivity:$PGPASSWORD@db:5432/productivity_db | gzip > "$F"

echo "[backup] Local backup written: $F"

if [ -n "$S3_BUCKET" ]; then
    if [ -n "$S3_ENDPOINT" ]; then
        aws --endpoint-url "$S3_ENDPOINT" s3 cp "$F" "s3://$S3_BUCKET/$(basename $F)" && echo "[backup] Off-host copy ok"
    else
        aws s3 cp "$F" "s3://$S3_BUCKET/$(basename $F)" && echo "[backup] Off-host copy ok"
    fi
else
    echo "[backup] S3_BUCKET unset — local backup only"
fi

# Hapus backup lokal lebih dari 7 hari
find /backups -name "*.sql.gz" -mtime +7 -delete
echo "[backup] Old backups cleaned up"
echo "[backup] Done at $(date)"
