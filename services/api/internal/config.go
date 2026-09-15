package internal

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	DatabaseURL     string
	AdminHash       string
	StorageDir      string
	AllowedOrigin   string
	CookieSecure    bool
	SessionTTL      time.Duration
	MaxMarkdownSize int64
	MaxImageSize    int64
}

func LoadConfig() (Config, error) {
	c := Config{
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		AdminHash:       os.Getenv("ADMIN_PASSWORD_HASH"),
		StorageDir:      envString("STORAGE_DIR", "./data/notes"),
		AllowedOrigin:   envString("ALLOWED_ORIGIN", "http://localhost:3000"),
		CookieSecure:    envBool("COOKIE_SECURE", false),
		SessionTTL:      envDuration("SESSION_TTL", 24*time.Hour),
		MaxMarkdownSize: envInt64("MAX_MARKDOWN_BYTES", 1<<20),
		MaxImageSize:    envInt64("MAX_IMAGE_BYTES", 5<<20),
	}
	if c.DatabaseURL == "" || c.AdminHash == "" {
		return Config{}, fmt.Errorf("DATABASE_URL and ADMIN_PASSWORD_HASH are required")
	}
	return c, nil
}

func envString(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	value, err := strconv.ParseBool(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value, err := time.ParseDuration(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}

func envInt64(key string, fallback int64) int64 {
	value, err := strconv.ParseInt(os.Getenv(key), 10, 64)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
