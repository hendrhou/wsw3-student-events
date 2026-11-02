// Package store is the PostgreSQL persistence layer for registration-service.
package store

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

var (
	ErrDuplicate = errors.New("already registered")
	ErrNotFound  = errors.New("registration not found")
)

type Registration struct {
	ID            string
	BookingRef    string
	EventID       string
	UserID        string
	UserName      string
	StudentNumber string
	Status        string
	RegisteredAt  time.Time
	CheckedInAt   *time.Time
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
		if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name=$1)`, e.Name()).Scan(&applied); err != nil {
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

const columns = `id, booking_ref, event_id, user_id, user_name, student_number, status, registered_at, checked_in_at`

func scanRegistration(row pgx.Row) (*Registration, error) {
	var r Registration
	err := row.Scan(&r.ID, &r.BookingRef, &r.EventID, &r.UserID, &r.UserName, &r.StudentNumber, &r.Status, &r.RegisteredAt, &r.CheckedInAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// Register inserts a registration; ErrDuplicate when an active one exists.
// The booking reference is monotonic (CP-<year>-<seq>) for readability.
func (s *Store) Register(ctx context.Context, eventID, userID, userName, studentNumber, status string) (*Registration, error) {
	var count int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM registrations`).Scan(&count); err != nil {
		return nil, err
	}
	bookingRef := fmt.Sprintf("CP-%d-%05d", time.Now().Year(), 10000+count)
	id := fmt.Sprintf("reg_%d", time.Now().UnixNano())
	_, err := s.pool.Exec(ctx, `
		INSERT INTO registrations (id, booking_ref, event_id, user_id, user_name, student_number, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`, id, bookingRef, eventID, userID, userName, studentNumber, status)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, err
	}
	return s.GetByBookingRef(ctx, bookingRef)
}

// isUniqueViolation detects PostgreSQL SQLSTATE 23505 (unique_violation).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (s *Store) GetByBookingRef(ctx context.Context, ref string) (*Registration, error) {
	return scanRegistration(s.pool.QueryRow(ctx, `SELECT `+columns+` FROM registrations WHERE booking_ref=$1`, ref))
}

// GetActiveForUser finds an active (non-cancelled) registration for the pair.
func (s *Store) GetActiveForUser(ctx context.Context, eventID, userID string) (*Registration, error) {
	return scanRegistration(s.pool.QueryRow(ctx,
		`SELECT `+columns+` FROM registrations WHERE event_id=$1 AND user_id=$2 AND status != 'Cancelled'`, eventID, userID))
}

func (s *Store) ListByEvent(ctx context.Context, eventID string, statuses []string) ([]Registration, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+columns+` FROM registrations WHERE event_id=$1 AND status = ANY($2) ORDER BY registered_at DESC`, eventID, statuses)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Registration
	for rows.Next() {
		r, err := scanRegistration(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *r)
	}
	return out, rows.Err()
}

func (s *Store) ListByUser(ctx context.Context, userID string) ([]Registration, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+columns+` FROM registrations WHERE user_id=$1 AND status != 'Cancelled' ORDER BY registered_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Registration
	for rows.Next() {
		r, err := scanRegistration(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *r)
	}
	return out, rows.Err()
}

// CheckIn marks attendance atomically; returns (registration, alreadyCheckedIn).
func (s *Store) CheckIn(ctx context.Context, bookingRef string) (*Registration, bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	reg, err := scanRegistration(tx.QueryRow(ctx,
		`SELECT `+columns+` FROM registrations WHERE booking_ref=$1 FOR UPDATE`, bookingRef))
	if err != nil {
		return nil, false, err
	}
	if reg.Status == "Checked-in" {
		return reg, true, tx.Commit(ctx)
	}
	if reg.Status == "Cancelled" {
		return nil, false, errors.New("registration was cancelled")
	}
	if _, err := tx.Exec(ctx,
		`UPDATE registrations SET status='Checked-in', checked_in_at=now() WHERE id=$1`, reg.ID); err != nil {
		return nil, false, err
	}
	reg.Status = "Checked-in"
	now := time.Now()
	reg.CheckedInAt = &now
	return reg, false, tx.Commit(ctx)
}
