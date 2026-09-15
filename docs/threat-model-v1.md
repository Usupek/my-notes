# Threat Model V1 - Markdown Notes App

## 1. Overview

Dokumen ini menjelaskan threat model dan security plan untuk Markdown Notes App V1.

Aplikasi ini adalah notes/blog berbasis markdown yang dapat dibaca oleh public visitors dan dikelola oleh admin melalui admin panel.

Aplikasi menggunakan:

- Next.js untuk frontend.
- Go untuk backend API.
- PostgreSQL untuk metadata notes, tags, dan admin sessions.
- Filesystem storage untuk file markdown dan gambar.
- Docker untuk containerization.
- Nginx untuk reverse proxy dan HTTPS di production.

Konten note tidak disimpan langsung di database. Konten note disimpan sebagai file markdown di filesystem. Database hanya menyimpan metadata note.

---

## 2. System Context

### 2.1 Runtime Architecture

```txt
User / Browser
      |
      | HTTPS
      v
Nginx Reverse Proxy
      |
      |-- "/" --------> Next.js Frontend
      |
      |-- "/api/*" ---> Go Backend API
                            |
                            |-- PostgreSQL
                            |
                            |-- Notes Storage Directory
```

### 2.2 Storage Architecture

```txt
PostgreSQL:
- notes metadata
- tags
- note_tags
- admin_sessions

Filesystem:
- markdown files
- note images/assets
```

Example filesystem structure:

```txt
data/
  notes/
    {note_id}/
      {note_id}-note.md
      images/
        diagram.png
        screenshot.jpg
```

---

## 3. Security Goals

Tujuan keamanan utama aplikasi:

1. Public visitor hanya dapat membaca notes yang published.
2. Admin harus login sebelum melakukan create, update, delete, import, dan upload asset.
3. Password admin tidak boleh disimpan dalam plaintext.
4. Session admin harus aman dari pencurian dan penyalahgunaan.
5. Markdown tidak boleh menyebabkan XSS.
6. File upload tidak boleh menyebabkan remote code execution, path traversal, atau file disclosure.
7. Database tidak boleh terekspos langsung ke internet.
8. Secret tidak boleh masuk ke Git repository.
9. Data notes, gambar, dan metadata harus dapat dibackup dan direstore.
10. Production traffic harus menggunakan HTTPS.

---

## 4. Assets

Assets yang harus dilindungi:

| Asset | Description |
|---|---|
| Admin password hash | Hash password admin yang disimpan di environment variable server |
| Admin session token | Token session admin yang dikirim melalui cookie |
| Admin session token hash | Hash session token yang disimpan di database |
| Markdown notes | File `.md` yang berisi konten utama note |
| Note images/assets | Gambar yang berhubungan dengan note |
| PostgreSQL database | Metadata notes, tags, note_tags, dan admin_sessions |
| Notes storage directory | Folder persistent yang menyimpan markdown dan images |
| Environment variables | Secret seperti database password dan admin password hash |
| Production server | VPS atau server tempat aplikasi berjalan |
| Docker volumes | Persistent volume untuk database dan notes storage |
| Nginx configuration | Konfigurasi reverse proxy, HTTPS, dan security headers |

---

## 5. Users and Actors

### 5.1 Legitimate Actors

| Actor | Description |
|---|---|
| Public Visitor | User umum yang hanya membaca notes |
| Admin | Pemilik aplikasi yang dapat login dan mengelola notes |
| Backend API | Service Go yang mengelola business logic, database, dan filesystem |
| Frontend App | Next.js app yang menampilkan UI |
| Nginx | Reverse proxy dan SSL termination |

### 5.2 Potential Threat Actors

| Actor | Description |
|---|---|
| Anonymous attacker | Orang dari internet yang mencoba menyerang aplikasi |
| Bot/script | Automated bot yang mencoba brute force login atau scan endpoint |
| Malicious visitor | Visitor yang mencoba exploit public endpoint |
| Compromised admin browser | Browser admin yang terkena malware atau extension berbahaya |
| Accidental admin mistake | Kesalahan admin seperti upload file salah atau salah konfigurasi server |

---

## 6. Trust Boundaries

### 6.1 Public Internet to Nginx

Semua request dari internet harus masuk melalui Nginx.

Rules:

