package internal

import "time"

type Tag struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Note struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	ContentMarkdown string    `json:"content_markdown,omitempty"`
	AssetBaseURL    string    `json:"asset_base_url,omitempty"`
	IsPublished     bool      `json:"is_published"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	Tags            []Tag     `json:"tags"`
}

type NoteInput struct {
	Title           string   `json:"title"`
	ContentMarkdown string   `json:"content_markdown"`
	IsPublished     bool     `json:"is_published"`
	Tags            []string `json:"tags"`
}
