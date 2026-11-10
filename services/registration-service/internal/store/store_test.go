package store

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Integration tests run against a migrated PostgreSQL database (TEST_DATABASE_URL).
// Connection-local temporary tables isolate each test from real registrations.
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
		`CREATE TEMP TABLE registrations (LIKE public.registrations INCLUDING ALL)`); err != nil {
		t.Fatal(err)
	}
	return &Store{pool: pool}
}

func register(t *testing.T, st *Store, eventID, userID string) *Registration {
	t.Helper()
	reg, err := st.Register(context.Background(), eventID, userID, "Vítor Example", "20220001", "Confirmed")
	if err != nil {
		t.Fatalf("register %s on %s: %v", userID, eventID, err)
	}
	return reg
}

func TestRegisterIssuesReadableBookingRef(t *testing.T) {
	st := testStore(t)
	reg := register(t, st, "evt-1", "usr-1")
	if reg.Status != "Confirmed" || reg.EventID != "evt-1" || reg.UserID != "usr-1" {
		t.Fatalf("unexpected registration: %+v", reg)
	}
	if !strings.HasPrefix(reg.BookingRef, "CP-") {
		t.Fatalf("booking ref %q does not follow the CP-<year>-<seq> format", reg.BookingRef)
	}
}

func TestRegisterDuplicateActiveReturnsErrDuplicate(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	register(t, st, "evt-1", "usr-1")
	if _, err := st.Register(ctx, "evt-1", "usr-1", "Vítor Example", "20220001", "Confirmed"); !errors.Is(err, ErrDuplicate) {
		t.Fatalf("duplicate active registration: got %v, want ErrDuplicate", err)
	}
	// A different student on the same event (and the same student elsewhere) is fine.
	register(t, st, "evt-1", "usr-2")
	register(t, st, "evt-2", "usr-1")
}

func TestCancelledRegistrationDoesNotBlockReRegistration(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	first := register(t, st, "evt-1", "usr-1")
	if _, err := st.pool.Exec(ctx, `UPDATE registrations SET status='Cancelled' WHERE id=$1`, first.ID); err != nil {
		t.Fatal(err)
	}

	second, err := st.Register(ctx, "evt-1", "usr-1", "Vítor Example", "20220001", "Confirmed")
	if err != nil {
		t.Fatalf("re-registration after cancellation: %v", err)
	}
	active, err := st.GetActiveForUser(ctx, "evt-1", "usr-1")
	if err != nil {
		t.Fatal(err)
	}
	if active.ID != second.ID {
		t.Fatalf("active registration is %s, want the re-registration %s", active.ID, second.ID)
	}
}

func TestCheckInTransitionsExactlyOnce(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	reg := register(t, st, "evt-1", "usr-1")

	checked, already, err := st.CheckIn(ctx, reg.BookingRef)
	if err != nil || already {
		t.Fatalf("first check-in: already=%v err=%v", already, err)
	}
	if checked.Status != "Checked-in" || checked.CheckedInAt == nil {
		t.Fatalf("expected Checked-in with a timestamp, got %+v", checked)
	}
	if _, already, err := st.CheckIn(ctx, reg.BookingRef); err != nil || !already {
		t.Fatalf("second check-in must be idempotent: already=%v err=%v", already, err)
	}
	if _, _, err := st.CheckIn(ctx, "CP-1999-00000"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown booking ref: got %v, want ErrNotFound", err)
	}
}

func TestCheckInRejectsCancelledRegistration(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	reg := register(t, st, "evt-1", "usr-1")
	if _, err := st.pool.Exec(ctx, `UPDATE registrations SET status='Cancelled' WHERE id=$1`, reg.ID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := st.CheckIn(ctx, reg.BookingRef); err == nil {
		t.Fatal("check-in of a cancelled registration must fail")
	}
}

func TestListByEventFiltersByStatus(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	confirmed := register(t, st, "evt-1", "usr-1")
	checkedIn := register(t, st, "evt-1", "usr-2")
	if _, _, err := st.CheckIn(ctx, checkedIn.BookingRef); err != nil {
		t.Fatal(err)
	}
	// A registration on another event must never leak into evt-1 listings.
	register(t, st, "evt-2", "usr-3")

	assertCount := func(statuses []string, want int, wantIDs ...string) {
		t.Helper()
		rows, err := st.ListByEvent(ctx, "evt-1", statuses)
		if err != nil {
			t.Fatal(err)
		}
		if len(rows) != want {
			t.Fatalf("statuses %v: got %d rows, want %d", statuses, len(rows), want)
		}
		for _, id := range wantIDs {
			found := false
			for _, r := range rows {
				if r.ID == id {
					found = true
				}
			}
			if !found {
				t.Fatalf("statuses %v: registration %s missing from %v", statuses, id, rows)
			}
		}
	}
	assertCount([]string{"Confirmed"}, 1, confirmed.ID)
	assertCount([]string{"Checked-in"}, 1, checkedIn.ID)
	assertCount([]string{"Confirmed", "Checked-in"}, 2)
	assertCount([]string{"Cancelled"}, 0)
}

func TestListByUserExcludesCancelled(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	keep := register(t, st, "evt-1", "usr-1")
	drop := register(t, st, "evt-2", "usr-1")
	if _, err := st.pool.Exec(ctx, `UPDATE registrations SET status='Cancelled' WHERE id=$1`, drop.ID); err != nil {
		t.Fatal(err)
	}

	rows, err := st.ListByUser(ctx, "usr-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].ID != keep.ID {
		t.Fatalf("expected only the active registration %s, got %+v", keep.ID, rows)
	}
	if time.Since(rows[0].RegisteredAt) > time.Minute {
		t.Fatalf("registered_at looks wrong: %v", rows[0].RegisteredAt)
	}
}
