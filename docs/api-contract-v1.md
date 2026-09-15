# API Contract V1 - Markdown Notes App

## 1. Overview

API menggunakan REST dengan format JSON.

Base path:

```txt
/api/v1
```

Aplikasi menggunakan PostgreSQL untuk menyimpan metadata notes, tags, relasi tags, dan admin sessions.

Konten utama note tidak disimpan di database. Konten note disimpan sebagai file markdown di filesystem. Setiap note memiliki folder berdasarkan UUID.

Contoh struktur storage:

```txt
data/
  notes/
    {note_id}/
      {note_id}-note.md
      images/
        diagram.png
        screenshot.jpg
```

API tetap menerima dan mengembalikan `content_markdown`, tetapi backend akan membaca atau menulis data tersebut dari/ke file markdown.

---

## 2. Authentication

Admin authentication menggunakan session cookie.

Cookie name:

```txt
admin_session
```

Cookie admin session harus menggunakan atribut berikut di production:

```txt
HttpOnly
Secure
SameSite
```

Admin endpoint hanya dapat diakses jika request memiliki session cookie yang valid.

Session token asli hanya dikirim ke browser melalui cookie. Database hanya menyimpan hash dari session token.

---

## 3. Standard Response Format

### 3.1 Success Response

```json
{
  "data": {}
}
```

### 3.2 Error Response

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

### 3.3 Common Error Codes

```txt
VALIDATION_ERROR
UNAUTHENTICATED
FORBIDDEN
NOTE_NOT_FOUND
TAG_NOT_FOUND
ASSET_NOT_FOUND
INVALID_FILE_TYPE
FILE_TOO_LARGE
INTERNAL_SERVER_ERROR
```

---

# 4. Public Endpoints

## 4.1 Get Notes

```http
GET /api/v1/notes
```

Mengambil daftar notes yang sudah published.

Endpoint ini tidak mengembalikan isi markdown. Endpoint ini hanya mengembalikan metadata note untuk ditampilkan di homepage.

### Query Params

| Param | Required | Description |
|---|---|---|
| tag | No | Filter notes berdasarkan nama tag |
| page | No | Nomor halaman |
| limit | No | Jumlah data per halaman |

### Response 200

```json
{
  "data": [
    {
      "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
      "title": "Belajar Docker",
      "is_published": true,
      "created_at": "2026-05-21T10:00:00Z",
      "updated_at": "2026-05-21T10:00:00Z",
      "tags": [
        {
          "id": "1b3f1e6a-6f83-4f44-97c2-9d45f32b9a44",
          "name": "study"
        },
        {
          "id": "2b3f1e6a-6f83-4f44-97c2-9d45f32b9a55",
          "name": "devops"
        }
      ]
    }
  ]
}
```

---

## 4.2 Get Note Detail

```http
GET /api/v1/notes/:id
```

Mengambil detail note berdasarkan UUID.

Backend akan:

1. Mencari metadata note di database.
2. Mengecek apakah note published.
3. Membaca file markdown dari filesystem.
4. Mengembalikan metadata dan konten markdown.

### Response 200

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Belajar Docker",
    "content_markdown": "# Belajar Docker\n\nIni catatan belajar Docker.\n\n![Diagram](./images/diagram.png)",
    "asset_base_url": "/api/v1/notes/8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/assets",
    "is_published": true,
    "created_at": "2026-05-21T10:00:00Z",
    "updated_at": "2026-05-21T10:00:00Z",
    "tags": [
      {
        "id": "1b3f1e6a-6f83-4f44-97c2-9d45f32b9a44",
        "name": "study"
      }
    ]
  }
}
```

### Response 404

```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "Note not found"
  }
}
```

---

## 4.3 Get Note Asset

```http
GET /api/v1/notes/:id/assets/:filename
```

Mengambil asset atau gambar milik note.

Contoh:

```http
GET /api/v1/notes/8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/assets/diagram.png
```

Backend akan membaca file dari:

```txt
data/notes/{note_id}/images/{filename}
```

### Rules

- Asset hanya dapat diakses jika note published.
- Backend harus mencegah path traversal seperti `../../.env`.
- Backend hanya boleh membaca file dari folder note tersebut.
- File yang boleh di-serve hanya file image yang diizinkan.

Allowed image types V1:

```txt
.png
.jpg
.jpeg
.webp
.gif
```

### Response 200

Binary image response.

### Response 404

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset not found"
  }
}
```

