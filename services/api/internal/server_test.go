package internal

import (
	"net/http/httptest"
	"testing"
)

func TestValidTag(t *testing.T) {
	for _, value := range []string{"study", "dev_ops", "go-123"} {
		if !validTag(value) {
			t.Fatalf("expected %q to be valid", value)
		}
	}
	for _, value := range []string{"", "UPPER", "two words", "../secret"} {
		if validTag(value) {
			t.Fatalf("expected %q to be invalid", value)
		}
	}
}

func TestFilenameValidation(t *testing.T) {
	if !validMarkdownFilename("note.md") || validMarkdownFilename("file.php.md") || validMarkdownFilename("../note.md") {
		t.Fatal("markdown filename validation failed")
	}
	if !validImageFilename("diagram.png") || validImageFilename("shell.php.png") || validImageFilename("../image.png") || validImageFilename("image.svg") {
		t.Fatal("image filename validation failed")
	}
}

func TestPagination(t *testing.T) {
	r := httptest.NewRequest("GET", "/?page=2&limit=50", nil)
	page, limit, ok := pagination(r)
	if !ok || page != 2 || limit != 50 {
		t.Fatal("expected valid pagination")
	}
	r = httptest.NewRequest("GET", "/?limit=51", nil)
	if _, _, ok := pagination(r); ok {
		t.Fatal("expected limit above maximum to fail")
	}
}
