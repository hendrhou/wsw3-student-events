// Package store is the PostgreSQL persistence layer for event-service.
// Query shapes map 1:1 to the frontend contract (camelCase DTOs in http/).
package store

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

var ErrNotFound = errors.New("event not found")

type Event struct {
	ID                   string
	Title                string
	Category             string
	ShortDescription     string
	About                string
	Date                 time.Time
	StartTime            string
	EndTime              string
	Venue                string
	CoverURL             *string
	CapacityTotal        int
	CapacityUsed         int
	CheckedIn            int
	RegistrationDeadline *time.Time
	LifecycleStatus      string
	OrganiserID          string
	OrganiserName        string
	Competences          []string
	Schedule             []byte // JSONB raw: [{time,item}]
	Online               bool
	OnlineURL            *string
	Topics               []string
}

type Filters struct {
	Query    string
	Category string
	Date     string
	Venue    string
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

const columns = `id, title, category, short_description, about, event_date, start_time, end_time, venue,
	cover_url, capacity_total, capacity_used, checked_in, registration_deadline, lifecycle_status,
	organiser_id, organiser_name, competences, schedule, online, online_url, topics`

func scanEvent(row pgx.Row) (*Event, error) {
	var e Event
	err := row.Scan(&e.ID, &e.Title, &e.Category, &e.ShortDescription, &e.About, &e.Date, &e.StartTime, &e.EndTime,
		&e.Venue, &e.CoverURL, &e.CapacityTotal, &e.CapacityUsed, &e.CheckedIn, &e.RegistrationDeadline,
		&e.LifecycleStatus, &e.OrganiserID, &e.OrganiserName, &e.Competences, &e.Schedule, &e.Online, &e.OnlineURL, &e.Topics)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// List returns upcoming, published events matching the filters.
func (s *Store) List(ctx context.Context, f Filters) ([]Event, error) {
	var b strings.Builder
	args := []any{}
	b.WriteString(`SELECT ` + columns + ` FROM events WHERE lifecycle_status = 'Published' AND event_date >= CURRENT_DATE`)
	if f.Query != "" {
		args = append(args, "%"+strings.ToLower(f.Query)+"%")
		fmt.Fprintf(&b, ` AND lower(title) LIKE $%d`, len(args))
	}
	if f.Category != "" {
		args = append(args, f.Category)
		fmt.Fprintf(&b, ` AND category = $%d`, len(args))
	}
	if f.Date != "" {
		args = append(args, f.Date)
		fmt.Fprintf(&b, ` AND event_date = $%d`, len(args))
	}
	if f.Venue != "" {
		args = append(args, "%"+strings.ToLower(f.Venue)+"%")
		fmt.Fprintf(&b, ` AND lower(venue) LIKE $%d`, len(args))
	}
	b.WriteString(` ORDER BY event_date, start_time`)

	rows, err := s.pool.Query(ctx, b.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Event
	for rows.Next() {
		e, err := scanEvent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}

func (s *Store) Get(ctx context.Context, id string) (*Event, error) {
	return scanEvent(s.pool.QueryRow(ctx, `SELECT `+columns+` FROM events WHERE id = $1`, id))
}

// ListMine returns every event owned by the organiser (any status).
func (s *Store) ListMine(ctx context.Context, organiserID string) ([]Event, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+columns+` FROM events WHERE organiser_id = $1 ORDER BY event_date DESC`, organiserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Event
	for rows.Next() {
		e, err := scanEvent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}

func newID() string {
	return fmt.Sprintf("evt-%d", time.Now().UnixNano())
}

// Create inserts a published event and returns its id.
func (s *Store) Create(ctx context.Context, e *Event) (string, error) {
	e.ID = newID()
	_, err := s.pool.Exec(ctx, `
		INSERT INTO events (id, title, category, short_description, about, event_date, start_time, end_time, venue,
			capacity_total, registration_deadline, lifecycle_status, organiser_id, organiser_name, competences, schedule,
			online, online_url, topics)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Published',$12,$13,$14,$15,$16,$17,$18)`,
		e.ID, e.Title, e.Category, e.ShortDescription, e.About, e.Date.Format("2006-01-02"), e.StartTime, e.EndTime,
		e.Venue, e.CapacityTotal, e.RegistrationDeadline, e.OrganiserID, e.OrganiserName, e.Competences, e.Schedule,
		e.Online, e.OnlineURL, e.Topics)
	return e.ID, err
}

// Update edits an event owned by the organiser. ErrNotFound when not owned/missing.
func (s *Store) Update(ctx context.Context, id, organiserID string, e *Event) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE events SET title=$3, category=$4, short_description=$5, about=$6, event_date=$7, start_time=$8,
			end_time=$9, venue=$10, capacity_total=$11, registration_deadline=$12, competences=$13, schedule=$14,
			online=$15, online_url=$16, topics=$17
		WHERE id=$1 AND organiser_id=$2`,
		id, organiserID, e.Title, e.Category, e.ShortDescription, e.About, e.Date.Format("2006-01-02"), e.StartTime,
		e.EndTime, e.Venue, e.CapacityTotal, e.RegistrationDeadline, e.Competences, e.Schedule, e.Online, e.OnlineURL, e.Topics)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AdjustCounters moves the registration/attendance counters (called by
// registration-service). Never lets a counter go negative.
func (s *Store) AdjustCounters(ctx context.Context, id string, usedDelta, checkedInDelta int) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE events SET
			capacity_used = GREATEST(0, capacity_used + $2),
			checked_in = GREATEST(0, checked_in + $3)
		WHERE id = $1`, id, usedDelta, checkedInDelta)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