- Production harus menggunakan HTTPS.
- Port public hanya 80 dan 443.
- Request HTTP harus redirect ke HTTPS.
- Nginx meneruskan request ke frontend atau backend sesuai path.

---

### 6.2 Nginx to Frontend

Nginx meneruskan request halaman web ke Next.js frontend.

Examples:

```txt
/              -> Next.js
/notes/:id     -> Next.js
/admin         -> Next.js
```

Security concern:

- Frontend tidak boleh menyimpan secret.
- Frontend tidak boleh punya akses langsung ke database.
- Frontend tidak boleh membaca filesystem storage secara langsung.

---

### 6.3 Nginx to Backend API

Nginx meneruskan request API ke Go backend.

Examples:

```txt
/api/v1/notes
/api/v1/admin/login
/api/v1/admin/notes
```

Security concern:

- Backend harus validasi semua input.
- Backend harus melakukan authentication dan authorization.
- Backend harus mencegah SQL injection.
- Backend harus mencegah path traversal.
- Backend harus mengontrol akses ke markdown files dan assets.

---

### 6.4 Backend API to PostgreSQL

Backend adalah satu-satunya service yang boleh mengakses PostgreSQL.

Rules:

- PostgreSQL tidak boleh expose port ke internet di production.
- PostgreSQL hanya berada di Docker internal network.
- Query harus menggunakan parameterized query.
- Database credentials disimpan di environment variable server.

---

### 6.5 Backend API to Filesystem Storage

Backend membaca dan menulis file markdown serta images.

Rules:

- Backend hanya boleh mengakses notes storage directory.
- Backend tidak boleh serve arbitrary file.
- Path harus divalidasi dan dinormalisasi.
- Upload file harus divalidasi.
- Filesystem storage harus persistent.

---

## 7. Threats and Mitigations

---

## 7.1 Brute Force Admin Login

### Threat

Attacker mencoba menebak password admin dengan mengirim banyak request ke endpoint login.

Target endpoint:

```http
POST /api/v1/admin/login
```

### Impact

- Attacker berhasil login sebagai admin.
- Attacker dapat membuat, mengedit, atau menghapus notes.
- Attacker dapat upload file berbahaya.
- Attacker dapat mengubah konten public.

### Mitigation

- Gunakan password admin yang kuat.
- Password admin tidak disimpan plaintext.
- Simpan hash password admin di environment variable server.
- Gunakan rate limiting untuk endpoint login.
- Gunakan response error yang generic.
- Jangan bedakan error antara password salah dan user tidak ditemukan.
- Log failed login attempt tanpa mencatat password.
- Pertimbangkan temporary lockout jika terlalu banyak gagal login.

### Implementation Notes

