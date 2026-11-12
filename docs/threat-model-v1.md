# Threat Model V1 - Markdown Notes App

## 1. Overview

This document describes the threat model and security plan for Markdown Notes App V1.

The app is a markdown-based notes/blog that public visitors can read and the admin manages through an admin panel.

The app uses:

- Next.js for the frontend.
- Go for the backend API.
- PostgreSQL for note metadata, tags, and admin sessions.
- Filesystem storage for markdown files and images.
- Docker for containerization.
- Nginx as reverse proxy and for HTTPS in production.

Note content is not stored directly in the database. It is stored as markdown files on the filesystem. The database only stores note metadata.

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

The app's main security goals:

1. Public visitors can only read published notes.
2. The admin must log in before creating, updating, deleting, importing, or uploading assets.
3. The admin password must not be stored in plaintext.
4. The admin session must be safe from theft and misuse.
5. Markdown must not cause XSS.
6. File uploads must not cause remote code execution, path traversal, or file disclosure.
7. The database must not be exposed directly to the internet.
8. Secrets must not end up in the Git repository.
9. Notes, images, and metadata must be backed up and restorable.
10. Production traffic must use HTTPS.

---

## 4. Assets

Assets that must be protected:

| Asset | Description |
|---|---|
| Admin password hash | Admin password hash stored in a server environment variable |
| Admin session token | Admin session token sent via cookie |
| Admin session token hash | Session token hash stored in the database |
| Markdown notes | `.md` files containing the main note content |
| Note images/assets | Images belonging to a note |
| PostgreSQL database | Note metadata, tags, note_tags, and admin_sessions |
| Notes storage directory | Persistent folder holding markdown and images |
| Environment variables | Secrets such as the database password and admin password hash |
| Production server | The VPS or server running the app |
| Docker volumes | Persistent volumes for the database and notes storage |
| Nginx configuration | Reverse proxy, HTTPS, and security header configuration |

---

## 5. Users and Actors

### 5.1 Legitimate Actors

| Actor | Description |
|---|---|
| Public Visitor | A general user who only reads notes |
| Admin | The app owner who can log in and manage notes |
| Backend API | Go service handling business logic, the database, and the filesystem |
| Frontend App | Next.js app that renders the UI |
| Nginx | Reverse proxy and SSL termination |

### 5.2 Potential Threat Actors

| Actor | Description |
|---|---|
| Anonymous attacker | Someone on the internet trying to attack the app |
| Bot/script | Automated bot attempting login brute force or endpoint scanning |
| Malicious visitor | A visitor trying to exploit public endpoints |
| Compromised admin browser | The admin's browser infected by malware or a malicious extension |
| Accidental admin mistake | Admin errors such as uploading the wrong file or misconfiguring the server |

---

## 6. Trust Boundaries

### 6.1 Public Internet to Nginx

All requests from the internet must go through Nginx.

Rules:

- Production must use HTTPS.
- The only public ports are 80 and 443.
- HTTP requests must redirect to HTTPS.
- Nginx forwards requests to the frontend or backend based on path.

---

### 6.2 Nginx to Frontend

Nginx forwards web page requests to the Next.js frontend.

Examples:

```txt
/              -> Next.js
/notes/:id     -> Next.js
/admin         -> Next.js
```

Security concern:

- The frontend must not hold secrets.
- The frontend must not have direct database access.
- The frontend must not read filesystem storage directly.

---

### 6.3 Nginx to Backend API

Nginx forwards API requests to the Go backend.

Examples:

```txt
/api/v1/notes
/api/v1/admin/login
/api/v1/admin/notes
```

Security concern:

- The backend must validate all input.
- The backend must perform authentication and authorization.
- The backend must prevent SQL injection.
- The backend must prevent path traversal.
- The backend must control access to markdown files and assets.

---

### 6.4 Backend API to PostgreSQL

The backend is the only service allowed to access PostgreSQL.

Rules:

- PostgreSQL must not expose a port to the internet in production.
- PostgreSQL lives only on the internal Docker network.
- Queries must be parameterized.
- Database credentials are stored in server environment variables.

---

### 6.5 Backend API to Filesystem Storage

The backend reads and writes markdown files and images.

Rules:

- The backend may only access the notes storage directory.
- The backend must not serve arbitrary files.
- Paths must be validated and normalized.
- File uploads must be validated.
- Filesystem storage must be persistent.

---

## 7. Threats and Mitigations

---

## 7.1 Brute Force Admin Login

