# Database Design V1

## 1. Overview

The database uses PostgreSQL to store note metadata, tags, tag relations, and admin sessions.

The main note content is not stored in the database. Note content is stored as a markdown file on the filesystem, in a folder named after the note's UUID.

Each note has its own folder containing the markdown file and assets such as images.

---

## 2. Tables

### 2.1 notes

The `notes` table stores note metadata.

| Column | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | Primary Key | Unique identifier for the note |
| title | TEXT | NOT NULL | Note title shown on the homepage |
| markdown_file_path | TEXT | NOT NULL | Path to the note's markdown file |
| is_published | BOOLEAN | NOT NULL, DEFAULT true | Whether the note is publicly visible |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When the note was created |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When the note was last modified |

---

### 2.2 tags

The `tags` table stores note categories, such as `work`, `study`, `explore`, and so on.

| Column | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | Primary Key | Unique identifier for the tag |
| name | TEXT | NOT NULL, UNIQUE | Tag name |

---

### 2.3 note_tags

The `note_tags` table links notes to tags.

| Column | Type | Constraint | Description |
|---|---|---|---|
| note_id | UUID | Foreign Key to notes.id | Note ID |
| tag_id | UUID | Foreign Key to tags.id | Tag ID |

Primary key:

| Column |
|---|
| note_id |
| tag_id |

---

### 2.4 admin_sessions

The `admin_sessions` table stores admin login sessions.

The admin password is not stored in the database. The admin password hash is stored in a server environment variable.

| Column | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | Primary Key | Unique identifier for the session |
| session_token_hash | TEXT | NOT NULL, UNIQUE | Hash of the session token |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When the session was created |
| expires_at | TIMESTAMPTZ | NOT NULL | When the session expires |