Contoh error response:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid credentials"
  }
}
```

Jangan mengembalikan error seperti:

```txt
Password salah
Admin account ditemukan
Hash mismatch
```

---

## 7.2 Weak Admin Password Storage

### Threat

Password admin bocor karena disimpan dalam plaintext di `.env`, database, log, atau repository.

### Impact

- Admin account takeover.
- Full control terhadap notes.
- Potensi akses ke server lain jika password reused.

### Mitigation

- Jangan simpan password admin asli.
- Simpan hanya hash password admin.
- Gunakan algoritma hashing password yang aman seperti bcrypt atau Argon2id.
- Jangan log password.
- Jangan commit `.env`.
- Gunakan `.env.example` tanpa secret asli.

### Environment Variable

Gunakan:

```env
ADMIN_PASSWORD_HASH=...
```

Jangan gunakan:

```env
ADMIN_PASSWORD=my-secret-password
```

---

## 7.3 Session Hijacking

### Threat

Session token admin dicuri dan digunakan attacker untuk mengakses admin panel.

### Attack vectors:

- Network sniffing jika tidak memakai HTTPS.
- XSS yang mencuri session.
- Cookie tidak menggunakan atribut security.
- Session token bocor di log.
- Session token disimpan di database dalam plaintext.

### Impact

- Attacker bisa menjadi admin.
- Attacker bisa mengubah dan menghapus notes.
- Attacker bisa upload assets.

### Mitigation

- Production wajib HTTPS.
- Cookie session menggunakan `HttpOnly`.
- Cookie session menggunakan `Secure`.
- Cookie session menggunakan `SameSite`.
- Session token memiliki expiry.
- Database hanya menyimpan hash session token.
- Logout menghapus session dari database.
- Jangan log session token.
- Regenerate session saat login.

### Cookie Requirements

Production cookie:

```txt
HttpOnly
Secure
SameSite=Lax or Strict
Path=/
```

Example:

```http
Set-Cookie: admin_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400
```

---

## 7.4 Cross-Site Scripting from Markdown

### Threat

Attacker menyisipkan script berbahaya di markdown content.

Example malicious markdown:

```md
<script>alert("xss")</script>
```

Atau:

```md
<img src=x onerror=alert(1)>
```

### Impact

- Script berjalan di browser visitor.
- Session atau data user bisa dicuri.
- Public page menjadi malicious.
- Admin browser dapat diserang jika membuka preview markdown.

### Mitigation

- Jangan render raw HTML dari markdown.
- Gunakan markdown renderer yang aman.
- Gunakan sanitization.
- Jangan menggunakan `dangerouslySetInnerHTML` untuk markdown.
- Sanitasi URL pada link dan image.
- Blokir protocol berbahaya seperti `javascript:`.
- Preview markdown di admin juga harus aman.

### Frontend Requirements

Markdown renderer harus:

- Mendukung markdown basic.
- Mendukung GFM jika dibutuhkan.
- Menolak raw HTML.
- Melakukan sanitization.
- Memvalidasi link dan image URL.

---

## 7.5 SQL Injection

### Threat

Attacker mengirim input yang memanipulasi SQL query.

Example:

```txt
' OR '1'='1
```

Target input:

- Login payload.
- Note ID.
- Tag filter.
- Pagination.
- Create/update note.
- Tag names.

### Impact

- Data leak.
- Data corruption.
- Bypass authentication.
- Delete data.
- Database compromise.

### Mitigation

- Semua query harus menggunakan parameterized query.
- Jangan concatenate input user langsung ke SQL.
- Validasi UUID.
- Validasi pagination `page` dan `limit`.
- Validasi tag name.
- Batasi panjang input title dan tag.
- Gunakan database user dengan permission minimal.

### Bad Example

```go
query := "SELECT * FROM notes WHERE title = '" + title + "'"
```

### Good Example

```go
query := "SELECT * FROM notes WHERE title = $1"
rows, err := db.QueryContext(ctx, query, title)
```

---

## 7.6 Path Traversal

### Threat

Attacker mencoba membaca file di luar notes storage directory.

Example malicious request:

```http
GET /api/v1/notes/{id}/assets/../../../../.env
```

Atau filename upload:

```txt
../../evil.png
```

### Impact

- Secret `.env` bocor.
- File system server terbaca.
- Config production bocor.
- Private files dapat diakses.

### Mitigation

- Validasi filename.
- Tolak `..`, `/`, `\`, null byte, dan karakter berbahaya.
- Normalize path sebelum akses file.
- Setelah path dinormalisasi, pastikan final path tetap berada di dalam notes storage directory.
- Jangan menerima arbitrary path dari user.
- Asset endpoint hanya boleh membaca file dari folder `images` milik note.
- Markdown file path sebaiknya dibentuk oleh backend, bukan dari input user.

### Safe Path Rule

Backend harus membangun path seperti ini:

```txt
data/notes/{note_id}/images/{safe_filename}
```

Bukan menerima full path dari user.

---

## 7.7 Malicious Markdown File Import

### Threat

Admin import file markdown yang berbahaya, terlalu besar, atau memiliki nama file mencurigakan.

Examples:

```txt
evil.php.md
../../note.md
large-file.md
note.md%00.png
```

### Impact

- XSS saat markdown dirender.
- Storage penuh.
- Path traversal.
- File overwrite.
- Unexpected parser behavior.

### Mitigation

- Hanya menerima ekstensi `.md`.
- Tolak filename yang memiliki multiple dangerous extension seperti `.php.md`.
- Validasi ukuran file.
- Validasi MIME type jika memungkinkan.
- Normalize filename.
- Jangan gunakan nama file asli sebagai path final utama.
- Simpan file markdown sebagai `{note_id}-note.md`.
- Markdown tetap harus dirender secara aman.
- Batasi maksimum ukuran markdown berdasarkan config.

### Recommended Rule

Walaupun user upload file bernama:

```txt
my-note.md
```

Backend tetap menyimpan sebagai:

```txt
data/notes/{note_id}/{note_id}-note.md
```

---

## 7.8 Malicious Image Upload

### Threat

Attacker upload file berbahaya yang menyamar sebagai image.

Examples:

```txt
shell.php
shell.php.png
payload.svg
huge-image.jpg
../../avatar.png
```

### Impact

- File berbahaya tersimpan di server.
- Storage penuh.
- Browser menjalankan payload.
- Path traversal.
- File overwrite.

### Mitigation

- Hanya izinkan tipe file berikut:

```txt
.png
.jpg
.jpeg
.webp
.gif
```

- Jangan izinkan `.svg` untuk V1 karena bisa membawa script.
- Validasi extension.
- Validasi MIME type.
- Batasi ukuran file.
- Normalize filename.
- Tolak path traversal.
- Jangan execute uploaded file.
- Serve file dengan Content-Type yang benar.
- Gunakan `Content-Disposition` jika diperlukan.
- Jika filename sudah ada, rename otomatis atau reject.

### Recommended Allowed Image Types V1

```txt
.png
.jpg
.jpeg
.webp
.gif
```

---

## 7.9 Unauthorized Access to Draft Notes

### Threat

Public visitor mencoba membaca note yang belum published.

Example:

```http
GET /api/v1/notes/{draft_note_id}
```

### Impact

- Draft/private note bocor ke public.
- Konten yang belum siap publish dapat dibaca orang lain.

### Mitigation

- Public endpoint hanya mengembalikan note dengan `is_published = true`.
- Admin endpoint boleh membaca draft hanya jika session valid.
- Asset milik draft note tidak boleh bisa diakses dari public asset endpoint.
- Jangan expose draft note di public list.

### Public Endpoint Rule

```txt
GET /api/v1/notes
GET /api/v1/notes/:id
GET /api/v1/notes/:id/assets/:filename
```

harus selalu mengecek:

```txt
is_published = true
```

---

## 7.10 Insecure Direct Object Reference

### Threat

Attacker menebak UUID note atau asset URL untuk mengakses data yang tidak seharusnya.

### Impact

- Draft note terbaca.
- Asset dari draft note terbaca.
- Data leak.

### Mitigation

- UUID tetap harus dianggap sebagai identifier, bukan security boundary.
- Selalu cek authorization.
- Public hanya boleh mengakses published note.
- Admin endpoint harus membutuhkan valid session.
- Asset endpoint harus cek note ownership/status.

---

## 7.11 CSRF on Admin Actions

### Threat

Admin yang sedang login dipaksa browser-nya mengirim request berbahaya ke aplikasi.

Example:

Admin sedang login, lalu membuka website malicious yang membuat request:

```http
POST /api/v1/admin/notes
```

### Impact

- Note dibuat tanpa niat admin.
- Note diedit atau dihapus.
- Asset diupload atau dihapus.

### Mitigation

- Gunakan `SameSite=Lax` atau `SameSite=Strict` pada cookie.
- Validasi `Origin` atau `Referer` untuk endpoint admin mutation.
- Pertimbangkan CSRF token untuk POST, PUT, PATCH, DELETE.
- CORS tidak boleh wildcard untuk admin endpoint.
- Admin mutation harus hanya menerima `Content-Type` yang expected.

### Admin Mutation Endpoints

Endpoint berikut perlu proteksi CSRF:

```txt
POST   /api/v1/admin/notes
PUT    /api/v1/admin/notes/:id
DELETE /api/v1/admin/notes/:id
POST   /api/v1/admin/notes/import
POST   /api/v1/admin/notes/:id/assets
DELETE /api/v1/admin/notes/:id/assets/:filename
POST   /api/v1/admin/logout
```

---

## 7.12 CORS Misconfiguration

### Threat

CORS terlalu permisif sehingga origin tidak dikenal dapat mengakses API.

Example dangerous config:

```txt
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