### Threat

An attacker tries to guess the admin password by sending many requests to the login endpoint.

Target endpoint:

```http
POST /api/v1/admin/login
```

### Impact

- The attacker logs in as admin.
- The attacker can create, edit, or delete notes.
- The attacker can upload malicious files.
- The attacker can change public content.

### Mitigation

- Use a strong admin password.
- The admin password is not stored in plaintext.
- Store the admin password hash in a server environment variable.
- Rate limit the login endpoint.
- Use generic error responses.
- Do not distinguish between a wrong password and a user not found.
- Log failed login attempts without logging the password.
- Consider a temporary lockout after too many failed logins.

### Implementation Notes

Example error response:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid credentials"
  }
}
```

Do not return errors such as:

```txt
Wrong password
Admin account found
Hash mismatch
```

---

## 7.2 Weak Admin Password Storage

### Threat

The admin password leaks because it is stored in plaintext in `.env`, the database, logs, or the repository.

### Impact

- Admin account takeover.
- Full control over notes.
- Potential access to other servers if the password is reused.

### Mitigation

- Do not store the real admin password.
- Store only the admin password hash.
- Use a secure password hashing algorithm such as bcrypt or Argon2id.
- Do not log passwords.
- Do not commit `.env`.
- Use `.env.example` without real secrets.

### Environment Variable

Use:

```env
ADMIN_PASSWORD_HASH=...
```

Do not use:

```env
ADMIN_PASSWORD=my-secret-password
```

---

## 7.3 Session Hijacking

### Threat

The admin session token is stolen and used by an attacker to access the admin panel.

### Attack vectors:

- Network sniffing when HTTPS is not used.
- XSS that steals the session.
- Cookie missing security attributes.
- Session token leaking into logs.
- Session token stored in plaintext in the database.

### Impact

- The attacker can become admin.
- The attacker can modify and delete notes.
- The attacker can upload assets.

### Mitigation

- Production must use HTTPS.
- The session cookie uses `HttpOnly`.
- The session cookie uses `Secure`.
- The session cookie uses `SameSite`.
- Session tokens expire.
- The database only stores the session token hash.
- Logout deletes the session from the database.
- Do not log session tokens.
- Regenerate the session on login.

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

An attacker injects a malicious script into markdown content.

Example malicious markdown:

```md
<script>alert("xss")</script>
```

Or:

```md
<img src=x onerror=alert(1)>
```

### Impact

- The script runs in the visitor's browser.
- Sessions or user data can be stolen.
- The public page becomes malicious.
- The admin's browser can be attacked when opening the markdown preview.

### Mitigation

- Do not render raw HTML from markdown.
- Use a safe markdown renderer.
- Use sanitization.
- Do not use `dangerouslySetInnerHTML` for markdown.
- Sanitize link and image URLs.
- Block dangerous protocols such as `javascript:`.
- The admin markdown preview must be safe too.

### Frontend Requirements

The markdown renderer must:

- Support basic markdown.
- Support GFM if needed.
- Reject raw HTML.
- Sanitize output.
- Validate link and image URLs.

---

## 7.5 SQL Injection

### Threat

An attacker sends input that manipulates a SQL query.

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

- All queries must be parameterized.
- Never concatenate user input directly into SQL.
- Validate UUIDs.
- Validate the `page` and `limit` pagination params.
- Validate tag names.
- Limit the length of title and tag input.
- Use a database user with minimal permissions.

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

An attacker tries to read files outside the notes storage directory.

Example malicious request:

```http
GET /api/v1/notes/{id}/assets/../../../../.env
```

Or an upload filename:

```txt
../../evil.png
```

### Impact

- `.env` secrets leak.
- The server filesystem is readable.
- Production config leaks.
- Private files become accessible.

### Mitigation

- Validate filenames.
- Reject `..`, `/`, `\`, null bytes, and other dangerous characters.
- Normalize the path before accessing the file.
- After normalizing, make sure the final path is still inside the notes storage directory.
- Never accept arbitrary paths from users.
- The asset endpoint may only read files from the note's `images` folder.
- The markdown file path should be built by the backend, not taken from user input.

### Safe Path Rule

The backend must build paths like this:

```txt
data/notes/{note_id}/images/{safe_filename}
```

Rather than accepting a full path from the user.

---

## 7.7 Malicious Markdown File Import

### Threat

The admin imports a markdown file that is malicious, too large, or has a suspicious file name.

Examples:

```txt
evil.php.md
../../note.md
large-file.md
note.md%00.png
```

### Impact

- XSS when the markdown is rendered.
- Storage fills up.
- Path traversal.
- File overwrite.
- Unexpected parser behavior.

### Mitigation

- Only accept the `.md` extension.
- Reject filenames with multiple dangerous extensions such as `.php.md`.
- Validate file size.
- Validate the MIME type where possible.
- Normalize filename.
- Do not use the original file name as the final storage path.
- Store the markdown file as `{note_id}-note.md`.
- Markdown must still be rendered safely.
- Cap the maximum markdown size via config.

### Recommended Rule

Even if the user uploads a file named:

```txt
my-note.md
```

The backend still stores it as:

```txt
data/notes/{note_id}/{note_id}-note.md
```

---

## 7.8 Malicious Image Upload

### Threat

An attacker uploads a malicious file disguised as an image.

Examples:

```txt
shell.php
shell.php.png
payload.svg
huge-image.jpg
../../avatar.png
```

### Impact

- A malicious file is stored on the server.
- Storage fills up.
- The browser executes the payload.
- Path traversal.
- File overwrite.

### Mitigation

- Only allow the following file types:

```txt
.png
.jpg
.jpeg
.webp
.gif
```

- Do not allow `.svg` in V1 because it can carry scripts.
- Validate the extension.
- Validate the MIME type.
- Limit file size.
- Normalize filename.
- Reject path traversal.
- Never execute uploaded files.
- Serve files with the correct Content-Type.
- Use `Content-Disposition` where needed.
- If the filename already exists, rename automatically or reject.

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

A public visitor tries to read an unpublished note.

Example:

```http
GET /api/v1/notes/{draft_note_id}
```

### Impact

- Draft/private notes leak to the public.
- Content not ready for publishing can be read by others.

### Mitigation

- Public endpoints only return notes with `is_published = true`.
- Admin endpoints may read drafts only with a valid session.
- Assets of draft notes must not be reachable through the public asset endpoint.
- Do not expose draft notes in the public list.

### Public Endpoint Rule

```txt
GET /api/v1/notes
GET /api/v1/notes/:id
GET /api/v1/notes/:id/assets/:filename
```

must always check:

```txt
is_published = true
```

---

## 7.10 Insecure Direct Object Reference

### Threat

An attacker guesses a note UUID or asset URL to access data they should not see.

### Impact

- Draft notes are readable.
- Draft note assets are readable.
- Data leak.

### Mitigation

- UUIDs must be treated as identifiers, not as a security boundary.
- Always check authorization.
- The public may only access published notes.
- Admin endpoints must require a valid session.
- The asset endpoint must check note ownership/status.

---

## 7.11 CSRF on Admin Actions

### Threat

A logged-in admin's browser is tricked into sending a malicious request to the app.

Example:

The admin is logged in and then opens a malicious website that sends:

```http
POST /api/v1/admin/notes
```

### Impact

- A note is created without the admin's intent.
- Notes are edited or deleted.
- Assets are uploaded or deleted.

### Mitigation

- Use `SameSite=Lax` or `SameSite=Strict` on the cookie.
- Validate `Origin` or `Referer` on admin mutation endpoints.
- Consider CSRF tokens for POST, PUT, PATCH, DELETE.
- CORS must not use a wildcard for admin endpoints.
- Admin mutations must only accept the expected `Content-Type`.

### Admin Mutation Endpoints

The following endpoints need CSRF protection:

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

CORS is too permissive, so unknown origins can access the API.

Example dangerous config:

```txt
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

