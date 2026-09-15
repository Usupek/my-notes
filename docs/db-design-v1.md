# Database Design V1

## 1. Overview

Database menggunakan PostgreSQL untuk menyimpan metadata notes, tags, relasi tags, dan admin sessions.

Isi utama note tidak disimpan di database. Konten note disimpan sebagai file markdown di filesystem dalam folder berdasarkan UUID note.

Setiap note memiliki folder sendiri yang berisi file markdown dan assets seperti gambar.

---

## 2. Tables

### 2.1 notes

Table `notes` digunakan untuk menyimpan metadata note.

| Column | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | Primary Key | Unique identifier untuk note |
| title | TEXT | NOT NULL | Judul note yang ditampilkan di homepage |
| markdown_file_path | TEXT | NOT NULL | Path file markdown milik note |
| is_published | BOOLEAN | NOT NULL, DEFAULT true | Status apakah note dapat dilihat public |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu note dibuat |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu note terakhir diubah |

---

### 2.2 tags

Table `tags` digunakan untuk menyimpan kategori note, seperti `work`, `study`, `explore`, dan lainnya.

| Column | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | Primary Key | Unique identifier untuk tag |
| name | TEXT | NOT NULL, UNIQUE | Nama tag |

---

### 2.3 note_tags

Table `note_tags` digunakan untuk menghubungkan notes dengan tags.

| Column | Type | Constraint | Description |
|---|---|---|---|
| note_id | UUID | Foreign Key to notes.id | ID note |
| tag_id | UUID | Foreign Key to tags.id | ID tag |

Primary key:

| Column |
|---|
| note_id |
| tag_id |

---

### 2.4 admin_sessions

Table `admin_sessions` digunakan untuk menyimpan session login admin.

Password admin tidak disimpan di database. Hash password admin disimpan di environment variable server.

| Column | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | Primary Key | Unique identifier untuk session |
| session_token_hash | TEXT | NOT NULL, UNIQUE | Hash dari session token |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu session dibuat |
| expires_at | TIMESTAMPTZ | NOT NULL | Waktu session expired |