### Impact

- Admin session bisa disalahgunakan dari origin lain.
- Browser dapat mengirim credential ke API dari website malicious.
- Data leak.

### Mitigation

- Production hanya allow domain frontend resmi.
- Jangan gunakan wildcard origin untuk credentialed requests.
- Batasi method yang diizinkan.
- Batasi headers yang diizinkan.
- Admin endpoint harus lebih ketat.

### Recommended Production CORS

```txt
Allowed Origin: https://your-domain.com
Allowed Methods: GET, POST, PUT, DELETE
Allowed Credentials: true
```

---

## 7.13 Database Exposure

### Threat

PostgreSQL dapat diakses langsung dari internet.

### Impact

- Database brute force.
- Data leak.
- Data corruption.
- Full data loss.

### Mitigation

- Jangan expose port PostgreSQL di production.
- PostgreSQL hanya berada di Docker internal network.
- Gunakan database password yang kuat.
- Gunakan user database dengan permission sesuai kebutuhan.
- Backup database secara rutin.
- Jangan gunakan default password.

### Production Rule

Jangan gunakan:

```yaml
ports:
  - "5432:5432"
```

untuk database di production.

---

## 7.14 Secret Leakage

### Threat

Secret bocor ke GitHub, log, Docker image, atau error response.

Secrets include:

