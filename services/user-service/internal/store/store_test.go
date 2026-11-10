package store

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

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
	// A single connection keeps these temporary tables isolated from real users.
	_, err = pool.Exec(context.Background(), `
		CREATE TEMP TABLE users (LIKE public.users INCLUDING ALL);
		CREATE TEMP TABLE user_interests (LIKE public.user_interests INCLUDING ALL);`)
	if err != nil {
		t.Fatal(err)
	}
	return &Store{pool: pool}
}

func TestGoogleSignInLinksProvisionedAccount(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	for _, role := range []string{"user", "organiser", "admin"} {
		t.Run(role, func(t *testing.T) {
			email := role + "@ufp.edu.pt"
			provisioned, err := st.SetRoleByEmail(ctx, email, role)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := st.pool.Exec(ctx, "UPDATE users SET student_number=$1 WHERE id=$2", "20220123", provisioned.ID); err != nil {
				t.Fatal(err)
			}
			if err := st.SetInterests(ctx, provisioned.ID, []string{"https://example.org/#SemanticWeb"}); err != nil {
				t.Fatal(err)
			}

			user, err := st.UpsertByGoogleSub(ctx, "google-"+role, email, "Google Name")
			if err != nil {
				t.Fatalf("first Google sign-in for provisioned %s: %v", role, err)
			}
			if user.ID != provisioned.ID || user.Role != role || user.StudentNumber != "20220123" || user.GoogleSub != "google-"+role || user.Name != "Google Name" {
				t.Fatalf("account identity/profile not preserved: %+v", user)
			}
			interests, err := st.GetInterests(ctx, user.ID)
			if err != nil || len(interests) != 1 {
				t.Fatalf("interests not preserved: %v, %v", interests, err)
			}
			if _, err := st.UpsertByGoogleSub(ctx, "different-"+role, email, "Other"); err == nil {
				t.Fatal("must not replace an account's existing Google identity")
			}
		})
	}
}

func TestGoogleSignInCreatesAndRefreshesAccount(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	first, err := st.UpsertByGoogleSub(ctx, "google-new", "new@ufp.edu.pt", "First")
	if err != nil {
		t.Fatal(err)
	}
	if first.Role != "user" {
		t.Fatalf("new account role: %s", first.Role)
	}
	for _, email := range []string{"new@ufp.edu.pt", "renamed@ufp.edu.pt"} {
		user, err := st.UpsertByGoogleSub(ctx, "google-new", email, "Updated")
		if err != nil {
			t.Fatal(err)
		}
		if user.ID != first.ID || user.Email != email || user.Name != "Updated" {
			t.Fatalf("existing Google account not refreshed: %+v", user)
		}
	}
}
