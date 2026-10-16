package http

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
	"github.com/hendrhou/wsw3-student-events/services/ticket-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/ticket-service/internal/vc"
)

type fakeStore struct {
	tickets []store.Ticket
}

func (f *fakeStore) Create(_ context.Context, t *store.Ticket) error {
	for _, x := range f.tickets {
		if x.BookingRef == t.BookingRef {
			return nil // idempotent
		}
	}
	t.Status = "Issued"
	t.IssuedAt = time.Now()
	f.tickets = append(f.tickets, *t)
	return nil
}

func (f *fakeStore) AttachCredential(_ context.Context, ref string, cred []byte, jwt string) error {
	for i := range f.tickets {
		if f.tickets[i].BookingRef == ref {
			f.tickets[i].Credential = cred
			f.tickets[i].VcJWT = &jwt
		}
	}
	return nil
}

func (f *fakeStore) GetByBookingRef(_ context.Context, ref string) (*store.Ticket, error) {
	for _, t := range f.tickets {
		if t.BookingRef == ref {
			return &t, nil
		}
	}
	return nil, store.ErrNotFound
}

func (f *fakeStore) ListByUser(_ context.Context, userID string) ([]store.Ticket, error) {
	var out []store.Ticket
	for _, t := range f.tickets {
		if t.UserID == userID {
			out = append(out, t)
		}
	}
	return out, nil
}

func (f *fakeStore) Unsigned(context.Context) ([]store.Ticket, error) { return nil, nil }

func (f *fakeStore) MarkVerified(_ context.Context, ref string) error {
	for i := range f.tickets {
		if f.tickets[i].BookingRef == ref {
			f.tickets[i].Status = "Verified"
		}
	}
	return nil
}

const testSecret = "test-secret-key-1234567890"

func testHandlers(st Store) *Handlers {
	seed := make([]byte, 32)
	for i := range seed {
		seed[i] = byte(i + 1)
	}
	issuer, _ := vc.NewIssuer(seed)
	sessionKeys, _ := authx.NewIssuer(testSecret, time.Hour)
	return &Handlers{
		Store: st, Issuer: issuer, SessionKeys: sessionKeys,
		Logger:        slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil)),
		PublicBaseURL: "http://localhost:8000",
	}
}

func setup(h *Handlers) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(httpx.RequestLogger(h.Logger), httpx.Recovery(h.Logger))
	RegisterRoutes(r, h)
	return r
}

func userToken(t *testing.T) string {
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	tok, err := issuer.Issue("usr_vitor", "Vítor Carvalho", "vitor@ufp.edu.pt", "20220123", "user")
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestIssueThenWalletThenPublicVerify(t *testing.T) {
	st := &fakeStore{}
	r := setup(testHandlers(st))

	// 1. registration-service triggers issuance
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/internal/tickets", strings.NewReader(
		`{"bookingRef":"CP-2026-10001","eventId":"evt-hackathon","eventTitle":"UFP Hackathon 2026","dateVenueLabel":"Sat 7 Nov · Main Hall","eventDate":"2026-11-07","userId":"usr_vitor","userName":"Vítor Carvalho","studentNumber":"20220123"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 201 {
		t.Fatalf("issue: expected 201, got %d %q", w.Code, w.Body.String())
	}

	// 2. wallet lists the ticket with the contract shape
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/tickets", nil)
	req.Header.Set("Authorization", "Bearer "+userToken(t))
	r.ServeHTTP(w, req)
	var out []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil || len(out) != 1 {
		t.Fatalf("wallet: %v %q", err, w.Body.String())
	}
	tk := out[0]
	for _, key := range []string{"id", "eventId", "eventTitle", "dateVenueLabel", "bookingRef", "status", "credentialStatus", "credential", "vcJwt", "verifierUrl"} {
		if _, ok := tk[key]; !ok {
			t.Errorf("ticket missing contract key %q", key)
		}
	}
	if tk["credentialStatus"] != "Issued" || tk["status"] != "upcoming" {
		t.Errorf("statuses wrong: %v", tk)
	}
	jwt, _ := tk["vcJwt"].(string)
	if jwt == "" {
		t.Fatal("vcJwt missing")
	}

	// 3. third-party verification — no auth, signature + revocation checked
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/tickets/verify?token="+jwt, nil))
	var verify map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &verify)
	if verify["valid"] != true {
		t.Errorf("public verify must pass: %v", verify)
	}

	// 4. tampered token is rejected
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/tickets/verify?token="+jwt[:len(jwt)-4]+"AAAA", nil))
	_ = json.Unmarshal(w.Body.Bytes(), &verify)
	if verify["valid"] != false {
		t.Error("tampered token must not verify")
	}
}

func TestVerifyUnknownOrRevoked(t *testing.T) {
	h := testHandlers(&fakeStore{})
	r := setup(h)
	// Sign a credential the store does not know
	token, _, _ := h.Issuer.Issue("CP-UNKNOWN", "20220123", "e1", "T", time.Now())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/tickets/verify?token="+token, nil))
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if out["valid"] != false || out["reason"] != "unknown credential" {
		t.Errorf("got %v", out)
	}
}

func TestWalletRequiresAuth(t *testing.T) {
	r := setup(testHandlers(&fakeStore{}))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/tickets", nil))
	if w.Code != 401 {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestCredentialStatusOwnership(t *testing.T) {
	st := &fakeStore{}
	h := testHandlers(st)
	r := setup(h)
	if err := h.IssueOne(context.Background(), issueBody{
		BookingRef: "CP-1", EventID: "e1", EventTitle: "T", DateVenueLabel: "d",
		EventDate: "2026-12-01", UserID: "usr_other", UserName: "O", StudentNumber: "999",
	}); err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/tickets/CP-1/credential-status", nil)
	req.Header.Set("Authorization", "Bearer "+userToken(t))
	r.ServeHTTP(w, req)
	if w.Code != 403 {
		t.Errorf("someone else's ticket: expected 403, got %d", w.Code)
	}
}

func TestMarkVerifiedIsIdempotent(t *testing.T) {
	st := &fakeStore{}
	h := testHandlers(st)
	r := setup(h)
	if err := h.IssueOne(context.Background(), issueBody{
		BookingRef: "CP-2", EventID: "e1", EventTitle: "T", DateVenueLabel: "d",
		EventDate: "2026-12-01", UserID: "usr_vitor", UserName: "V", StudentNumber: "20220123",
	}); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/internal/tickets/CP-2/mark-verified", strings.NewReader("{}")))
		if w.Code != 204 {
			t.Fatalf("mark-verified %d: got %d", i, w.Code)
		}
	}
	if st.tickets[0].Status != "Verified" {
		t.Error("status must be Verified")
	}
}