- Admin password hash.
- Database password.
- Session secret.
- Environment variables.
- SSH keys.
- Registry tokens.

### Impact

- Account takeover.
- Database compromise.
- Server compromise.
- Supply chain risk.

### Mitigation

- `.env` harus masuk `.gitignore`.
- Gunakan `.env.example` tanpa secret asli.
- Gunakan GitHub Secrets untuk CI/CD.
- Jangan log environment variables.
- Jangan masukkan secret ke Docker image saat build.
- Rotate secret jika bocor.
- Jangan tampilkan stack trace di production response.

### `.gitignore` Requirement

```gitignore
.env
.env.*
!.env.example
```

---

## 7.15 Insecure Docker Configuration

### Threat

Container berjalan dengan privilege berlebihan atau expose port tidak perlu.

### Impact

- Container escape risk meningkat.
- Internal service terekspos.
- Attack surface membesar.

### Mitigation

- Jalankan container app sebagai non-root user jika memungkinkan.
- Expose hanya port yang dibutuhkan.
- Di production, hanya Nginx yang expose port 80 dan 443.
- Database tidak expose public port.
- Gunakan Docker internal network.
- Gunakan persistent volume untuk database dan notes storage.
- Jangan mount Docker socket ke container app.

### Production Exposure Rule

Public internet hanya boleh mengakses:

```txt
80
443
```

---

## 7.16 Missing HTTPS

### Threat

Aplikasi production berjalan tanpa HTTPS.

### Impact

- Password admin bisa disadap.
- Session token bisa dicuri.
- Traffic dimodifikasi oleh attacker.
- Cookie `Secure` tidak efektif tanpa HTTPS.

### Mitigation

- Gunakan HTTPS di production.
- Redirect HTTP ke HTTPS.
- Gunakan valid TLS certificate.
- Gunakan auto-renew certificate.
- Cookie admin harus `Secure`.

### Nginx Requirement

Nginx harus:

- Listen di port 80 untuk redirect.
- Listen di port 443 untuk HTTPS.
- Memiliki konfigurasi TLS certificate.
- Menambahkan security headers.

---

## 7.17 Missing Security Headers

### Threat

Browser tidak mendapat instruksi security tambahan.

### Impact

- Clickjacking.
- MIME sniffing.
- Referrer leakage.
- XSS impact lebih besar.

### Mitigation

Tambahkan security headers dari Nginx.

Recommended headers:

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

Optional, setelah stabil:

```nginx
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';" always;
```

---

## 7.18 Data Loss

### Threat

Database atau notes storage hilang.

Possible causes:

- VPS rusak.
- Docker volume terhapus.
- Human error.
- Bug delete note.
- Failed deployment.
- Disk penuh.

### Impact

- Notes hilang.
- Images hilang.
- Metadata dan filesystem tidak sinkron.
- Aplikasi tidak bisa berjalan normal.

### Mitigation

- PostgreSQL menggunakan persistent volume.
- Notes storage menggunakan persistent volume.
- Backup database secara rutin.
- Backup notes storage directory secara rutin.
- Test restore backup.
- Jangan hanya backup database.
- Jangan hanya backup folder notes.
- Monitor disk usage.

### Backup Requirement

Backup harus mencakup:

```txt
1. PostgreSQL database
2. Notes storage directory
```

---

## 7.19 Database and Filesystem Inconsistency

### Threat

Database menyimpan metadata note, tetapi file markdown hilang. Atau file markdown ada, tetapi metadata database hilang.

### Impact

- Note tidak bisa dibaca.
- Broken note detail page.
- Asset tidak ditemukan.
- Backup/restore sulit.

### Mitigation

