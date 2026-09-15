#!/bin/sh
set -eu

destination="${1:-./backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$destination"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-notes}" "${POSTGRES_DB:-notes}" > "$destination/database.sql"
docker compose exec -T api tar czf - -C /app/data/notes . > "$destination/notes.tar.gz"
printf 'Backup tersimpan di %s\n' "$destination"
