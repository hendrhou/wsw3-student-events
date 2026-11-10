package http

import (
	"context"
	"encoding/json"
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
	staff       []*store.User
	byEmail     map[string]*store.User
	interests   []string
	setCaptured []string
	setRole     func(email, role string) (*store.User, error)
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
func (f *fakeStore) GetInterests(_ context.Context, _ string) ([]string, error) {
	return f.interests, nil
}
func (f *fakeStore) SetInterests(_ context.Context, _ string, uris []string) error {
	f.setCaptured = uris
	return nil
}
func (f *fakeStore) ListStaff(context.Context) ([]*store.User, error) { return f.staff, nil }
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

// newDevLoginServer registers routes with ALLOW_DEV_LOGIN semantics enabled.
func newDevLoginServer(t *testing.T, fs *fakeStore) (*gin.Engine, *authx.Issuer) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	issuer, err := authx.NewIssuer("test-secret-key-1234", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	RegisterRoutes(r, &Handlers{Store: fs, Issuer: issuer, AllowDevLogin: true, Logger: slog.Default()})
	return r, issuer
}

// doUnauthenticated issues a request without an Authorization header.
func doUnauthenticated(r *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
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

// ---------- dev login (local/test-only sign-in) ----------

func TestDevLoginHiddenWhenDisabled(t *testing.T) {
	r, _ := newTestServer(t, &fakeStore{byEmail: map[string]*store.User{}})
	rec := doUnauthenticated(r, http.MethodPost, "/api/auth/dev-login", `{"email":"vitor@ufp.edu.pt"}`)
	if rec.Code != 404 {
		t.Fatalf("dev login with ALLOW_DEV_LOGIN off: got %d, want 404", rec.Code)
	}
}

func TestDevLoginRejectsMalformedBody(t *testing.T) {
	r, _ := newDevLoginServer(t, &fakeStore{byEmail: map[string]*store.User{}})
	rec := doUnauthenticated(r, http.MethodPost, "/api/auth/dev-login", `{"email":""}`)
	if rec.Code != 400 {
		t.Fatalf("empty email: got %d, want 400", rec.Code)
	}
}

func TestDevLoginRejectsNonUfpDomain(t *testing.T) {
	r, _ := newDevLoginServer(t, &fakeStore{byEmail: map[string]*store.User{}})
	rec := doUnauthenticated(r, http.MethodPost, "/api/auth/dev-login", `{"email":"someone@gmail.com"}`)
	if rec.Code != 403 {
		t.Fatalf("gmail account: got %d, want 403", rec.Code)
	}
}

func TestDevLoginRejectsUnknownAccount(t *testing.T) {
	r, _ := newDevLoginServer(t, &fakeStore{byEmail: map[string]*store.User{}})
	rec := doUnauthenticated(r, http.MethodPost, "/api/auth/dev-login", `{"email":"ghost@ufp.edu.pt"}`)
	if rec.Code != 401 {
		t.Fatalf("unprovisioned account: got %d, want 401", rec.Code)
	}
}

func TestDevLoginIssuesUsableSessionToken(t *testing.T) {
	fs := &fakeStore{byEmail: map[string]*store.User{
		"vitor@ufp.edu.pt": {ID: "usr_v", Name: "Vítor", Email: "vitor@ufp.edu.pt", StudentNumber: "20220001", Role: "user"},
	}}
	r, _ := newDevLoginServer(t, fs)

	login := doUnauthenticated(r, http.MethodPost, "/api/auth/dev-login", `{"email":"vitor@ufp.edu.pt"}`)
	if login.Code != 200 {
		t.Fatalf("got %d, want 200 (%s)", login.Code, login.Body.String())
	}
	var body struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(login.Body.Bytes(), &body); err != nil || body.Token == "" {
		t.Fatalf("expected a token in the response, got %q (err=%v)", login.Body.String(), err)
	}

	// The issued token must authenticate against the protected profile endpoint.
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+body.Token)
	me := httptest.NewRecorder()
	r.ServeHTTP(me, req)
	if me.Code != 200 {
		t.Fatalf("/auth/me with dev-login token: got %d, want 200", me.Code)
	}
	if !strings.Contains(me.Body.String(), `"email":"vitor@ufp.edu.pt"`) || !strings.Contains(me.Body.String(), `"role":"user"`) {
		t.Fatalf("unexpected /auth/me body: %s", me.Body.String())
	}
}

// ---------- session profile ----------

func TestMeEchoesTokenClaims(t *testing.T) {
	r, issuer := newTestServer(t, &fakeStore{byEmail: map[string]*store.User{}})
	rec := do(t, r, issuer, http.MethodGet, "/api/auth/me", "organiser", "")
	if rec.Code != 200 {
		t.Fatalf("got %d, want 200", rec.Code)
	}
	body := rec.Body.String()
	for _, want := range []string{`"id":"usr_admin"`, `"email":"admin@ufp.edu.pt"`, `"role":"organiser"`} {
		if !strings.Contains(body, want) {
			t.Fatalf("body %s missing %s", body, want)
		}
	}
}

func TestMeRequiresAuth(t *testing.T) {
	r, _ := newTestServer(t, &fakeStore{byEmail: map[string]*store.User{}})
	if rec := doUnauthenticated(r, http.MethodGet, "/api/auth/me", ""); rec.Code != 401 {
		t.Fatalf("anonymous /auth/me: got %d, want 401", rec.Code)
	}
}

// ---------- profile interests ----------

func TestGetInterestsMapsOntologyUrisToContract(t *testing.T) {
	fs := &fakeStore{
		byEmail:   map[string]*store.User{},
		interests: []string{"https://campus-pulse.ufp.pt/ontology#SemanticWeb"},
	}
	r, issuer := newTestServer(t, fs)
	rec := do(t, r, issuer, http.MethodGet, "/api/profile/interests", "user", "")
	if rec.Code != 200 {
		t.Fatalf("got %d, want 200", rec.Code)
	}
	var got []map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("response is not a JSON array: %v (%s)", err, rec.Body.String())
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 interest, got %d (%s)", len(got), rec.Body.String())
	}
	item := got[0]
	if item["value"] != "semantic-web" || item["label"] != "Semantic Web" ||
		item["uri"] != "https://campus-pulse.ufp.pt/ontology#SemanticWeb" {
		t.Fatalf("unexpected interest mapping: %+v", item)
	}
}

