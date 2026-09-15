# Markdown Notes App

Aplikasi notes/blog Markdown dengan halaman publik minimalis dan panel admin. Stack: Next.js, Go, PostgreSQL, filesystem storage, Docker Compose, dan Nginx.

## Menjalankan dengan Docker

1. Salin konfigurasi: `cp .env.example .env`.
2. Buat hash password: `make hash-password`, lalu ganti seluruh baris `ADMIN_PASSWORD_HASH` di `.env` dengan hasilnya. Tanda petik tunggal wajib dipertahankan agar `$` pada bcrypt tidak diinterpretasikan Docker Compose.
3. Ganti `POSTGRES_PASSWORD` di `.env`.
4. Jalankan aplikasi: `make dev`.
5. Buka `http://localhost:8080`; panel admin tersedia di `/admin`.

Migrasi berjalan otomatis sebelum API dimulai. PostgreSQL dan API tidak membuka port langsung ke host.

## Development tanpa Docker

Jalankan PostgreSQL, atur `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, dan `STORAGE_DIR`, lalu:

```sh
psql "$DATABASE_URL" -f services/api/migrations/001_init.sql
cd services/api && go run ./cmd/server
cd apps/web && npm install && npm run dev
```

Frontend development berjalan di `http://localhost:3000`, API di `http://localhost:8080`. Untuk mode tanpa Docker, ubah `ALLOWED_ORIGIN` menjadi `http://localhost:3000`; nilai default `http://localhost:8080` ditujukan untuk akses melalui Nginx pada `make dev`.

## Perintah

- `make test`: test backend.
- `make lint`: lint frontend.
- `make build`: build image aplikasi.
- `make logs`: ikuti log container.
- `make down`: hentikan aplikasi.
- `./scripts/backup.sh`: backup database dan notes storage.

## Production

Isi `DOMAIN`, gunakan password database yang kuat, set lokasi sertifikat Let's Encrypt, lalu jalankan:

```sh
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

Konfigurasi production mengaktifkan HTTPS, secure cookie, redirect HTTP, security headers, dan hanya mengekspos port 80/443. Backup harus selalu mencakup database dan volume notes.
