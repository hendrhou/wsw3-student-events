// Package store is the PostgreSQL persistence layer for ticket-service.
package store

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

var ErrNotFound = errors.New("ticket not found")

type Ticket struct {
	ID             string
	BookingRef     string
	EventID        string
	EventTitle     string
	DateVenueLabel string
	EventDate      time.Time
	UserID         string
	UserName       string
	StudentNumber  string
	Credential     []byte // JSONB raw, nullable
	VcJWT          *string
	Status         string // Issued | Verified | Revoked
	IssuedAt       time.Time
	VerifiedAt     *time.Time
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

const columns = `id, booking_ref, event_id, event_title, date_venue_label, event_date, user_id, user_name, student_number, credential, vc_jwt, status, issued_at, verified_at`

func scanTicket(row pgx.Row) (*Ticket, error) {
	var t Ticket
	err := row.Scan(&t.ID, &t.BookingRef, &t.EventID, &t.EventTitle, &t.DateVenueLabel, &t.EventDate,
		&t.UserID, &t.UserName, &t.StudentNumber, &t.Credential, &t.VcJWT, &t.Status, &t.IssuedAt, &t.VerifiedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// Create is idempotent on bookingRef (registration-service may retry).
func (s *Store) Create(ctx context.Context, t *Ticket) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO tickets (id, booking_ref, event_id, event_title, date_venue_label, event_date, user_id, user_name, student_number, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Issued')
		ON CONFLICT (booking_ref) DO NOTHING`,
		t.ID, t.BookingRef, t.EventID, t.EventTitle, t.DateVenueLabel,
		t.EventDate.Format("2006-01-02"), t.UserID, t.UserName, t.StudentNumber)
	return err
}

// AttachCredential stores the signed VC-JWT + JSON-LD payload.
func (s *Store) AttachCredential(ctx context.Context, bookingRef string, credential []byte, vcJWT string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE tickets SET credential=$2, vc_jwt=$3 WHERE booking_ref=$1`, bookingRef, credential, vcJWT)
	return err
}

func (s *Store) GetByBookingRef(ctx context.Context, ref string) (*Ticket, error) {
	return scanTicket(s.pool.QueryRow(ctx, `SELECT `+columns+` FROM tickets WHERE booking_ref=$1`, ref))
}

func (s *Store) ListByUser(ctx context.Context, userID string) ([]Ticket, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+columns+` FROM tickets WHERE user_id=$1 ORDER BY event_date DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Ticket
	for rows.Next() {
		t, err := scanTicket(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

// Unsigned returns tickets missing their VC-JWT (seeded rows on first boot).
func (s *Store) Unsigned(ctx context.Context) ([]Ticket, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+columns+` FROM tickets WHERE vc_jwt IS NULL`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Ticket
	for rows.Next() {
		t, err := scanTicket(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

// MarkVerified is idempotent (Issued→Verified only).
func (s *Store) MarkVerified(ctx context.Context, bookingRef string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE tickets SET status='Verified', verified_at=now() WHERE booking_ref=$1 AND status='Issued'`, bookingRef)
	return err
}
