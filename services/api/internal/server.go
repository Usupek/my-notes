package internal

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const sessionCookie = "admin_session"

type Server struct {
	cfg     Config
	store   *Store
	limiter *loginLimiter
	storage string
}

type loginLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
}

func NewServer(cfg Config, store *Store) (http.Handler, error) {
	storage, err := filepath.Abs(cfg.StorageDir)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(storage, 0o750); err != nil {
		return nil, err
	}
	s := &Server{cfg: cfg, store: store, storage: storage, limiter: &loginLimiter{attempts: make(map[string][]time.Time)}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/healthz", s.health)
	mux.HandleFunc("GET /api/v1/readyz", s.ready)
	mux.HandleFunc("GET /api/v1/notes", s.listPublicNotes)
	mux.HandleFunc("GET /api/v1/notes/{id}", s.getPublicNote)
	mux.HandleFunc("GET /api/v1/notes/{id}/assets/{filename}", s.getAsset)
	mux.HandleFunc("GET /api/v1/tags", s.listTags)
	mux.HandleFunc("POST /api/v1/admin/login", s.login)
	mux.Handle("POST /api/v1/admin/logout", s.auth(http.HandlerFunc(s.logout)))
	mux.Handle("GET /api/v1/admin/me", s.auth(http.HandlerFunc(s.me)))
	mux.Handle("GET /api/v1/admin/notes", s.auth(http.HandlerFunc(s.listAdminNotes)))
	mux.Handle("POST /api/v1/admin/notes", s.auth(http.HandlerFunc(s.createNote)))
	mux.Handle("POST /api/v1/admin/notes/import", s.auth(http.HandlerFunc(s.importNote)))
	mux.Handle("GET /api/v1/admin/notes/{id}", s.auth(http.HandlerFunc(s.getAdminNote)))
	mux.Handle("PUT /api/v1/admin/notes/{id}", s.auth(http.HandlerFunc(s.updateNote)))
	mux.Handle("DELETE /api/v1/admin/notes/{id}", s.auth(http.HandlerFunc(s.deleteNote)))
	mux.Handle("POST /api/v1/admin/notes/{id}/assets", s.auth(http.HandlerFunc(s.uploadAsset)))
	mux.Handle("DELETE /api/v1/admin/notes/{id}/assets/{filename}", s.auth(http.HandlerFunc(s.deleteAsset)))
	return s.middleware(mux), nil
}

func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		status := 200
		wrapped := &statusWriter{ResponseWriter: w, status: &status}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		if origin := r.Header.Get("Origin"); origin != "" && origin == s.cfg.AllowedOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			if r.Header.Get("Origin") != s.cfg.AllowedOrigin {
				writeError(wrapped, http.StatusForbidden, "FORBIDDEN", "Origin is not allowed")
				return
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/v1/admin/") && r.Method != http.MethodGet {
			if origin := r.Header.Get("Origin"); origin != "" && origin != s.cfg.AllowedOrigin {
				writeError(wrapped, http.StatusForbidden, "FORBIDDEN", "Origin is not allowed")
				return
			}
		}
		next.ServeHTTP(wrapped, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "status", status, "duration_ms", time.Since(started).Milliseconds())
	})
}

type statusWriter struct {
	http.ResponseWriter
	status *int
}

func (w *statusWriter) WriteHeader(code int) {
	*w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.store.Ready(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready"})
		return
	}
	if file, err := os.CreateTemp(s.storage, ".ready-"); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready"})
		return
	} else {
		name := file.Name()
		file.Close()
		os.Remove(name)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) listPublicNotes(w http.ResponseWriter, r *http.Request) { s.listNotes(w, r, true) }
func (s *Server) listAdminNotes(w http.ResponseWriter, r *http.Request)  { s.listNotes(w, r, false) }

func (s *Server) listNotes(w http.ResponseWriter, r *http.Request, publishedOnly bool) {
	page, limit, ok := pagination(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid pagination")
		return
	}
	tag := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("tag")))
	if tag != "" && !validTag(tag) {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid tag")
		return
	}
	notes, err := s.store.ListNotes(r.Context(), publishedOnly, tag, page, limit)
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeData(w, http.StatusOK, notes)
}

func (s *Server) getPublicNote(w http.ResponseWriter, r *http.Request) { s.getNote(w, r, true) }
func (s *Server) getAdminNote(w http.ResponseWriter, r *http.Request)  { s.getNote(w, r, false) }