### Impact

- The admin session can be abused from another origin.
- The browser can send credentials to the API from a malicious website.
- Data leak.

### Mitigation

- Production only allows the official frontend domain.
- Never use a wildcard origin for credentialed requests.
- Restrict allowed methods.
- Restrict allowed headers.
- Admin endpoints must be stricter.

### Recommended Production CORS

```txt
Allowed Origin: https://your-domain.com
Allowed Methods: GET, POST, PUT, DELETE
Allowed Credentials: true
```

---

## 7.13 Database Exposure

### Threat

PostgreSQL is reachable directly from the internet.

### Impact

- Database brute force.
- Data leak.
- Data corruption.
- Full data loss.

### Mitigation

- Do not expose the PostgreSQL port in production.
- PostgreSQL lives only on the internal Docker network.
- Use a strong database password.
- Use a database user with only the permissions it needs.
- Back up the database regularly.
- Do not use default passwords.

### Production Rule

Do not use:

```yaml
ports:
  - "5432:5432"
```

for the database in production.

---

## 7.14 Secret Leakage

### Threat

Secrets leak to GitHub, logs, Docker images, or error responses.

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

- `.env` must be in `.gitignore`.
- Use `.env.example` without real secrets.
- Use GitHub Secrets for CI/CD.
- Do not log environment variables.
- Do not bake secrets into Docker images at build time.
- Rotate secrets if they leak.
- Do not show stack traces in production responses.

