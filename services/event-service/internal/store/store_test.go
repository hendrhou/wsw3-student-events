package store

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Integration tests run against a migrated PostgreSQL database (TEST_DATABASE_URL).
// A connection-local temporary events table isolates each test from seed data.
func testStore(t *testing.T) *Store {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 1
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(context.Background(),
		`CREATE TEMP TABLE events (LIKE public.events INCLUDING ALL)`); err != nil {
		t.Fatal(err)
	}
	return &Store{pool: pool}
}

func sampleEvent(title, category string) *Event {
	return &Event{
		Title:            title,
		Category:         category,
		ShortDescription: "A Campus Pulse integration-test event",
		About:            "Created by store integration tests.",
		Date:             time.Now().Add(72 * time.Hour),
		StartTime:        "14:00",
		EndTime:          "16:00",
		Venue:            "Auditório B",
		CapacityTotal:    30,
		OrganiserID:      "usr_org",
		OrganiserName:    "Olga Organiser",
		Competences:      []string{"semantic-web"},
		Schedule:         []byte(`[{"time":"14:00","item":"Talk"}]`),
		Topics:           []string{"semantic-web"},
	}
}

func create(t *testing.T, st *Store, e *Event) string {
	t.Helper()
	id, err := st.Create(context.Background(), e)
	if err != nil {
		t.Fatalf("create %q: %v", e.Title, err)
	}
	return id
}

func TestCreateGetUpdateRoundTrip(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	id := create(t, st, sampleEvent("Semantic Web Lecture", "Lecture"))
	got, err := st.Get(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Semantic Web Lecture" || got.LifecycleStatus != "Published" ||
		got.CapacityTotal != 30 || got.CapacityUsed != 0 || got.OrganiserName != "Olga Organiser" {
		t.Fatalf("unexpected event after create: %+v", got)
	}
	if len(got.Competences) != 1 || got.Competences[0] != "semantic-web" {
		t.Fatalf("competences not persisted: %v", got.Competences)
	}

	update := sampleEvent("Semantic Web Lecture (2nd edition)", "Workshop")
	if err := st.Update(ctx, id, "usr_org", update); err != nil {
		t.Fatalf("owner update: %v", err)
	}
	got, err = st.Get(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Semantic Web Lecture (2nd edition)" || got.Category != "Workshop" {
		t.Fatalf("update not applied: %+v", got)
	}

	if err := st.Update(ctx, id, "usr_someone_else", update); !errors.Is(err, ErrNotFound) {
		t.Fatalf("update by another organiser: got %v, want ErrNotFound", err)
	}
	if _, err := st.Get(ctx, "evt-does-not-exist"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown id: got %v, want ErrNotFound", err)
	}
}

func TestListAppliesFiltersAndHidesNonPublished(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	lectureID := create(t, st, sampleEvent("Semantic Web Lecture", "Lecture"))
	sportsID := create(t, st, sampleEvent("Futsal Tournament", "Sports"))
	past := sampleEvent("Last Year Conference", "Lecture")
	past.Date = time.Now().Add(-7 * 24 * time.Hour)
	create(t, st, past)

	titles := func(events []Event) []string {
		out := make([]string, 0, len(events))
		for _, e := range events {
			out = append(out, e.Title)
		}
		return out
	}

	all, err := st.List(ctx, Filters{})
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 {
		t.Fatalf("unfiltered list: got %v, want the 2 future published events", titles(all))
	}

	byQuery, err := st.List(ctx, Filters{Query: "semantic"})
	if err != nil || len(byQuery) != 1 || byQuery[0].ID != lectureID {
		t.Fatalf("query filter: got %v, err=%v", titles(byQuery), err)
	}
	byCategory, err := st.List(ctx, Filters{Category: "Sports"})
	if err != nil || len(byCategory) != 1 || byCategory[0].ID != sportsID {
		t.Fatalf("category filter: got %v, err=%v", titles(byCategory), err)
	}
	byVenue, err := st.List(ctx, Filters{Venue: "auditório"})
	if err != nil || len(byVenue) != 2 {
		t.Fatalf("venue filter is case-insensitive substring: got %v, err=%v", titles(byVenue), err)
	}
	if _, err := st.pool.Exec(ctx, `UPDATE events SET lifecycle_status='Cancelled' WHERE id=$1`, sportsID); err != nil {
		t.Fatal(err)
	}
	afterCancel, err := st.List(ctx, Filters{})
	if err != nil || len(afterCancel) != 1 || afterCancel[0].ID != lectureID {
		t.Fatalf("cancelled events must be hidden: got %v, err=%v", titles(afterCancel), err)
	}
}

func TestAdjustCountersAccumulatesAndClamps(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	id := create(t, st, sampleEvent("Counter Event", "Lecture"))

	counters := func() (int, int) {
		t.Helper()
		e, err := st.Get(ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		return e.CapacityUsed, e.CheckedIn
	}

	if err := st.AdjustCounters(ctx, id, 1, 0); err != nil {
		t.Fatal(err)
	}
	if err := st.AdjustCounters(ctx, id, 2, 1); err != nil {
		t.Fatal(err)
	}
	if used, in := counters(); used != 3 || in != 1 {
		t.Fatalf("after +1/+2/+1: used=%d checkedIn=%d, want 3/1", used, in)
	}
	// Counters never go negative (guards against double-cancellation bugs).
	if err := st.AdjustCounters(ctx, id, -10, -10); err != nil {
		t.Fatal(err)
	}
	if used, in := counters(); used != 0 || in != 0 {
		t.Fatalf("clamped at zero: used=%d checkedIn=%d", used, in)
	}
	if err := st.AdjustCounters(ctx, "evt-missing", 1, 0); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown event: got %v, want ErrNotFound", err)
	}
}

func TestListMineReturnsAllLifecycleStates(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	mine := create(t, st, sampleEvent("My Event", "Lecture"))
	create(t, st, sampleEvent("Their Event", "Lecture")) // different owner below
	if _, err := st.pool.Exec(ctx, `UPDATE events SET organiser_id='usr_other' WHERE title='Their Event'`); err != nil {
		t.Fatal(err)
	}
	if _, err := st.pool.Exec(ctx, `UPDATE events SET lifecycle_status='Cancelled' WHERE id=$1`, mine); err != nil {
		t.Fatal(err)
	}

	rows, err := st.ListMine(ctx, "usr_org")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].ID != mine || rows[0].LifecycleStatus != "Cancelled" {
		t.Fatalf("ListMine must include cancelled events and exclude others': %+v", rows)
	}
}