- Create note harus dilakukan secara hati-hati.
- Jika pembuatan file gagal, jangan insert metadata.
- Jika insert metadata gagal, hapus folder yang sudah dibuat.
- Update note harus menjaga konsistensi file dan metadata.
- Delete note harus menghapus database dan folder.
- Readiness check bisa memeriksa akses storage directory.
- Tambahkan repair script di masa depan jika dibutuhkan.

### Create Note Safe Flow

```txt
1. Generate note UUID
2. Create note folder
3. Create images folder
4. Write markdown file
5. Insert metadata to database
6. Insert tags and note_tags
7. If DB insert fails, cleanup folder
```

### Delete Note Safe Flow

```txt
1. Delete metadata from database
2. Delete note folder from filesystem
3. If filesystem delete fails, log error
4. Optional: create cleanup job
```

---

## 7.20 Denial of Service

### Threat

Attacker mengirim request besar atau terlalu banyak request.

Targets:

- Login endpoint.
- Markdown import.
- Image upload.
- Public notes endpoint.
- Asset endpoint.

### Impact

- CPU tinggi.
- Memory penuh.
- Disk penuh.
- App lambat atau down.

### Mitigation

- Rate limit endpoint sensitif.
- Batasi request body size.
- Batasi ukuran markdown import.
- Batasi ukuran image upload.
- Batasi pagination limit.
- Nginx `client_max_body_size`.
- Timeout request.
- Logging untuk spike traffic.

### Required Limits

| Resource | Limit |
|---|---|
| Login requests | Rate limited |
| Markdown import size | Configurable |
| Image upload size | Configurable |
| List notes limit | Max page size |
| Request body | Limited by Nginx and backend |

---

## 7.21 Unsafe Error Handling

### Threat

Aplikasi mengembalikan error detail seperti stack trace, SQL error, path filesystem, atau environment value.

### Impact

- Internal structure bocor.
- Path server bocor.
- Query/database info bocor.
- Secret bisa bocor.

### Mitigation

- Production response harus generic.
- Detail error hanya masuk log server.
- Jangan tampilkan stack trace ke client.
- Jangan log password, session token, atau secret.
- Gunakan error code standar.

### Bad Error Response

```json
{
  "error": "open /app/data/notes/../../.env: permission denied"
}
```

### Good Error Response

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Internal server error"
  }
}
```

---

## 8. Endpoint Security Matrix

| Endpoint | Public | Auth Required | Main Risks | Required Protection |
|---|---:|---:|---|---|
| `GET /api/v1/notes` | Yes | No | DoS, invalid query | Pagination limit, input validation |
| `GET /api/v1/notes/:id` | Yes | No | Draft leak, invalid UUID | UUID validation, published check |
| `GET /api/v1/notes/:id/assets/:filename` | Yes | No | Path traversal, draft asset leak | Filename validation, published check |
| `GET /api/v1/tags` | Yes | No | DoS | Basic rate limit |
| `POST /api/v1/admin/login` | No | No | Brute force | Rate limit, generic error |
| `POST /api/v1/admin/logout` | No | Yes | CSRF | SameSite, Origin check |
| `GET /api/v1/admin/me` | No | Yes | Session abuse | Session validation |
| `GET /api/v1/admin/notes` | No | Yes | Draft leak | Session validation |
| `GET /api/v1/admin/notes/:id` | No | Yes | Draft leak | Session validation |
| `POST /api/v1/admin/notes` | No | Yes | CSRF, XSS, filesystem inconsistency | Session, CSRF protection, validation |
| `PUT /api/v1/admin/notes/:id` | No | Yes | CSRF, XSS, filesystem inconsistency | Session, CSRF protection, validation |
| `DELETE /api/v1/admin/notes/:id` | No | Yes | CSRF, data loss | Session, CSRF protection |
| `POST /api/v1/admin/notes/import` | No | Yes | Malicious file upload | File validation, size limit |
| `POST /api/v1/admin/notes/:id/assets` | No | Yes | Malicious upload, path traversal | File validation, size limit |
| `DELETE /api/v1/admin/notes/:id/assets/:filename` | No | Yes | CSRF, path traversal | Session, filename validation |
| `GET /api/v1/healthz` | Yes | No | Info leak | Minimal response |
| `GET /api/v1/readyz` | Yes/Internal | No | Info leak | Minimal response |

---

## 9. Validation Requirements

### 9.1 UUID Validation

All `:id` params must be valid UUID.

Invalid UUID should return:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid id"
  }
}
```

