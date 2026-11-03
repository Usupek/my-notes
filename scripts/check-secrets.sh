#!/usr/bin/env bash
# Pre-commit guard: blocks env files, private keys, real bcrypt hashes and note content from being committed.
# Checks the staged blobs (what will actually be committed), not the working tree.
set -euo pipefail

fail=0
block() {
  echo "✗ $1: $2" >&2
  fail=1
}

while IFS= read -r -d '' file; do
  base=$(basename "$file")

  case "$file" in
    .env.example) ;;
    .env | .env.* | */.env | */.env.*) block "$file" "env files must not be committed (only .env.example)" ;;
  esac

  case "$file" in
    storage/notes/.gitkeep) ;;
    storage/notes/*) block "$file" "note content and uploads live outside git" ;;
  esac

  case "$base" in
    *.pem | *.key | id_rsa | id_ed25519) block "$file" "looks like a private key file" ;;
  esac

  content=$(git show ":$file" 2>/dev/null | LC_ALL=C tr -d '\0') || continue
  if grep -qE -- '-----BEGIN [A-Z ]*PRIVATE KEY-----' <<<"$content"; then
    block "$file" "contains a private key"
  fi
  # A real bcrypt hash (e.g. ADMIN_PASSWORD_HASH); the placeholder in .env.example doesn't match.
  if grep -qE '\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}' <<<"$content"; then
    block "$file" "contains a bcrypt hash"
  fi
done < <(git diff --cached --name-only --diff-filter=ACMR -z)

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --no-banner --redact || fail=1
fi

exit "$fail"