### `.gitignore` Requirement

```gitignore
.env
.env.*
!.env.example
```

---

## 7.15 Insecure Docker Configuration

### Threat

Containers run with excessive privileges or expose unnecessary ports.

### Impact

- Increased container escape risk.
- Internal services are exposed.
- Larger attack surface.

### Mitigation

- Run app containers as a non-root user where possible.
- Expose only the ports that are needed.
- In production, only Nginx exposes ports 80 and 443.
- The database does not expose a public port.
- Use an internal Docker network.
- Use persistent volumes for the database and notes storage.
- Do not mount the Docker socket into app containers.

### Production Exposure Rule

The public internet may only access:

```txt
80
443
```

---

## 7.16 Missing HTTPS

### Threat

The production app runs without HTTPS.

### Impact

- The admin password can be intercepted.
- Session tokens can be stolen.
- Traffic can be modified by an attacker.
- The `Secure` cookie flag is ineffective without HTTPS.

### Mitigation

- Use HTTPS in production.
- Redirect HTTP to HTTPS.
- Use a valid TLS certificate.
- Auto-renew the certificate.
- The admin cookie must be `Secure`.

### Nginx Requirement

Nginx must:

- Listen on port 80 for redirects.
- Listen on port 443 for HTTPS.
- Have a TLS certificate configured.
- Add security headers.

---

## 7.17 Missing Security Headers

### Threat

The browser receives no additional security instructions.

### Impact

- Clickjacking.
- MIME sniffing.
- Referrer leakage.
- Greater XSS impact.

### Mitigation

Add security headers in Nginx.

Recommended headers:

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

Optional, once stable:

```nginx
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';" always;
```

---

## 7.18 Data Loss

### Threat

The database or notes storage is lost.

Possible causes:

- VPS failure.
- Docker volume deleted.
- Human error.
- A bug in note deletion.
- Failed deployment.
- Disk full.

### Impact

- Notes are lost.
- Images are lost.
- Metadata and filesystem get out of sync.
- The app cannot run normally.

### Mitigation

- PostgreSQL uses a persistent volume.
- Notes storage uses a persistent volume.
- Back up the database regularly.
- Back up the notes storage directory regularly.
- Test restoring backups.
- Do not back up only the database.
- Do not back up only the notes folder.
- Monitor disk usage.

### Backup Requirement

Backups must include:

```txt
1. PostgreSQL database
2. Notes storage directory
```

---

## 7.19 Database and Filesystem Inconsistency

### Threat

The database has note metadata but the markdown file is missing. Or the markdown file exists but the database metadata is missing.

### Impact

- The note cannot be read.
- Broken note detail page.
- Assets are not found.
- Backup/restore becomes difficult.

### Mitigation

- Note creation must be done carefully.
- If file creation fails, do not insert metadata.
- If the metadata insert fails, delete the folder that was created.
- Note updates must keep the file and metadata consistent.
- Note deletion must remove both the database row and the folder.
- The readiness check can verify access to the storage directory.
- Add a repair script in the future if needed.

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

An attacker sends very large requests or too many requests.

Targets:

- Login endpoint.
- Markdown import.
- Image upload.
- Public notes endpoint.
- Asset endpoint.

### Impact

- High CPU usage.
- Memory exhaustion.
- Disk full.
- The app becomes slow or goes down.

### Mitigation

- Rate limit sensitive endpoints.
- Limit request body size.
- Limit markdown import size.
- Limit image upload size.
- Cap the pagination limit.
- Nginx `client_max_body_size`.
- Request timeouts.
- Logging for traffic spikes.

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

The app returns error details such as stack traces, SQL errors, filesystem paths, or environment values.

### Impact

- Internal structure leaks.
- Server paths leak.
- Query/database info leaks.
- Secrets can leak.

### Mitigation