func (s *Server) getNote(w http.ResponseWriter, r *http.Request, publishedOnly bool) {
	id := r.PathValue("id")
	if !validUUID(w, id) {
		return
	}
	note, path, err := s.store.GetNote(r.Context(), id, publishedOnly)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "NOTE_NOT_FOUND", "Note not found")
		return
	}
	if err != nil {
		s.internalError(w, err)
		return
	}
	content, err := os.ReadFile(s.safeMarkdownPath(id, path))
	if err != nil {
		s.internalError(w, err)
		return
	}
	note.ContentMarkdown = string(content)
	writeData(w, http.StatusOK, note)
}

func (s *Server) createNote(w http.ResponseWriter, r *http.Request) {
	var input NoteInput
	if !decodeJSON(w, r, &input, s.cfg.MaxMarkdownSize+16*1024) || !validateNote(w, &input, s.cfg.MaxMarkdownSize) {
		return
	}
	s.createNoteFromInput(w, r, input)
}

func (s *Server) createNoteFromInput(w http.ResponseWriter, r *http.Request, input NoteInput) {
	id := uuid.NewString()
	dir := filepath.Join(s.storage, id)
	if err := os.MkdirAll(filepath.Join(dir, "images"), 0o750); err != nil {
		s.internalError(w, err)
		return
	}
	path := id + "-note.md"
	if err := os.WriteFile(filepath.Join(dir, path), []byte(input.ContentMarkdown), 0o640); err != nil {
		os.RemoveAll(dir)
		s.internalError(w, err)
		return
	}
	note, err := s.store.CreateNote(r.Context(), Note{ID: id, Title: input.Title, IsPublished: input.IsPublished}, path, input.Tags)
	if err != nil {
		os.RemoveAll(dir)
		s.internalError(w, err)
		return
	}
	note.ContentMarkdown = input.ContentMarkdown
	writeData(w, http.StatusCreated, note)
}

func (s *Server) updateNote(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !validUUID(w, id) {
		return
	}
	var input NoteInput
	if !decodeJSON(w, r, &input, s.cfg.MaxMarkdownSize+16*1024) || !validateNote(w, &input, s.cfg.MaxMarkdownSize) {
		return
	}
	_, path, err := s.store.GetNote(r.Context(), id, false)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "NOTE_NOT_FOUND", "Note not found")
		return
	}
	if err != nil {
		s.internalError(w, err)
		return
	}
	fullPath := s.safeMarkdownPath(id, path)
	oldContent, err := os.ReadFile(fullPath)
	if err != nil {
		s.internalError(w, err)
		return
	}
	if err := writeAtomic(fullPath, []byte(input.ContentMarkdown)); err != nil {
		s.internalError(w, err)
		return
	}
	note, err := s.store.UpdateNote(r.Context(), id, input)
	if err != nil {
		_ = writeAtomic(fullPath, oldContent)
		s.internalError(w, err)
		return
	}
	note.ContentMarkdown = input.ContentMarkdown
	writeData(w, http.StatusOK, note)
}

func (s *Server) deleteNote(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !validUUID(w, id) {
		return
	}
	if err := s.store.DeleteNote(r.Context(), id); errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "NOTE_NOT_FOUND", "Note not found")
		return
	} else if err != nil {
		s.internalError(w, err)
		return
	}
	if err := os.RemoveAll(filepath.Join(s.storage, id)); err != nil {
		slog.Error("note storage cleanup failed", "note_id", id, "error", err)
	}
	writeData(w, http.StatusOK, map[string]string{"message": "Note deleted successfully"})
}

func (s *Server) importNote(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxMarkdownSize+64*1024)
	if err := r.ParseMultipartForm(s.cfg.MaxMarkdownSize + 64*1024); err != nil {
		writeError(w, http.StatusBadRequest, "FILE_TOO_LARGE", "Markdown file is too large")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Markdown file is required")
		return
	}
	defer file.Close()
	if !validMarkdownFilename(header.Filename) {
		writeError(w, http.StatusBadRequest, "INVALID_FILE_TYPE", "Invalid markdown file")
		return
	}
	content, err := io.ReadAll(io.LimitReader(file, s.cfg.MaxMarkdownSize+1))
	if err != nil || int64(len(content)) > s.cfg.MaxMarkdownSize {
		writeError(w, http.StatusBadRequest, "FILE_TOO_LARGE", "Markdown file is too large")
		return
	}
	title := strings.TrimSpace(r.FormValue("title"))
	if title == "" {
		title = strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename))
	}
	published, _ := strconv.ParseBool(r.FormValue("is_published"))
	input := NoteInput{Title: title, ContentMarkdown: string(content), IsPublished: published, Tags: splitTags(r.FormValue("tags"))}
	if !validateNote(w, &input, s.cfg.MaxMarkdownSize) {
		return
	}
	s.createNoteFromInput(w, r, input)
}