func TestSetInterestsCanonicalisesValuesToUris(t *testing.T) {
	fs := &fakeStore{byEmail: map[string]*store.User{}}
	r, issuer := newTestServer(t, fs)
	rec := do(t, r, issuer, http.MethodPost, "/api/profile/interests", "user", `{"interests":["semantic-web","web3"]}`)
	if rec.Code != 200 {
		t.Fatalf("got %d, want 200 (%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"saved":2`) {
		t.Fatalf("expected saved count 2, got %s", rec.Body.String())
	}
	want := []string{
		"https://campus-pulse.ufp.pt/ontology#SemanticWeb",
		"https://campus-pulse.ufp.pt/ontology#Web3",
	}
	if len(fs.setCaptured) != len(want) {
		t.Fatalf("store captured %v, want %v", fs.setCaptured, want)
	}
	for i := range want {
		if fs.setCaptured[i] != want[i] {
			t.Fatalf("store captured %v, want %v", fs.setCaptured, want)
		}
	}
}

func TestSetInterestsRejectsNonArrayBody(t *testing.T) {
	r, issuer := newTestServer(t, &fakeStore{byEmail: map[string]*store.User{}})
	rec := do(t, r, issuer, http.MethodPost, "/api/profile/interests", "user", `{"interests":"web3"}`)
	if rec.Code != 400 {
		t.Fatalf("non-array interests: got %d, want 400", rec.Code)
	}
}

// ---------- OAuth return origin (friendly hostnames) ----------

func TestResolveOriginAllowlist(t *testing.T) {
	const fallback = "http://localhost:3000"
	cases := []struct{ name, raw, want string }{
		{"absent falls back", "", fallback},
		{"configured frontend allowed", "http://localhost:3000", "http://localhost:3000"},
		{"student hostname any port", "http://student.localhost:8000", "http://student.localhost:8000"},
		{"organiser hostname port-free", "http://organiser.localhost", "http://organiser.localhost"},
		{"loopback IP", "http://127.0.0.1:8000", "http://127.0.0.1:8000"},
		{"trailing slash trimmed", "http://localhost:9999/", "http://localhost:9999"},
		{"foreign https host rejected", "https://evil.example.com", fallback},
		{"suffix-spoofed host rejected", "http://localhost.evil.com", fallback},
		{"userinfo rejected", "http://user:pass@localhost:8000", fallback},
		{"path rejected", "http://localhost:8000/sneaky", fallback},
		{"non-http scheme rejected", "javascript:alert(1)", fallback},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolveOrigin(tc.raw, fallback); got != tc.want {
				t.Errorf("resolveOrigin(%q) = %q, want %q", tc.raw, got, tc.want)
			}
		})
	}
}