- Production responses must be generic.
- Error details only go to server logs.
- Do not show stack traces to clients.
- Do not log passwords, session tokens, or secrets.
- Use standard error codes.

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
[ ] The admin password is stored as a hash.
[ ] Session tokens are stored as hashes in the database.
[ ] The session cookie uses HttpOnly.
[ ] The session cookie uses Secure in production.
[ ] The session cookie uses SameSite.
[ ] The login endpoint is rate limited.
[ ] Admin mutation endpoints have CSRF protection or an Origin check.
[ ] The markdown renderer does not execute raw HTML.
[ ] Link and image URLs in markdown are validated.
[ ] All SQL queries are parameterized.
[ ] Production error responses do not leak internal details.
```

### 11.2 File Security

```txt
[ ] Markdown import only accepts .md.
[ ] Image upload only accepts allowed file types.
[ ] File size is limited.
[ ] Filenames are normalized.
[ ] Path traversal is prevented.
[ ] The backend does not serve arbitrary files.
[ ] Draft note assets are not publicly accessible.
[ ] Notes storage uses a persistent volume.
```

### 11.3 Infrastructure Security

```txt
[ ] Production uses HTTPS.
[ ] HTTP redirects to HTTPS.
[ ] Nginx adds security headers.
[ ] PostgreSQL does not expose a port to the internet.
[ ] Backend, frontend, and database are on an internal Docker network.
[ ] Only Nginx exposes ports 80 and 443.
[ ] .env is not committed to Git.
[ ] Production secrets are not stored in the repository.
[ ] App containers run as a non-root user where possible.
```

### 11.4 Operations Security

```txt
[ ] PostgreSQL is backed up.
[ ] The notes storage directory is backed up.
[ ] Backup restore has been tested.
[ ] Disk usage is monitored.
[ ] Logs can be inspected during an incident.
[ ] Deployments have a rollback plan.
[ ] The SSL certificate auto-renews.
```

---

## 12. Security Decisions for V1

### 12.1 Authentication Model

V1 uses single-admin authentication.

- No multi-user login.
- No user registration.
- The admin password comes from the app owner.
- The admin password hash is stored in an environment variable.
- Admin sessions are stored in the `admin_sessions` table.

---

### 12.2 Markdown Storage Model

V1 uses the filesystem to store markdown content.

The database only stores metadata.

Pros:

- Fits the markdown-native concept.
- Easy to group a note with its assets.
- Easy to back up the notes folder.
- Simple, easy-to-understand structure.

Cons:

- Database and filesystem must be kept consistent.
- Backups must include both the database and the storage directory.
- Searching markdown content is harder.
- Multi-server scaling is harder in the future.

---

### 12.3 Image Handling

V1 stores images per note in the folder:

```txt
data/notes/{note_id}/images/
```

Public image access goes through the backend endpoint:

```http
GET /api/v1/notes/:id/assets/:filename
```

The admin uploads images through:

```http
POST /api/v1/admin/notes/:id/assets
```

The backend must validate note status and filename before serving an image.

---

### 12.4 Public Access Model

Public visitors can read:

- List published notes.
- Detail published note.
- Assets of published notes.
- Tags.

Public visitors cannot:

- Read draft notes.
- Read assets of draft notes.
- Create, update, delete note.
- Upload markdown.
- Upload image.
- See the admin session state.

---

## 13. Future Security Improvements

Security features that can be added after V1:

- Full CSRF tokens for admin mutation endpoints.
- A stricter Content Security Policy.
- Audit log for admin actions.
- Login attempt tracking by IP.
- Admin session management page.
- Automatic cleanup expired sessions.
- Virus scanning for uploaded files.
- Image re-encoding to strip metadata and odd payloads.
- Object storage such as S3/MinIO for assets.
- Full-text search with sanitization.
- Backup encryption.
- Monitoring and alerting.
- Security scanning in CI/CD.
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

The V1 security plan is considered sufficient when:

```txt
[ ] The public can only read published notes.
[ ] The admin must log in before note CRUD.
[ ] The admin password is not stored in plaintext.
[ ] The session cookie uses HttpOnly, Secure, and SameSite in production.
[ ] The login endpoint is rate limited.
[ ] SQL queries are parameterized.
[ ] Markdown is not rendered as raw HTML.
[ ] The markdown renderer sanitizes output.
[ ] Markdown uploads are limited and validated.
[ ] Image uploads are limited and validated.
[ ] Path traversal is prevented.
[ ] The database is not exposed to the internet.
[ ] Notes storage uses a persistent volume.
[ ] Backups include the database and notes storage.
[ ] Production uses HTTPS.
[ ] Secrets are not in the repository.
```