func (s *Server) getAsset(w http.ResponseWriter, r *http.Request) {
	id, filename := r.PathValue("id"), r.PathValue("filename")
	if !validUUID(w, id) {
		return
	}
	if !validImageFilename(filename) {
		writeError(w, http.StatusNotFound, "ASSET_NOT_FOUND", "Asset not found")
		return
	}
	_, _, err := s.store.GetNote(r.Context(), id, true)
	if errors.Is(err, ErrNotFound) && s.requestAuthenticated(r) {
		_, _, err = s.store.GetNote(r.Context(), id, false)
	}
	if err != nil {
		writeError(w, http.StatusNotFound, "ASSET_NOT_FOUND", "Asset not found")
		return
	}
	path := filepath.Join(s.storage, id, "images", filename)
	file, err := os.Open(path)
	if err != nil {
		writeError(w, http.StatusNotFound, "ASSET_NOT_FOUND", "Asset not found")
		return
	}
	defer file.Close()
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeContent(w, r, filename, fileModTime(file), file)
}

func (s *Server) uploadAsset(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !validUUID(w, id) {
		return
	}
	if _, _, err := s.store.GetNote(r.Context(), id, false); errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "NOTE_NOT_FOUND", "Note not found")
		return
	} else if err != nil {
		s.internalError(w, err)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxImageSize+64*1024)
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Image file is required")
		return
	}
	defer file.Close()
	filename := strings.ToLower(filepath.Base(header.Filename))
	if !validImageFilename(filename) {
		writeError(w, http.StatusBadRequest, "INVALID_FILE_TYPE", "Invalid file type")
		return
	}
	content, err := io.ReadAll(io.LimitReader(file, s.cfg.MaxImageSize+1))
	if err != nil || int64(len(content)) > s.cfg.MaxImageSize {
		writeError(w, http.StatusBadRequest, "FILE_TOO_LARGE", "Image file is too large")
		return
	}
	if !mimeMatches(filename, http.DetectContentType(content)) {
		writeError(w, http.StatusBadRequest, "INVALID_FILE_TYPE", "Invalid file type")
		return
	}
	path := filepath.Join(s.storage, id, "images", filename)
	if _, err := os.Stat(path); err == nil {
		writeError(w, http.StatusConflict, "VALIDATION_ERROR", "Asset already exists")
		return
	}
	if err := os.WriteFile(path, content, 0o640); err != nil {
		s.internalError(w, err)
		return
	}
	url := "/api/v1/notes/" + id + "/assets/" + filename
	writeData(w, http.StatusCreated, map[string]string{"filename": filename, "url": url, "markdown": "![" + strings.TrimSuffix(filename, filepath.Ext(filename)) + "](" + url + ")"})
}

func (s *Server) deleteAsset(w http.ResponseWriter, r *http.Request) {
	id, filename := r.PathValue("id"), r.PathValue("filename")
	if !validUUID(w, id) {
		return
	}
	if !validImageFilename(filename) {
		writeError(w, http.StatusNotFound, "ASSET_NOT_FOUND", "Asset not found")
		return
	}
	path := filepath.Join(s.storage, id, "images", filename)
	if err := os.Remove(path); errors.Is(err, os.ErrNotExist) {
		writeError(w, http.StatusNotFound, "ASSET_NOT_FOUND", "Asset not found")
		return
	} else if err != nil {
		s.internalError(w, err)
		return
	}
	writeData(w, http.StatusOK, map[string]string{"message": "Asset deleted successfully"})
}