---

## 4.4 Get Tags

```http
GET /api/v1/tags
```

Mengambil daftar tags.

### Response 200

```json
{
  "data": [
    {
      "id": "1b3f1e6a-6f83-4f44-97c2-9d45f32b9a44",
      "name": "work"
    },
    {
      "id": "2b3f1e6a-6f83-4f44-97c2-9d45f32b9a55",
      "name": "study"
    },
    {
      "id": "3b3f1e6a-6f83-4f44-97c2-9d45f32b9a66",
      "name": "explore"
    }
  ]
}
```

---

# 5. Admin Auth Endpoints

## 5.1 Admin Login

```http
POST /api/v1/admin/login
```

Login admin menggunakan password.

### Request

```json
{
  "password": "admin-password"
}
```

### Behavior

Backend akan:

1. Membandingkan password dengan hash password dari environment variable.
2. Jika valid, generate session token.
3. Hash session token.
4. Simpan hash session token ke table `admin_sessions`.
5. Kirim raw session token ke browser melalui cookie `admin_session`.

### Response 200

```json
{
  "data": {
    "message": "Login successful"
  }
}
```

### Response 401

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid password"
  }
}
```

---

## 5.2 Admin Logout

```http
POST /api/v1/admin/logout
```

Logout admin dan hapus session aktif.

Authentication required.

### Response 200

```json
{
  "data": {
    "message": "Logout successful"
  }
}
```

### Response 401

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Admin is not authenticated"
  }
}
```

---

## 5.3 Get Current Admin Session

```http
GET /api/v1/admin/me
```

Mengecek apakah admin sedang login.

Authentication required.

### Response 200

```json
{
  "data": {
    "authenticated": true
  }
}
```

### Response 401

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Admin is not authenticated"
  }
}
```

---

# 6. Admin Notes Endpoints

## 6.1 Get Admin Notes

```http
GET /api/v1/admin/notes
```

Mengambil semua notes untuk admin panel, termasuk draft atau unpublished notes.

Authentication required.

Endpoint ini hanya mengembalikan metadata, bukan isi markdown.

### Query Params

| Param | Required | Description |
|---|---|---|
| tag | No | Filter notes berdasarkan nama tag |
| page | No | Nomor halaman |
| limit | No | Jumlah data per halaman |

### Response 200

```json
{
  "data": [
    {
      "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
      "title": "Belajar Docker",
      "is_published": false,
      "created_at": "2026-05-21T10:00:00Z",
      "updated_at": "2026-05-21T10:00:00Z",
      "tags": [
        {
          "id": "1b3f1e6a-6f83-4f44-97c2-9d45f32b9a44",
          "name": "study"
        }
      ]
    }
  ]
}
```

---

## 6.2 Get Admin Note Detail

```http
GET /api/v1/admin/notes/:id
```

Mengambil detail note untuk admin panel.

Berbeda dari public endpoint, endpoint ini bisa membaca note walaupun `is_published = false`.

Authentication required.

Backend akan:

1. Mencari metadata note di database.
2. Membaca file markdown dari filesystem.
3. Mengembalikan metadata dan konten markdown.

### Response 200

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Belajar Docker",
    "content_markdown": "# Belajar Docker\n\nDraft note...",
    "asset_base_url": "/api/v1/notes/8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/assets",
    "is_published": false,
    "created_at": "2026-05-21T10:00:00Z",
    "updated_at": "2026-05-21T10:00:00Z",
    "tags": [
      {
        "id": "1b3f1e6a-6f83-4f44-97c2-9d45f32b9a44",
        "name": "study"
      }
    ]
  }
}
```

### Response 404

```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "Note not found"
  }
}
```

---

## 6.3 Create Note

```http
POST /api/v1/admin/notes
```

Membuat note baru.

Authentication required.

### Request

```json
{
  "title": "Belajar Docker",
  "content_markdown": "# Belajar Docker\n\nIni catatan belajar Docker.",
  "is_published": true,
  "tags": ["study", "devops"]
}
```

