// Package favorites persists the favorite paths in SQLite.
//
// The database lives in the writable config volume, never in the
// read-only mount. Favorites are shared by everyone who passes the
// reverse proxy's authentication; the app has a single owner.
package favorites

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite" // CGO-free SQLite driver
)

// Store is safe for concurrent use.
type Store struct {
	db *sql.DB
}

// Open opens (and migrates) the database file at path.
func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create database dir: %w", err)
	}
	dsn := "file:" + path + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS favorites (
		path       TEXT PRIMARY KEY,
		created_at INTEGER NOT NULL
	)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return &Store{db: db}, nil
}

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

// List returns favorite paths in the order they were added.
func (s *Store) List(ctx context.Context) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT path FROM favorites ORDER BY created_at, rowid`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Add adds p; adding an existing favorite keeps its position.
func (s *Store) Add(ctx context.Context, p string) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO favorites (path, created_at) VALUES (?, ?) ON CONFLICT (path) DO NOTHING`,
		p, time.Now().UnixMilli())
	return err
}

// Remove removes p; removing a missing favorite is not an error.
func (s *Store) Remove(ctx context.Context, p string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM favorites WHERE path = ?`, p)
	return err
}
