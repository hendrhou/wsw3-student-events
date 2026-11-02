// Package store is the PostgreSQL persistence layer for user-service.
package store

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type User struct {
	ID            string
	GoogleSub     string
	Email         string
	Name          string
	StudentNumber string
	Role          string
}

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

// Migrate runs embedded migrations in filename order, idempotently.
func (s *Store) Migrate(ctx context.Context) error {
	if _, err := s.pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	for _, e := range entries {
		var applied bool
		err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name=$1)`, e.Name()).Scan(&applied)
		if err != nil {
			return err
		}
		if applied {
			continue
		}
		sql, err := migrationsFS.ReadFile("migrations/" + e.Name())
		if err != nil {
			return err
		}
		tx, err := s.pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migration %s: %w", e.Name(), err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (name) VALUES ($1)`, e.Name()); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

// UpsertByGoogleSub creates or returns the user for a Google subject.
// First sign-in assigns the default role "user".
func (s *Store) UpsertByGoogleSub(ctx context.Context, sub, email, name string) (*User, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO users (id, google_sub, email, name)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (google_sub) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
		RETURNING id, COALESCE(google_sub,''), email, name, student_number, role`,
		newID("usr"), sub, email, name)
	return scanUser(row)
}

// GetByEmail is used only by the dev-login flow (no Google involved).
func (s *Store) GetByEmail(ctx context.Context, email string) (*User, error) {
	row := s.pool.QueryRow(ctx, `SELECT id, COALESCE(google_sub,''), email, name, student_number, role FROM users WHERE email=$1`, email)
	return scanUser(row)
}

func (s *Store) GetByID(ctx context.Context, id string) (*User, error) {
	row := s.pool.QueryRow(ctx, `SELECT id, COALESCE(google_sub,''), email, name, student_number, role FROM users WHERE id=$1`, id)
	return scanUser(row)
}

// ListStaff returns everyone with elevated access (organiser or admin),
// admins first, for the Team management screen.
func (s *Store) ListStaff(ctx context.Context) ([]*User, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, COALESCE(google_sub,''), email, name, student_number, role FROM users WHERE role IN ('organiser','admin') ORDER BY role DESC, email`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.GoogleSub, &u.Email, &u.Name, &u.StudentNumber, &u.Role); err != nil {
			return nil, err
		}
		out = append(out, &u)
	}
	return out, rows.Err()
}

// SetRoleByEmail grants or revokes a role, creating a placeholder account when
// the person has never signed in (their profile completes on first Google
// sign-in via UpsertByGoogleSub). Returns the resulting user.
func (s *Store) SetRoleByEmail(ctx context.Context, email, role string) (*User, error) {
	name := email
	if i := indexByte(email, '@'); i > 0 {
		name = email[:i]
	}
	row := s.pool.QueryRow(ctx, `
		INSERT INTO users (id, email, name, role)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
		RETURNING id, COALESCE(google_sub,''), email, name, student_number, role`,
		newID("usr"), email, name, role)
	return scanUser(row)
}

func indexByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanUser(row rowScanner) (*User, error) {
	var u User
	if err := row.Scan(&u.ID, &u.GoogleSub, &u.Email, &u.Name, &u.StudentNumber, &u.Role); err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) GetInterests(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT interest_uri FROM user_interests WHERE user_id=$1 ORDER BY interest_uri`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var uri string
		if err := rows.Scan(&uri); err != nil {
			return nil, err
		}
		out = append(out, uri)
	}
	return out, rows.Err()
}

// SetInterests replaces the user's interests atomically (never partial state).
func (s *Store) SetInterests(ctx context.Context, userID string, uris []string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `DELETE FROM user_interests WHERE user_id=$1`, userID); err != nil {
		return err
	}
	for _, uri := range uris {
		if _, err := tx.Exec(ctx, `INSERT INTO user_interests (user_id, interest_uri) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, uri); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
