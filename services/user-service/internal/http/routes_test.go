package http
package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/user-service/internal/store"
)

type fakeStore struct {
	staff   []*store.User
	byEmail map[string]*store.User
	setRole func(email, role string) (*store.User, error)
}

func (f *fakeStore) UpsertByGoogleSub(context.Context, string, string, string) (*store.User, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeStore) GetByEmail(_ context.Context, email string) (*store.User, error) {
	u, ok := f.byEmail[email]
	if !ok {
		return nil, errors.New("no rows")
	}
	return u, nil
}
func (f *fakeStore) GetInterests(context.Context, string) ([]string, error)     { return nil, nil }
func (f *fakeStore) SetInterests(context.Context, string, []string) error       { return nil }
func (f *fakeStore) ListStaff(context.Context) ([]*store.User, error)           { return f.staff, nil }
func (f *fakeStore) SetRoleByEmail(_ context.Context, email, role string) (*store.User, error) {
	if f.setRole != nil {
		return f.setRole(email, role)
	}
	u := &store.User{ID: "usr_new", Email: email, Name: email, Role: role}
	f.byEmail[email] = u
	return u, nil
}

func newTestServer(t *testing.T, fs *fakeStore) (*gin.Engine, *authx.Issuer) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	issuer, err := authx.NewIssuer("test-secret-key-1234", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	RegisterRoutes(r, &Handlers{Store: fs, Issuer: issuer, Logger: slog.Default()})
	return r, issuer
}

func do(t *testing.T, r *gin.Engine, issuer *authx.Issuer, method, path, role, body string) *httptest.ResponseRecorder {
	t.Helper()
	token, err := issuer.Issue("usr_admin", "Admin", "admin@ufp.edu.pt", "", role)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func TestListOrganisersRequiresAdmin(t *testing.T) {
	r, issuer := newTestServer(t, &fakeStore{byEmail: map[string]*store.User{}})
	if rec := do(t, r, issuer, http.MethodGet, "/api/admin/organisers", "organiser", ""); rec.Code != 403 {
		t.Fatalf("organiser listing organisers: got %d, want 403", rec.Code)
	}
}

func TestListOrganisersReturnsStaff(t *testing.T) {
	fs := &fakeStore{
		byEmail: map[string]*store.User{},
		staff: []*store.User{
			{Email: "olga@ufp.edu.pt", Name: "Olga", Role: "organiser"},
			{Email: "root@ufp.edu.pt", Name: "Root", Role: "admin"},
		},
	}
	r, issuer := newTestServer(t, fs)
	rec := do(t, r, issuer, http.MethodGet, "/api/admin/organisers", "admin", "")
	if rec.Code != 200 {
		t.Fatalf("got %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "olga@ufp.edu.pt") || !strings.Contains(rec.Body.String(), `"role":"admin"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestGrantOrganiserValidatesDomain(t *testing.T) {
	r, issuer := newTestServer(t, &fakeStore{byEmail: map[string]*store.User{}})
	rec := do(t, r, issuer, http.MethodPost, "/api/admin/organisers", "admin", `{"email":"someone@gmail.com"}`)
	if rec.Code != 400 {
		t.Fatalf("non-ufp email: got %d, want 400", rec.Code)
	}
}

func TestGrantOrganiserCreatesPlaceholder(t *testing.T) {
	fs := &fakeStore{byEmail: map[string]*store.User{}}
	r, issuer := newTestServer(t, fs)
	rec := do(t, r, issuer, http.MethodPost, "/api/admin/organisers", "admin", `{"email":"New@UFP.edu.pt"}`)
	if rec.Code != 200 {
		t.Fatalf("got %d, want 200", rec.Code)
	}
	u := fs.byEmail["new@ufp.edu.pt"]
	if u == nil || u.Role != "organiser" {
		t.Fatalf("expected placeholder organiser, got %+v", u)
	}
}

func TestRevokeOrganiserRejectsSelf(t *testing.T) {
	fs := &fakeStore{byEmail: map[string]*store.User{
		"admin@ufp.edu.pt": {Email: "admin@ufp.edu.pt", Role: "admin"},
	}}
	r, issuer := newTestServer(t, fs)
	rec := do(t, r, issuer, http.MethodDelete, "/api/admin/organisers/admin@ufp.edu.pt", "admin", "")
	if rec.Code != 400 {
		t.Fatalf("self-revoke: got %d, want 400", rec.Code)
	}
}

func TestRevokeOrganiserRejectsAdmins(t *testing.T) {
	fs := &fakeStore{byEmail: map[string]*store.User{
		"other@ufp.edu.pt": {Email: "other@ufp.edu.pt", Role: "admin"},
	}}
	r, issuer := newTestServer(t, fs)
	rec := do(t, r, issuer, http.MethodDelete, "/api/admin/organisers/other@ufp.edu.pt", "admin", "")
	if rec.Code != 400 {
		t.Fatalf("revoking an admin: got %d, want 400", rec.Code)
	}
}

func TestRevokeOrganiserDemotesToUser(t *testing.T) {
	fs := &fakeStore{byEmail: map[string]*store.User{
		"olga@ufp.edu.pt": {Email: "olga@ufp.edu.pt", Name: "Olga", Role: "organiser"},
	}}
	r, issuer := newTestServer(t, fs)
	rec := do(t, r, issuer, http.MethodDelete, "/api/admin/organisers/olga@ufp.edu.pt", "admin", "")
	if rec.Code != 204 {
		t.Fatalf("got %d, want 204", rec.Code)
	}
	if fs.byEmail["olga@ufp.edu.pt"].Role != "user" {
		t.Fatalf("expected role user after revoke, got %s", fs.byEmail["olga@ufp.edu.pt"].Role)
	}
}
