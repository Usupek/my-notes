# Markdown Notes App

A Markdown notes/blog app with a minimal public site and an admin panel. Stack: Next.js, Go, PostgreSQL, filesystem storage, Docker Compose, and Nginx.

## Running with Docker

1. Copy the config: `cp .env.example .env`.
2. Generate a password hash: `make hash-password`, then replace the whole `ADMIN_PASSWORD_HASH` line in `.env` with the output. Keep the single quotes so Docker Compose does not interpret the `$` characters in the bcrypt hash.
3. Change `POSTGRES_PASSWORD` in `.env`.
4. Start the app: `make dev`.
5. Open `http://localhost:8080`; the admin panel is at `/admin`.

Migrations run automatically before the API starts. PostgreSQL and the API do not expose ports directly to the host.

## Development without Docker

Run PostgreSQL, set `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, and `STORAGE_DIR`, then:

```sh
psql "$DATABASE_URL" -f services/api/migrations/001_init.sql
cd services/api && go run ./cmd/server
cd apps/web && npm install && npm run dev
```

The frontend dev server runs on `http://localhost:3000` and the API on `http://localhost:8080`. Without Docker, set `ALLOWED_ORIGIN` to `http://localhost:3000`; the default `http://localhost:8080` is meant for access through Nginx with `make dev`.

## RSS

Published notes are available as an RSS feed at `/feed.xml` (latest 20 notes, full content). Absolute links in the feed use `SITE_URL`; in production it is set to `https://$DOMAIN` automatically. The "Subscribe RSS" button in the footer opens `/subscribe`, which explains how to add the feed in a reader on each platform.

## Commands

- `make test`: run backend tests.
- `make lint`: lint the frontend.
- `make build`: build the app images.
- `make logs`: follow container logs.
- `make down`: stop the app.
- `./scripts/backup.sh`: back up the database and notes storage.

## Production

Set `DOMAIN`, use a strong database password, set the Let's Encrypt certificate location, then run:

```sh
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

The production config enables HTTPS, secure cookies, HTTP redirects, security headers, and only exposes ports 80/443. Backups must always include both the database and the notes volume.
