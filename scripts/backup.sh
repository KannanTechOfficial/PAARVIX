#!/usr/bin/env bash
# Paarvix Database Backup Script
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/paarvix_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "Starting backup of Paarvix PostgreSQL database..."
docker exec -t paarvix-postgres pg_dump -U paarvix -d paarvix | gzip > "${BACKUP_FILE}"

echo "Backup completed successfully: ${BACKUP_FILE}"

