#!/bin/sh
set -eu

BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

mkdir -p "$BACKUP_DIR"

echo "[backup] loop iniciado; intervalo=${INTERVAL_SECONDS}s, retencao=${RETENTION_DAYS}d"

while true; do
  TS="$(date +%Y%m%d-%H%M%S)"
  FILE="$BACKUP_DIR/zapmesa-$TS.sql.gz"

  echo "[backup] criando dump em $FILE"
  pg_dump -h postgres -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILE"

  echo "[backup] aplicando politica de retencao"
  find "$BACKUP_DIR" -type f -name "zapmesa-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete || true

  echo "[backup] concluido; aguardando proxima execucao"
  sleep "$INTERVAL_SECONDS"
done
