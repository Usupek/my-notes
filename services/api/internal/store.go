package internal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Store struct{ DB *pgxpool.Pool }

func NewStore(ctx context.Context, databaseURL string) (*Store, error) {
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{DB: db}, nil
}

func (s *Store) ListNotes(ctx context.Context, publishedOnly bool, tag string, page, limit int) ([]Note, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT n.id, n.title, n.is_published, n.created_at, n.updated_at
		FROM notes n
		WHERE ($1::boolean = false OR n.is_published = true)
		AND ($2::text = '' OR EXISTS (
			SELECT 1 FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
			WHERE nt.note_id = n.id AND t.name = $2
		))
		ORDER BY n.updated_at DESC LIMIT NULLIF($3, 0) OFFSET $4`, publishedOnly, tag, limit, (page-1)*limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	notes := make([]Note, 0)
	for rows.Next() {
		var note Note
		if err := rows.Scan(&note.ID, &note.Title, &note.IsPublished, &note.CreatedAt, &note.UpdatedAt); err != nil {
			return nil, err
		}
		note.Tags, err = s.noteTags(ctx, note.ID)
		if err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}
	return notes, rows.Err()
}

func (s *Store) GetNote(ctx context.Context, id string, publishedOnly bool) (Note, string, error) {
	var note Note
	var path string
	err := s.DB.QueryRow(ctx, `SELECT id, title, markdown_file_path, is_published, created_at, updated_at
		FROM notes WHERE id = $1 AND ($2::boolean = false OR is_published = true)`, id, publishedOnly).
		Scan(&note.ID, &note.Title, &path, &note.IsPublished, &note.CreatedAt, &note.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Note{}, "", ErrNotFound
	}
	if err != nil {
		return Note{}, "", err
	}
	note.Tags, err = s.noteTags(ctx, id)
	note.AssetBaseURL = "/api/v1/notes/" + id + "/assets"
	return note, path, err
}

func (s *Store) CreateNote(ctx context.Context, note Note, path string, tagNames []string) (Note, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Note{}, err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `INSERT INTO notes(id, title, markdown_file_path, is_published) VALUES($1,$2,$3,$4)`, note.ID, note.Title, path, note.IsPublished)
	if err != nil {
		return Note{}, err
	}
	if err := setTags(ctx, tx, note.ID, tagNames); err != nil {
		return Note{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Note{}, err
	}
	created, _, err := s.GetNote(ctx, note.ID, false)
	return created, err
}

func (s *Store) UpdateNote(ctx context.Context, id string, input NoteInput) (Note, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Note{}, err
	}
	defer tx.Rollback(ctx)
	result, err := tx.Exec(ctx, `UPDATE notes SET title=$2, is_published=$3, updated_at=now() WHERE id=$1`, id, input.Title, input.IsPublished)
	if err != nil {
		return Note{}, err
	}
	if result.RowsAffected() == 0 {
		return Note{}, ErrNotFound
	}
	if _, err := tx.Exec(ctx, `DELETE FROM note_tags WHERE note_id=$1`, id); err != nil {
		return Note{}, err
	}
	if err := setTags(ctx, tx, id, input.Tags); err != nil {
		return Note{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Note{}, err
	}
	note, _, err := s.GetNote(ctx, id, false)
	return note, err
}

func (s *Store) DeleteNote(ctx context.Context, id string) error {
	result, err := s.DB.Exec(ctx, `DELETE FROM notes WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListTags(ctx context.Context) ([]Tag, error) {
	rows, err := s.DB.Query(ctx, `SELECT id, name FROM tags ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tags := make([]Tag, 0)
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(&tag.ID, &tag.Name); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}

func (s *Store) noteTags(ctx context.Context, noteID string) ([]Tag, error) {
	rows, err := s.DB.Query(ctx, `SELECT t.id, t.name FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id=$1 ORDER BY t.name`, noteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tags := make([]Tag, 0)
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(&tag.ID, &tag.Name); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}

func setTags(ctx context.Context, tx pgx.Tx, noteID string, names []string) error {
	for _, name := range names {
		id := uuid.NewString()
		var tagID string
		err := tx.QueryRow(ctx, `INSERT INTO tags(id,name) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, id, name).Scan(&tagID)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO note_tags(note_id,tag_id) VALUES($1,$2)`, noteID, tagID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) CreateSession(ctx context.Context, tokenHash string, expiresAt time.Time) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM admin_sessions WHERE expires_at <= now()`)
	if err != nil {
		return err
	}
	_, err = s.DB.Exec(ctx, `INSERT INTO admin_sessions(id, session_token_hash, expires_at) VALUES($1,$2,$3)`, uuid.NewString(), tokenHash, expiresAt)
	return err
}

func (s *Store) SessionValid(ctx context.Context, tokenHash string) (bool, error) {
	var valid bool
	err := s.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM admin_sessions WHERE session_token_hash=$1 AND expires_at>now())`, tokenHash).Scan(&valid)
	return valid, err
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM admin_sessions WHERE session_token_hash=$1`, tokenHash)
	return err
}

func (s *Store) Ready(ctx context.Context) error {
	if err := s.DB.Ping(ctx); err != nil {
		return fmt.Errorf("database: %w", err)
	}
	return nil
}
