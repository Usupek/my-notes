# SRD V1 - Markdown Notes App

## 1. Objective

Build a markdown-based notes/blog app that the public can read and the admin can manage through an admin panel.

The app is a learning project for full-stack engineering and DevSecOps using Next.js, Go, PostgreSQL, Docker, Nginx, and HTTPS.

A WhatsApp bot integration is planned as a follow-up feature in V1.1, once the core notes app is stable.

---

## 2. Users

### 2.1 Me/Admin

The admin is the owner of the app and manages notes through the admin panel.

### 2.2 Public Visitors

Public visitors are general visitors who can only read published notes.

---

## 3. Functional Requirements

### 3.1 Admin

The admin can:

- Log in to the admin panel.
- Create a new note.
- Edit an existing note.
- Delete a note.
- Import a note from a markdown file.
- See a live markdown preview while creating or editing a note.
- Log out of the admin panel.

Each note has the following data:

- ID
- Title
- Slug
- Markdown content
- Excerpt
- Published status
- Created at
- Updated at

### 3.2 Public Visitors

Public visitors can:

- See the list of notes.
- See note titles.
- Open a note's detail page.
- See markdown content rendered as safe HTML.

---

## 4. Non-Functional Requirements

### 4.1 Technology Requirements

- The frontend uses Next.js.
- The backend uses Go.
- The database uses PostgreSQL.
- The app runs on Docker.
- Production uses Nginx as a reverse proxy.
- Production uses HTTPS.
- The project uses a Makefile to simplify development, testing, build, migration, and deployment commands.

### 4.2 Security Requirements

- The admin password must not be stored in plaintext.
- The admin password hash is stored in a server environment variable.
- The admin must log in before accessing note CRUD features.
- The admin session must use a cookie with the HttpOnly, Secure, and SameSite attributes.
- Admin login must be protected against brute force with rate limiting.
- All database queries must use parameterized queries to prevent SQL injection.
- Markdown must be rendered safely to prevent XSS.
- Raw HTML from markdown must not be executed directly in the browser.
- Secrets must not be stored in the Git repository.
- The database must not be exposed directly to the internet.
- The database may only be accessed by the backend over the internal Docker network.

### 4.3 Markdown Import Requirements

The admin can import markdown files under the following rules:

- Only files with the `.md` extension are accepted.
- Markdown file size must be limited.
- File names must be validated and normalized.
- Files with suspicious names such as `file.php.md` must be rejected or handled safely.
- Markdown file content is stored as markdown text.
- Markdown content must be sanitized or rendered safely before it is shown to public visitors.

### 4.4 Operational Requirements

- The app must have a health check endpoint.
- The backend must have basic logging.
- The database must use a persistent volume.
- Production deployment must be runnable with Docker Compose.
- Nginx only exposes ports 80 and 443 to the internet.
- The backend, frontend, and database must not be exposed to the internet except through Nginx.

---

## 5. Out of Scope V1

The following features are not part of V1:

- Multi-user login.
- Register/login for public users.
- Comment system.
- Rich text editor.
- Analytics.
- Image upload.
- Tag system.
- Full-text search.
- WhatsApp bot integration.

---

## 6. Planned Feature V1.1

### WhatsApp Bot Integration

In V1.1, the app is planned to have a WhatsApp bot integration.

Possible WhatsApp bot features:

- The admin can send a note via WhatsApp.
- The bot can save certain messages as draft notes.
- The bot can fetch the list of notes.
- The bot can search notes by keyword.

Detailed WhatsApp bot requirements will be written in SRD V1.1.