---

### 9.2 Note Validation

| Field | Rule |
|---|---|
| title | Required |
| title | Max 200 characters |
| content_markdown | Required |
| content_markdown | Max size from config |
| is_published | Boolean |
| tags | Optional array |
| tag name | Max 50 characters |
| tag name | Lowercase recommended |
| tag name | Only allowed characters: letters, numbers, dash, underscore |

---

### 9.3 Pagination Validation

| Field | Rule |
|---|---|
| page | Integer, minimum 1 |
| limit | Integer, minimum 1 |
| limit | Maximum configured value, example 50 |

---

### 9.4 Markdown File Import Validation

Rules:

- Extension must be `.md`.
- Reject suspicious names like `file.php.md`.
- Reject path traversal.
- Max file size from config.
- Store file as `{note_id}-note.md`.
- Do not execute file.
- Do not serve raw uploaded markdown as HTML.

---

### 9.5 Image Upload Validation

Rules:

- Allowed extension:

```txt
.png
.jpg
.jpeg
.webp
.gif
```

- Disallowed extension:

```txt
.svg
.php
.exe
.sh
.html
.js
```

- Reject suspicious names like:

```txt
shell.php.png
../../image.png
image.png%00.php
```

- Max file size from config.
- Validate MIME type if possible.
- Normalize filename.
- Prevent overwrite unless intentionally allowed.

---

## 10. Logging Requirements

Backend should log:

- Request method.
- Request path.
- Response status.
- Request duration.
- Failed login attempt.
- File upload failure.
- Database errors.
- Filesystem errors.
- Authentication failure.

Backend must not log:

- Admin password.
- Session token.
- Raw cookie value.
- Database password.
- Environment variables.
- Full secret values.

### Safe Login Failure Log

```txt
failed login attempt from ip=xxx.xxx.xxx.xxx
```

### Unsafe Login Failure Log

```txt
failed login password=admin123
```

---

## 11. Production Security Checklist

### 11.1 Application Security

```txt
[ ] Password admin disimpan sebagai hash.
[ ] Session token disimpan sebagai hash di database.
[ ] Session cookie menggunakan HttpOnly.
[ ] Session cookie menggunakan Secure di production.
[ ] Session cookie menggunakan SameSite.
[ ] Login endpoint memiliki rate limit.
[ ] Admin mutation endpoint memiliki CSRF protection atau Origin check.
[ ] Markdown renderer tidak menjalankan raw HTML.
[ ] Link dan image URL dalam markdown divalidasi.
[ ] Semua SQL query menggunakan parameterized query.
[ ] Error response production tidak membocorkan detail internal.
```

### 11.2 File Security

```txt
[ ] Markdown import hanya menerima .md.
[ ] Image upload hanya menerima tipe file yang diizinkan.
[ ] Ukuran file dibatasi.
[ ] Filename dinormalisasi.
[ ] Path traversal dicegah.
[ ] Backend tidak serve arbitrary file.
[ ] Asset draft note tidak bisa diakses public.
[ ] Notes storage menggunakan persistent volume.
```

### 11.3 Infrastructure Security

```txt
[ ] Production menggunakan HTTPS.
[ ] HTTP redirect ke HTTPS.
[ ] Nginx menambahkan security headers.
[ ] PostgreSQL tidak expose port ke internet.
[ ] Backend, frontend, dan database berada di Docker internal network.
[ ] Hanya Nginx expose port 80 dan 443.
[ ] .env tidak masuk Git.
[ ] Secret production tidak disimpan di repository.
[ ] Container app berjalan sebagai non-root user jika memungkinkan.
```

### 11.4 Operations Security

```txt
[ ] PostgreSQL dibackup.
[ ] Notes storage directory dibackup.
[ ] Restore backup pernah dites.
[ ] Disk usage dimonitor.
[ ] Logs dapat dicek saat incident.
[ ] Deployment memiliki rollback plan.
[ ] SSL certificate auto-renew.
```

---

## 12. Security Decisions for V1

### 12.1 Authentication Model

V1 menggunakan single admin authentication.

- Tidak ada multi-user login.
- Tidak ada register user.
- Password admin berasal dari owner aplikasi.
- Hash password admin disimpan di environment variable.
- Session admin disimpan di table `admin_sessions`.

---

