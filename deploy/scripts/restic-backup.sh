#!/bin/sh
set -e

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID}"

log() { echo "[restic-backup] $1"; }

notify_telegram() {
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="$1" > /dev/null
    fi
}

log "Starting offsite backup at ${TIMESTAMP}"

# Backup semua volume sekaligus dalam satu snapshot
restic backup \
    /data/postgres_backups \
    /data/gitea_data \
    /data/grafana_data \
    /data/uptime_kuma_data \
    /data/vaultwarden \
    /data/miniflux-db \
    /data/wallabag \
    /data/nextcloud \
    /data/nextcloud-db \
    --tag homelab \
    --hostname homelab-server \
    --verbose

# Retention policy: 7 daily, 4 weekly, 3 monthly
restic forget \
    --keep-daily 7 \
    --keep-weekly 4 \
    --keep-monthly 3 \
    --prune \
    --tag homelab \
    --host homelab-server

log "Backup completed successfully at $(date '+%Y-%m-%d %H:%M:%S')"
notify_telegram "✅ [homelab] Restic backup sukses - $(date '+%Y-%m-%d %H:%M')"