### Behavior

Backend akan:

1. Generate UUID note.
2. Membuat folder `data/notes/{note_id}`.
3. Membuat folder `data/notes/{note_id}/images`.
4. Membuat file `data/notes/{note_id}/{note_id}-note.md`.
5. Menulis `content_markdown` ke file markdown.
6. Menyimpan metadata note ke database.
7. Membuat tag jika belum ada.
8. Menyimpan relasi note dan tag ke table `note_tags`.

### Response 201

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Belajar Docker",
    "content_markdown": "# Belajar Docker\n\nIni catatan belajar Docker.",
    "asset_base_url": "/api/v1/notes/8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/assets",
    "is_published": true,
    "created_at": "2026-05-21T10:00:00Z",
    "updated_at": "2026-05-21T10:00:00Z",
    "tags": [
      {
        "id": "1b3f1e6a-6f83-4f44-97c2-9d45f32b9a44",
        "name": "study"
      },
      {
        "id": "2b3f1e6a-6f83-4f44-97c2-9d45f32b9a55",
        "name": "devops"
      }
    ]
  }
}
```

### Response 400

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid note payload"
  }
}
```

---

## 6.4 Update Note

```http
PUT /api/v1/admin/notes/:id
```

Mengedit note berdasarkan UUID.

Authentication required.

### Request

```json
{
  "title": "Belajar Docker Updated",
  "content_markdown": "# Belajar Docker Updated\n\nKonten baru.",
  "is_published": true,
  "tags": ["study", "devops"]
}
```

### Behavior

Backend akan:

1. Mencari metadata note di database.
2. Menulis ulang file markdown milik note.
3. Update metadata note di database.
4. Update relasi tags.
5. Update `updated_at`.

### Response 200

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Belajar Docker Updated",
    "content_markdown": "# Belajar Docker Updated\n\nKonten baru.",
    "asset_base_url": "/api/v1/notes/8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/assets",
    "is_published": true,
    "updated_at": "2026-05-21T11:00:00Z",
    "tags": [
      {
        "id": "1b3f1e6a-6f83-4f44-97c2-9d45f32b9a44",
        "name": "study"
      },
      {
        "id": "2b3f1e6a-6f83-4f44-97c2-9d45f32b9a55",
        "name": "devops"
      }
    ]
  }
}
```

### Response 404

```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "Note not found"
  }
}
```

---

## 6.5 Delete Note

```http
DELETE /api/v1/admin/notes/:id
```

Menghapus note berdasarkan UUID.

Authentication required.

### Behavior

Backend akan:

1. Menghapus metadata note dari database.
2. Menghapus relasi tag dari `note_tags`.
3. Menghapus folder note dari filesystem.

Jika penghapusan filesystem gagal, backend harus mencatat error di log.

### Response 200

```json
{
  "data": {
    "message": "Note deleted successfully"
  }
}
```

### Response 404

```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "Note not found"
  }
}
```

---

## 6.6 Import Markdown Note

```http
POST /api/v1/admin/notes/import
```

Mengimpor note dari file markdown.

Authentication required.

Content-Type:

```txt
multipart/form-data
```

### Form Fields

| Field | Required | Description |
|---|---|---|
| file | Yes | File markdown `.md` |
| title | No | Judul note. Jika kosong, backend dapat menggunakan nama file |
| is_published | No | Status publish note |
| tags | No | Daftar tag, contoh `study,devops` |

### Rules

- File harus berekstensi `.md`.
- File seperti `file.php.md` harus ditolak atau ditangani secara aman.
- Ukuran file markdown harus dibatasi.
- Nama file harus divalidasi dan dinormalisasi.
- Konten file markdown disimpan ke folder note.
- Konten markdown tidak boleh langsung dirender sebagai raw HTML di frontend.

### Response 201

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Imported Note",
    "content_markdown": "# Imported Note\n\nKonten dari file markdown.",
    "asset_base_url": "/api/v1/notes/8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/assets",
    "is_published": true,
    "created_at": "2026-05-21T10:00:00Z",
    "updated_at": "2026-05-21T10:00:00Z",
    "tags": [
      {
        "id": "1b3f1e6a-6f83-4f44-97c2-9d45f32b9a44",
        "name": "study"
      }
    ]
  }
}
```

