# API Contract V1 - Markdown Notes App

## 1. Overview

The API is REST with JSON payloads.

Base path:

```txt
/api/v1
```

The app uses PostgreSQL to store note metadata, tags, tag relations, and admin sessions.

The main note content is not stored in the database. Note content is stored as a markdown file on the filesystem. Each note has a folder named after its UUID.

Example storage layout:

```txt
data/
  notes/
    {note_id}/
      {note_id}-note.md
      images/
        diagram.png
        screenshot.jpg
```

The API still accepts and returns `content_markdown`, but the backend reads and writes that data from/to the markdown file.

---

## 2. Authentication

Admin authentication uses a session cookie.

Cookie name:

```txt
admin_session
```

In production, the admin session cookie must use the following attributes:

```txt
HttpOnly
Secure
SameSite
```

Admin endpoints can only be accessed when the request carries a valid session cookie.

The raw session token is only sent to the browser via the cookie. The database only stores a hash of the session token.

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

Fetches the list of published notes.

This endpoint does not return markdown content. It only returns note metadata for display on the homepage.

### Query Params

| Param | Required | Description |
|---|---|---|
| tag | No | Filter notes by tag name |
| page | No | Page number |
| limit | No | Items per page |

### Response 200

```json
{
  "data": [
    {
      "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
      "title": "Learning Docker",
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

Fetches a note's details by UUID.

The backend will:

1. Look up the note metadata in the database.
2. Check whether the note is published.
3. Read the markdown file from the filesystem.
4. Return the metadata and markdown content.

### Response 200

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Learning Docker",
    "content_markdown": "# Learning Docker\n\nThese are my notes on learning Docker.\n\n![Diagram](./images/diagram.png)",
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

Fetches an asset or image belonging to a note.

Example:

```http
GET /api/v1/notes/8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12/assets/diagram.png
```

The backend reads the file from:

```txt
data/notes/{note_id}/images/{filename}
```

### Rules

- Assets can only be accessed if the note is published.
- The backend must prevent path traversal such as `../../.env`.
- The backend may only read files from that note's folder.
- Only allowed image files may be served.

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

Fetches the list of tags.

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

Admin login uses a password.

### Request

```json
{
  "password": "admin-password"
}
```

### Behavior

The backend will:

1. Compare the password against the password hash from the environment variable.
2. If valid, generate a session token.
3. Hash the session token.
4. Store the session token hash in the `admin_sessions` table.
5. Send the raw session token to the browser via the `admin_session` cookie.

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

Logs the admin out and deletes the active session.

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

Checks whether the admin is logged in.

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

Fetches all notes for the admin panel, including drafts/unpublished notes.

Authentication required.

This endpoint only returns metadata, not markdown content.

### Query Params

| Param | Required | Description |
|---|---|---|
| tag | No | Filter notes by tag name |
| page | No | Page number |
| limit | No | Items per page |

### Response 200

```json
{
  "data": [
    {
      "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
      "title": "Learning Docker",
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

Fetches a note's details for the admin panel.

Unlike the public endpoint, this endpoint can read a note even when `is_published = false`.

Authentication required.

The backend will:

1. Look up the note metadata in the database.
2. Read the markdown file from the filesystem.
3. Return the metadata and markdown content.

### Response 200

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Learning Docker",
    "content_markdown": "# Learning Docker\n\nDraft note...",
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

Creates a new note.

Authentication required.

### Request

```json
{
  "title": "Learning Docker",
  "content_markdown": "# Learning Docker\n\nThese are my notes on learning Docker.",
  "is_published": true,
  "tags": ["study", "devops"]
}
```

### Behavior

The backend will:

1. Generate the note UUID.
2. Create the folder `data/notes/{note_id}`.
3. Create the folder `data/notes/{note_id}/images`.
4. Create the file `data/notes/{note_id}/{note_id}-note.md`.
5. Write `content_markdown` to the markdown file.
6. Save the note metadata to the database.
7. Create tags that do not exist yet.
8. Save the note–tag relations to the `note_tags` table.

### Response 201

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Learning Docker",
    "content_markdown": "# Learning Docker\n\nThese are my notes on learning Docker.",
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

Edits a note by UUID.

Authentication required.

### Request

```json
{
  "title": "Learning Docker Updated",
  "content_markdown": "# Learning Docker Updated\n\nNew content.",
  "is_published": true,
  "tags": ["study", "devops"]
}
```

### Behavior

The backend will:

1. Look up the note metadata in the database.
2. Rewrite the note's markdown file.
3. Update the note metadata in the database.
4. Update the tag relations.
5. Update `updated_at`.

### Response 200

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Learning Docker Updated",
    "content_markdown": "# Learning Docker Updated\n\nNew content.",
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

Deletes a note by UUID.

Authentication required.

### Behavior

The backend will:

1. Delete the note metadata from the database.
2. Delete the tag relations from `note_tags`.
3. Delete the note folder from the filesystem.

If deleting from the filesystem fails, the backend must log the error.

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

Imports a note from a markdown file.

Authentication required.

Content-Type:

```txt
multipart/form-data
```

### Form Fields

| Field | Required | Description |
|---|---|---|
| file | Yes | Markdown file `.md` |
| title | No | Note title. If empty, the backend may use the file name |
| is_published | No | Note publish status |
| tags | No | List of tags, e.g. `study,devops` |

### Rules

- The file must have the `.md` extension.
- Files such as `file.php.md` must be rejected or handled safely.
- Markdown file size must be limited.
- File names must be validated and normalized.
- The markdown file content is stored in the note folder.
- Markdown content must not be rendered directly as raw HTML on the frontend.

### Response 201

```json
{
  "data": {
    "id": "8b3f1e6a-6f83-4f44-97c2-9d45f32b9a12",
    "title": "Imported Note",
    "content_markdown": "# Imported Note\n\nContent from the markdown file.",
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

## 6.7 Pin / Unpin Note

```http
PUT /api/v1/admin/notes/:id/pin
```

Marks a note as pinned or unpinned. Does not change `updated_at`.

Authentication required.

### Request

```json
{
  "is_pinned": true
}
```

### Behavior

Notes with `is_pinned = true` always appear at the top of the note list (public and admin), followed by the most recently `updated_at`.

### Response 200

Returns the note object (without `content_markdown`) with the updated `is_pinned` field.

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

# 7. Admin Asset Endpoints

## 7.1 Upload Note Asset

```http
POST /api/v1/admin/notes/:id/assets
```

Uploads an image or asset for a note.

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

The backend will:

1. Check that the note exists.
2. Validate the file extension.
3. Validate the file size.
4. Normalize the filename.
5. Save the file to `data/notes/{note_id}/images/{filename}`.
6. Return the asset URL.

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

Deletes an image or asset from a note.

Authentication required.

### Behavior

The backend will:

1. Check that the note exists.
2. Validate the filename.
3. Delete the file from `data/notes/{note_id}/images/{filename}`.

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

Checks whether the backend is alive.

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

Checks whether the backend is ready to accept requests.

The readiness check must verify:

- Database connection.
- Access to the notes storage directory.

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

Production backups must include:

```txt
1. PostgreSQL database
2. Notes storage directory
```
