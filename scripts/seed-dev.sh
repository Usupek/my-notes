#!/usr/bin/env bash
# Seed a few published dummy notes into a LOCAL stack via the admin API.
# Usage: ADMIN_PASSWORD=... make seed      (BASE_URL defaults to http://localhost:8080)
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
case "$BASE_URL" in
  http://localhost*|http://127.0.0.1*) ;;
  *) echo "Refusing to seed non-local BASE_URL: $BASE_URL" >&2; exit 1 ;;
esac

if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
  read -rsp "Admin password: " ADMIN_PASSWORD; echo
fi

jar="$(mktemp)"
trap 'rm -f "$jar"' EXIT

login_body="$(ADMIN_PASSWORD="$ADMIN_PASSWORD" python3 -c 'import json,os; print(json.dumps({"password": os.environ["ADMIN_PASSWORD"]}))')"
curl -fsS -c "$jar" -H "Content-Type: application/json" -d "$login_body" "$BASE_URL/api/v1/admin/login" >/dev/null \
  || { echo "Login failed" >&2; exit 1; }

create() {
  curl -fsS -b "$jar" -H "Content-Type: application/json" -d @- "$BASE_URL/api/v1/admin/notes" >/dev/null
  echo "  + $1"
}

echo "Seeding dummy notes into $BASE_URL"

create "Hello, world" <<'JSON'
{"title": "Hello, world", "is_published": true, "tags": ["dummy", "intro"],
 "content_markdown": "This is the first **dummy** note for local development.\n\nIf you can read this in an RSS reader, `/feed.xml` is working.\n\n- One\n- Two\n- Three\n"}
JSON

create "Learning Go: a quick goroutine" <<'JSON'
{"title": "Learning Go: a quick goroutine", "is_published": true, "tags": ["dummy", "go"],
 "content_markdown": "The simplest goroutine example:\n\n```go\npackage main\n\nimport \"fmt\"\n\nfunc main() {\n\tdone := make(chan struct{})\n\tgo func() {\n\t\tfmt.Println(\"hello from a goroutine\")\n\t\tclose(done)\n\t}()\n\t<-done\n}\n```\n\n> Remember: a goroutine without synchronization is a bug waiting to happen.\n"}
JSON

create "Editor comparison table" <<'JSON'
{"title": "Editor comparison table", "is_published": true, "tags": ["dummy", "tools"],
 "content_markdown": "| Editor | Config language | Rating |\n|---|---|---|\n| Neovim | Lua | ★★★★★ |\n| VS Code | JSON | ★★★★ |\n| Helix | TOML | ★★★★ |\n\n- [x] Tried\n- [ ] Not tried yet: Zed\n"}
JSON

create "Secret draft (must not appear in the feed)" <<'JSON'
{"title": "Secret draft (must not appear in the feed)", "is_published": false, "tags": ["dummy"],
 "content_markdown": "This note is a **draft**. If it shows up in `/feed.xml` or on a public page, that's a bug.\n"}
JSON

echo "Done. Open $BASE_URL and $BASE_URL/feed.xml"