func (s *Server) listTags(w http.ResponseWriter, r *http.Request) {
	tags, err := s.store.ListTags(r.Context())
	if err != nil {
		s.internalError(w, err)
		return
	}
	writeData(w, http.StatusOK, tags)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	if !s.limiter.allow(ip, time.Now()) {
		writeError(w, http.StatusTooManyRequests, "RATE_LIMITED", "Too many login attempts")
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &body, 4096) || bcrypt.CompareHashAndPassword([]byte(s.cfg.AdminHash), []byte(body.Password)) != nil {
		slog.Warn("failed login attempt", "ip", ip)
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid credentials")
		return
	}
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		s.internalError(w, err)
		return
	}
	token := base64.RawURLEncoding.EncodeToString(tokenBytes)
	if err := s.store.CreateSession(r.Context(), hashToken(token), time.Now().Add(s.cfg.SessionTTL)); err != nil {
		s.internalError(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", MaxAge: int(s.cfg.SessionTTL.Seconds()), HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode})
	writeData(w, http.StatusOK, map[string]string{"message": "Login successful"})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	cookie, _ := r.Cookie(sessionCookie)
	if cookie != nil {
		_ = s.store.DeleteSession(r.Context(), hashToken(cookie.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode})
	writeData(w, http.StatusOK, map[string]string{"message": "Logout successful"})
}

func (s *Server) me(w http.ResponseWriter, _ *http.Request) {
	writeData(w, http.StatusOK, map[string]bool{"authenticated": true})
}

func (s *Server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.requestAuthenticated(r) {
			writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Admin is not authenticated")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) requestAuthenticated(r *http.Request) bool {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil || len(cookie.Value) < 32 {
		return false
	}
	valid, err := s.store.SessionValid(r.Context(), hashToken(cookie.Value))
	return err == nil && valid
}

func (l *loginLimiter) allow(ip string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	cutoff := now.Add(-10 * time.Minute)
	recent := l.attempts[ip][:0]
	for _, attempt := range l.attempts[ip] {
		if attempt.After(cutoff) {
			recent = append(recent, attempt)
		}
	}
	if len(recent) >= 5 {
		l.attempts[ip] = recent
		return false
	}
	l.attempts[ip] = append(recent, now)
	return true
}

func validateNote(w http.ResponseWriter, input *NoteInput, maxSize int64) bool {
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" || utf8.RuneCountInString(input.Title) > 200 || input.ContentMarkdown == "" || int64(len(input.ContentMarkdown)) > maxSize {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid note payload")
		return false
	}
	seen := make(map[string]bool)
	tags := make([]string, 0, len(input.Tags))
	for _, value := range input.Tags {
		tag := strings.ToLower(strings.TrimSpace(value))
		if !validTag(tag) {
			writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid note payload")
			return false
		}
		if !seen[tag] {
			seen[tag] = true
			tags = append(tags, tag)
		}
	}
	input.Tags = tags
	return true
}

func validTag(tag string) bool {
	if tag == "" || len(tag) > 50 {
		return false
	}
	for _, char := range tag {
		if !(char >= 'a' && char <= 'z') && !(char >= '0' && char <= '9') && char != '-' && char != '_' {
			return false
		}
	}
	return true
}

func validMarkdownFilename(name string) bool {
	base := filepath.Base(name)
	return base == name && !strings.ContainsAny(name, "\\\x00") && strings.Count(base, ".") == 1 && strings.EqualFold(filepath.Ext(base), ".md")
}

func validImageFilename(name string) bool {
	if name == "" || filepath.Base(name) != name || strings.ContainsAny(name, "/\\\x00") || strings.Count(name, ".") != 1 {
		return false
	}
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".webp" || ext == ".gif"
}

func mimeMatches(name, detected string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	allowed := map[string][]string{".png": {"image/png"}, ".jpg": {"image/jpeg"}, ".jpeg": {"image/jpeg"}, ".webp": {"image/webp"}, ".gif": {"image/gif"}}
	for _, mime := range allowed[ext] {
		if strings.HasPrefix(detected, mime) {
			return true
		}
	}
	return false
}

func pagination(r *http.Request) (int, int, bool) {
	page, limit := 1, 20
	var err error
	if value := r.URL.Query().Get("page"); value != "" {
		page, err = strconv.Atoi(value)
		if err != nil {
			return 0, 0, false
		}
	}
	if value := r.URL.Query().Get("limit"); value != "" {
		limit, err = strconv.Atoi(value)
		if err != nil {
			return 0, 0, false
		}
	}
	return page, limit, page >= 1 && limit >= 1 && limit <= 50
}

func splitTags(value string) []string {
	if strings.TrimSpace(value) == "" {
		return []string{}
	}
	return strings.Split(value, ",")
}

func validUUID(w http.ResponseWriter, id string) bool {
	if _, err := uuid.Parse(id); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid id")
		return false
	}
	return true
}

func (s *Server) safeMarkdownPath(id, storedPath string) string {
	expected := id + "-note.md"
	if storedPath != expected {
		return filepath.Join(s.storage, id, expected)
	}
	return filepath.Join(s.storage, id, storedPath)
}

func writeAtomic(path string, content []byte) error {
	temp, err := os.CreateTemp(filepath.Dir(path), ".note-")
	if err != nil {
		return err
	}
	name := temp.Name()
	defer os.Remove(name)
	if err := temp.Chmod(0o640); err != nil {
		temp.Close()
		return err
	}
	if _, err := temp.Write(content); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any, maxBytes int64) bool {
	if contentType := r.Header.Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "VALIDATION_ERROR", "Content-Type must be application/json")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid JSON payload")
		return false
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid JSON payload")
		return false
	}
	return true
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func fileModTime(file *os.File) time.Time {
	info, err := file.Stat()
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}

func writeData(w http.ResponseWriter, status int, data any) {
	writeJSON(w, status, map[string]any{"data": data})
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func (s *Server) internalError(w http.ResponseWriter, err error) {
	slog.Error("request failed", "error", err)
	writeError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Internal server error")
}