### 12.2 Markdown Storage Model

V1 menggunakan filesystem untuk menyimpan markdown content.

Database hanya menyimpan metadata.

Pros:

- Cocok dengan konsep markdown-native.
- Mudah mengelompokkan note dan assets.
- Mudah backup folder notes.
- Struktur sederhana dan mudah dipahami.

Cons:

- Harus menjaga konsistensi database dan filesystem.
- Backup harus mencakup database dan storage directory.
- Search isi markdown lebih sulit.
- Scaling multi-server lebih sulit di masa depan.

---

### 12.3 Image Handling

V1 menyimpan image per note di folder:

```txt
data/notes/{note_id}/images/
```

Public image access melalui backend endpoint:

```http
GET /api/v1/notes/:id/assets/:filename
```

Admin upload image melalui:

```http
POST /api/v1/admin/notes/:id/assets
```

Backend harus validasi note status dan filename sebelum serve image.

---

### 12.4 Public Access Model

Public visitor dapat membaca:

- List published notes.
- Detail published note.
- Assets dari published note.
- Tags.

Public visitor tidak dapat:

- Membaca draft note.
- Membaca assets dari draft note.
- Create, update, delete note.
- Upload markdown.
- Upload image.
- Melihat admin session state.

---

## 13. Future Security Improvements

Fitur keamanan yang dapat ditambahkan setelah V1:

- CSRF token penuh untuk admin mutation endpoint.
- Content Security Policy yang lebih strict.
- Audit log untuk admin actions.
- Login attempt tracking dengan IP.
- Admin session management page.
- Automatic cleanup expired sessions.
- Virus scanning untuk uploaded files.
- Image re-encoding untuk menghapus metadata dan payload aneh.
- Object storage seperti S3/MinIO untuk assets.
- Full-text search dengan sanitization.
- Backup encryption.
- Monitoring dan alerting.
- Security scanning di CI/CD.
- Dependency vulnerability scanning.
- Container image scanning.

---

## 14. Incident Response Notes

### 14.1 If Admin Password Is Leaked

Steps:

1. Generate new admin password.
2. Generate new password hash.
3. Update production environment variable.
4. Restart backend service.
5. Delete all active admin sessions from database.
6. Review logs for suspicious actions.
7. Rotate related secrets if needed.

---

### 14.2 If Session Token Is Leaked

Steps:

1. Delete affected session from `admin_sessions`.
2. Delete all sessions if unsure.
3. Check logs for suspicious admin actions.
4. Ensure HTTPS and cookie security flags are active.
5. Investigate possible XSS or browser compromise.

---

### 14.3 If Database Is Exposed

Steps:

1. Immediately close public database port.
2. Rotate database password.
3. Check database logs.
4. Review data integrity.
5. Restore from backup if needed.
6. Rotate application secrets if exposure is suspected.

---

### 14.4 If Uploaded File Is Malicious

Steps:

1. Identify affected note and file.
2. Remove malicious file from storage.
3. Check whether file was accessed.
4. Review upload validation logic.
5. Add validation rule to prevent repeat incident.
6. Review logs for similar uploads.

---

### 14.5 If Data Is Lost

Steps:

1. Stop write operations if possible.
2. Identify whether loss is database, storage, or both.
3. Restore PostgreSQL backup.
4. Restore notes storage backup.
5. Verify consistency between database and filesystem.
6. Document root cause.
7. Improve backup or delete flow if needed.

---

## 15. Acceptance Criteria

Security plan V1 dianggap cukup jika:

```txt
[ ] Public hanya bisa membaca published notes.
[ ] Admin harus login sebelum CRUD notes.
[ ] Password admin tidak disimpan plaintext.
[ ] Session cookie memakai HttpOnly, Secure, dan SameSite di production.
[ ] Login endpoint memiliki rate limit.
[ ] SQL query menggunakan parameterized query.
[ ] Markdown tidak dirender sebagai raw HTML.
[ ] Markdown renderer memiliki sanitization.
[ ] Upload markdown dibatasi dan divalidasi.
[ ] Upload image dibatasi dan divalidasi.
[ ] Path traversal dicegah.
[ ] Database tidak exposed ke internet.
[ ] Notes storage menggunakan persistent volume.
[ ] Backup mencakup database dan notes storage.
[ ] Production menggunakan HTTPS.
[ ] Secret tidak masuk repository.
```
