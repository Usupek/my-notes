#!/usr/bin/env bash
set -Eeuo pipefail

expected_sha="${1:?Commit SHA wajib diberikan}"
app_url="http://100.99.109.35:8080"
backup_dir="/home/ubuntu/backups/my-notes/$(date -u +%Y%m%dT%H%M%SZ)-${expected_sha:0:12}"

if [[ "$(git rev-parse HEAD)" != "$expected_sha" ]]; then
  printf '%s\n' "Commit VPS berbeda dari commit yang lolos CI."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  printf '%s\n' "Worktree VPS tidak bersih. Deployment dihentikan."
  exit 1
fi

diagnostics() {
  printf '%s\n' "Deployment gagal. Status dan log container:"
  docker compose ps || true
  docker compose logs --no-color --tail=80 api web nginx || true
}
trap diagnostics ERR

umask 077

printf '%s\n' "Memvalidasi Compose..."
docker compose config --quiet

printf '%s\n' "Build image ARM64 sebelum mengganti container..."
docker compose build api web

printf '%s\n' "Backup database dan notes..."
sh ./scripts/backup.sh "$backup_dir"

printf '%s\n' "Menjalankan migrasi..."
docker compose run --rm --no-deps migrate

printf '%s\n' "Memperbarui API dan frontend..."
docker compose up \
  -d \
  --no-deps \
  --no-build \
  --wait \
  --wait-timeout 180 \
  api web

printf '%s\n' "Membuat ulang Nginx agar upstream terbaru dibaca..."
docker compose up \
  -d \
  --no-deps \
  --no-build \
  --force-recreate \
  --wait \
  --wait-timeout 60 \
  nginx

printf '%s\n' "Memeriksa API dan frontend..."
healthy=false

for attempt in {1..30}; do
  if curl --fail --silent --show-error \
    --connect-timeout 5 --max-time 10 \
    "$app_url/api/v1/healthz" >/dev/null &&
    curl --fail --silent --show-error \
      --connect-timeout 5 --max-time 10 \
      "$app_url/" >/dev/null; then
    healthy=true
    break
  fi

  sleep 3
done

if [[ "$healthy" != true ]]; then
  printf '%s\n' "Health check gagal."
  exit 1
fi

printf 'Deployment berhasil: %s\n' "$expected_sha"
printf 'Backup: %s\n' "$backup_dir"
