# SRD V1 - Markdown Notes App

## 1. Objective

Membuat aplikasi notes/blog berbasis markdown yang dapat dibaca oleh publik dan dikelola oleh admin melalui admin panel.

Aplikasi ini dibuat sebagai project pembelajaran full-stack engineering dan DevSecOps menggunakan Next.js, Go, PostgreSQL, Docker, Nginx, dan HTTPS.

Integrasi WhatsApp bot direncanakan sebagai fitur lanjutan pada V1.1 setelah fitur utama notes app stabil.

---

## 2. Users

### 2.1 Me/Admin

Admin adalah pemilik aplikasi yang dapat mengelola notes melalui admin panel.

### 2.2 Public Visitors

Public visitors adalah pengunjung umum yang hanya dapat membaca notes yang sudah dipublikasikan.

---

## 3. Functional Requirements

### 3.1 Admin

Admin dapat:

- Login ke admin panel.
- Membuat note baru.
- Mengedit note yang sudah ada.
- Menghapus note.
- Mengimpor note dari file markdown.
- Melihat live preview markdown saat membuat atau mengedit note.
- Logout dari admin panel.

Setiap note memiliki data berikut:

- ID
- Title
- Slug
- Markdown content
- Excerpt
- Published status
- Created at
- Updated at

### 3.2 Public Visitors

Public visitors dapat:

- Melihat daftar notes.
- Melihat judul notes.
- Membuka detail note.
- Melihat konten markdown yang sudah di-render menjadi HTML yang aman.

---

## 4. Non-Functional Requirements

### 4.1 Technology Requirements

- Frontend menggunakan Next.js.
- Backend menggunakan Go.
- Database menggunakan PostgreSQL.
- Aplikasi berjalan menggunakan Docker.
- Production menggunakan Nginx sebagai reverse proxy.
- Production menggunakan HTTPS.
- Project menggunakan Makefile untuk menyederhanakan command development, testing, build, migration, dan deployment.

### 4.2 Security Requirements

- Password admin tidak boleh disimpan dalam plaintext.
- Hash password admin disimpan di environment variable server.
- Admin harus login sebelum dapat mengakses fitur CRUD notes.
- Session admin harus menggunakan cookie dengan atribut HttpOnly, Secure, dan SameSite.
- Admin login harus dilindungi dari brute force menggunakan rate limiting.
- Semua query database harus menggunakan parameterized query untuk mencegah SQL injection.
- Markdown harus dirender secara aman untuk mencegah XSS.
- Raw HTML dari markdown tidak boleh langsung dieksekusi di browser.
- Secret tidak boleh disimpan di Git repository.
- Database tidak boleh terekspos langsung ke internet.
- Database hanya boleh diakses oleh backend melalui internal Docker network.

### 4.3 Markdown Import Requirements

Admin dapat mengimpor file markdown dengan aturan berikut:

- Hanya menerima file dengan ekstensi `.md`.
- Ukuran file markdown harus dibatasi.
- Nama file harus divalidasi dan dinormalisasi.
- File dengan nama mencurigakan seperti `file.php.md` harus ditolak atau ditangani secara aman.
- Konten file markdown disimpan sebagai text markdown.
- Konten markdown harus disanitasi atau dirender secara aman sebelum ditampilkan ke public visitors.

### 4.4 Operational Requirements

- Aplikasi harus memiliki health check endpoint.
- Backend harus memiliki basic logging.
- Database harus menggunakan persistent volume.
- Deployment production harus dapat dijalankan menggunakan Docker Compose.
- Nginx hanya membuka port 80 dan 443 ke internet.
- Backend, frontend, dan database tidak boleh langsung terekspos ke internet selain melalui Nginx.

---

## 5. Out of Scope V1

Fitur berikut tidak termasuk dalam V1:

- Multi-user login.
- Register/login untuk public user.
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

Pada V1.1, aplikasi direncanakan memiliki integrasi WhatsApp bot.

Kemungkinan fitur WhatsApp bot:

- Admin dapat mengirim note melalui WhatsApp.
- Bot dapat menyimpan pesan tertentu sebagai draft note.
- Bot dapat mengambil daftar notes.
- Bot dapat mencari note berdasarkan keyword.

Detail requirement WhatsApp bot akan dibuat di SRD V1.1.