---

# 7. Admin Asset Endpoints

## 7.1 Upload Note Asset

```http
POST /api/v1/admin/notes/:id/assets
```

Upload gambar atau asset untuk note.

Authentication required.

Content-Type:

```txt
multipart/form-data
```

### Form Fields

| Field | Required | Description |
|---|---|---|
| file | Yes | Image file |

Allowed file types:

```txt
.png
.jpg
.jpeg
.webp
.gif
```

### Behavior

Backend akan:

1. Mengecek note exists.
2. Validasi file extension.
3. Validasi ukuran file.
4. Normalisasi filename.
5. Simpan file ke `data/notes/{note_id}/images/{filename}`.
6. Return URL asset.

### Response 201

```json
{
  "data": {
    "filename": "diagram.png",
    "url": "/api/v1/notes/8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/assets/diagram.png",
    "markdown": "![diagram](/api/v1/notes/8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/assets/diagram.png)"
  }
}
```

### Response 400

```json
{
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "Invalid file type"
  }
}
```

---

## 7.2 Delete Note Asset

```http
DELETE /api/v1/admin/notes/:id/assets/:filename
```

Menghapus gambar atau asset dari note.

Authentication required.

### Behavior

Backend akan:

1. Mengecek note exists.
2. Validasi filename.
3. Menghapus file dari `data/notes/{note_id}/images/{filename}`.

### Response 200

```json
{
  "data": {
    "message": "Asset deleted successfully"
  }
}
```

### Response 404

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset not found"
  }
}
```

---

# 8. System Endpoints

## 8.1 Health Check

```http
GET /api/v1/healthz
```

Mengecek apakah backend hidup.

### Response 200

```json
{
  "status": "ok"
}
```

---

## 8.2 Readiness Check

```http
GET /api/v1/readyz
```

Mengecek apakah backend siap menerima request.

Readiness check harus memeriksa:

- Koneksi ke database.
- Akses ke notes storage directory.

### Response 200

```json
{
  "status": "ready"
}
```

### Response 503

```json
{
  "status": "not_ready"
}
```

---

# 9. Validation Rules

## 9.1 Note Validation

| Field | Rule |
|---|---|
| title | Required, max length 200 characters |
| content_markdown | Required, max size according to config |
| is_published | Boolean |
| tags | Optional, array of string |
| tags item | Lowercase recommended, max length 50 characters |

---

## 9.2 File Validation

### Markdown Import

```txt
Allowed extension: .md
Max size: configurable
Reject suspicious names: file.php.md
Reject path traversal
Normalize filename
```

### Image Upload

```txt
Allowed extensions: .png, .jpg, .jpeg, .webp, .gif
Max size: configurable
Reject path traversal
Normalize filename
```

---

# 10. Notes About Markdown Assets

Markdown file may reference images using relative path:

```md
![Diagram](./images/diagram.png)
```

Frontend should render relative image paths using `asset_base_url`.

Example:

```txt
./images/diagram.png
```

becomes:

```txt
/api/v1/notes/{note_id}/assets/diagram.png
```

Alternative:

Admin asset upload endpoint can return a ready-to-use markdown image syntax:

```md
![diagram](/api/v1/notes/{note_id}/assets/diagram.png)
```

---

# 11. Storage Rules

Each note must have its own folder.

Required structure:

```txt
data/
  notes/
    {note_id}/
      {note_id}-note.md
      images/
```

Example:

```txt
data/
  notes/
    8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/
      8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12-note.md
      images/
        diagram.png
        screenshot.jpg
```

Rules:

- Backend is responsible for creating note folders.
- Backend is responsible for reading and writing markdown files.
- Backend must prevent access outside the note folder.
- Backend must validate all filenames.
- Backend must not serve arbitrary files from the server.
- Notes storage directory must be mounted as persistent volume in Docker.

---

# 12. Docker Storage Requirement

Because note content and images are stored in the filesystem, production must use persistent volume.

Example:

```yaml
services:
  api:
    volumes:
      - notes_storage:/app/data/notes

volumes:
  notes_storage:
```

Backup production harus mencakup:

```txt
1. PostgreSQL database
2. Notes storage directory
```
