package http

import (
	"bytes"
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
	"github.com/hendrhou/wsw3-student-events/services/registration-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

// ---------- fakes ----------

type fakeStore struct {
	regs []store.Registration
	seq  int
}

func (f *fakeStore) Register(_ context.Context, eventID, userID, name, number, status string) (*store.Registration, error) {
	for _, r := range f.regs {
		if r.EventID == eventID && r.UserID == userID && r.Status != "Cancelled" {
			return nil, store.ErrDuplicate
		}
	}
	f.seq++
	reg := store.Registration{
		ID: "reg_new", BookingRef: "CP-2026-9000" + string(rune('0'+f.seq)),
		EventID: eventID, UserID: userID, UserName: name, StudentNumber: number,
		Status: status, RegisteredAt: time.Now(),
	}
	f.regs = append(f.regs, reg)
	return &reg, nil
}

func (f *fakeStore) GetActiveForUser(_ context.Context, eventID, userID string) (*store.Registration, error) {
	for _, r := range f.regs {
		if r.EventID == eventID && r.UserID == userID && r.Status != "Cancelled" {
			return &r, nil
		}
	}
	return nil, store.ErrNotFound
}

func (f *fakeStore) GetByBookingRef(_ context.Context, ref string) (*store.Registration, error) {
	for _, r := range f.regs {
		if r.BookingRef == ref {
			return &r, nil
		}
	}
	return nil, store.ErrNotFound
}

func (f *fakeStore) ListByEvent(_ context.Context, eventID string, statuses []string) ([]store.Registration, error) {
	var out []store.Registration
	for _, r := range f.regs {
		if r.EventID != eventID {
			continue
		}
		for _, s := range statuses {
			if r.Status == s {
				out = append(out, r)
			}
		}
	}
	return out, nil
}

func (f *fakeStore) ListByUser(_ context.Context, userID string) ([]store.Registration, error) {
	var out []store.Registration
	for _, r := range f.regs {
		if r.UserID == userID && r.Status != "Cancelled" {
			out = append(out, r)
		}
	}
	return out, nil
}

func (f *fakeStore) CheckIn(_ context.Context, ref string) (*store.Registration, bool, error) {
	for i, r := range f.regs {
		if r.BookingRef == ref {
			if r.Status == "Checked-in" {
				now := time.Now().Add(-time.Hour)
				f.regs[i].CheckedInAt = &now
				return &f.regs[i], true, nil
			}
			f.regs[i].Status = "Checked-in"
			now := time.Now()
			f.regs[i].CheckedInAt = &now
			return &f.regs[i], false, nil
		}
	}
	return nil, false, store.ErrNotFound
}

type fakeEvents struct {
	view      *EventView
	adjusted  []string
	lookupErr error
}

func (f *fakeEvents) GetEvent(context.Context, string) (*EventView, error) { return f.view, f.lookupErr }
func (f *fakeEvents) AdjustCounters(_ context.Context, id string, _, _ int) error {
	f.adjusted = append(f.adjusted, id)
	return nil
}

type fakeTickets struct {
	issued  []IssueRequest
	verify  *VerifyResult
	verifyErr error
	marked  []string
}

func (f *fakeTickets) Issue(_ context.Context, in IssueRequest) error {
	f.issued = append(f.issued, in)
	return nil
}
func (f *fakeTickets) Verify(context.Context, string) (*VerifyResult, error) { return f.verify, f.verifyErr }
func (f *fakeTickets) MarkVerified(_ context.Context, ref string) error {
	f.marked = append(f.marked, ref)
	return nil
}

// ---------- helpers ----------

const testSecret = "test-secret-key-1234567890"

func openEvent() *EventView {
	v := &EventView{ID: "evt-hackathon", Title: "UFP Hackathon 2026", Date: "2026-11-07", Venue: "Main Hall"}
	v.Capacity.Used, v.Capacity.Total = 96, 120
	return v
}

func setup(st Store, ev EventClient, tk TicketClient) *gin.Engine {
	gin.SetMode(gin.TestMode)
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	r := gin.New()
	logger := slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil))
	r.Use(httpx.RequestLogger(logger), httpx.Recovery(logger))
	RegisterRoutes(r, &Handlers{Store: st, Events: ev, Tickets: tk, Issuer: issuer, Logger: logger})
	return r
}

func token(t *testing.T, role string) string {
	issuer, _ := authx.NewIssuer(testSecret, time.Hour)
	tok, err := issuer.Issue("usr_vitor", "Vítor Carvalho", "vitor@ufp.edu.pt", "20220123", role)
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func authedReq(t *testing.T, method, path, body, role string) *http.Request {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token(t, role))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// ---------- register ----------

func TestRegisterHappyPathIssuesCredential(t *testing.T) {
	tk := &fakeTickets{}
	r := setup(&fakeStore{}, &fakeEvents{view: openEvent()}, tk)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodPost, "/api/events/evt-hackathon/register", "{}", "user"))
	if w.Code != 201 {
		t.Fatalf("expected 201, got %d %q", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "bookingRef") {
		t.Errorf("missing bookingRef: %q", w.Body.String())
	}
	// Issuance is async — give the goroutine a beat
	time.Sleep(50 * time.Millisecond)
	if len(tk.issued) != 1 || tk.issued[0].StudentNumber != "20220123" {
		t.Errorf("credential issuance not triggered: %+v", tk.issued)
	}
}

func TestRegisterDuplicate409(t *testing.T) {
	st := &fakeStore{regs: []store.Registration{{BookingRef: "CP-1", EventID: "evt-hackathon", UserID: "usr_vitor", Status: "Confirmed"}}}
	r := setup(st, &fakeEvents{view: openEvent()}, &fakeTickets{})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodPost, "/api/events/evt-hackathon/register", "{}", "user"))
	if w.Code != 409 || !strings.Contains(w.Body.String(), "Already registered") {
		t.Errorf("got %d %q", w.Code, w.Body.String())
	}
}

func TestRegisterFull409(t *testing.T) {
	full := openEvent()
	full.Full = true
	r := setup(&fakeStore{}, &fakeEvents{view: full}, &fakeTickets{})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodPost, "/api/events/evt-hackathon/register", "{}", "user"))
	if w.Code != 409 || !strings.Contains(w.Body.String(), "No seats left") {
		t.Errorf("got %d %q", w.Code, w.Body.String())
	}
}

func TestRegisterUnknownEvent404(t *testing.T) {
	r := setup(&fakeStore{}, &fakeEvents{lookupErr: errEventNotFound}, &fakeTickets{})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodPost, "/api/events/nope/register", "{}", "user"))
	if w.Code != 404 {
		t.Errorf("got %d", w.Code)
	}
}

// ---------- organiser lists & export ----------

func TestListRegistrationsByTab(t *testing.T) {
	st := &fakeStore{regs: []store.Registration{
		{ID: "1", BookingRef: "CP-1", EventID: "e1", UserName: "Ana Silva", StudentNumber: "20220123", Status: "Confirmed", RegisteredAt: time.Date(2026, 10, 1, 14, 22, 0, 0, time.UTC)},
		{ID: "2", BookingRef: "CP-2", EventID: "e1", UserName: "Bruno Martins", StudentNumber: "20210456", Status: "Waitlisted", RegisteredAt: time.Now()},
	}}
	r := setup(st, &fakeEvents{view: openEvent()}, &fakeTickets{})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodGet, "/api/organiser/events/e1/registrations?tab=registered", "", "organiser"))
	var rows []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &rows)
	if len(rows) != 1 || rows[0]["name"] != "Ana Silva" {
		t.Errorf("registered tab: %v", rows)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodGet, "/api/organiser/events/e1/registrations?tab=waitlist", "", "organiser"))
	_ = json.Unmarshal(w.Body.Bytes(), &rows)
	if len(rows) != 1 || rows[0]["status"] != "Waitlisted" {
		t.Errorf("waitlist tab: %v", rows)
	}
}

func TestListRegistrationsRequiresOrganiser(t *testing.T) {
	r := setup(&fakeStore{}, &fakeEvents{}, &fakeTickets{})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodGet, "/api/organiser/events/e1/registrations", "", "user"))
	if w.Code != 403 {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestExportCSVRespectsSearch(t *testing.T) {
	st := &fakeStore{regs: []store.Registration{
		{ID: "1", BookingRef: "CP-1", EventID: "e1", UserName: "Ana Silva", StudentNumber: "20220123", Status: "Confirmed", RegisteredAt: time.Date(2026, 10, 1, 14, 22, 0, 0, time.UTC)},
		{ID: "2", BookingRef: "CP-2", EventID: "e1", UserName: "Bruno Martins", StudentNumber: "20210456", Status: "Confirmed", RegisteredAt: time.Now()},
	}}
	r := setup(st, &fakeEvents{}, &fakeTickets{})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodGet, "/api/organiser/events/e1/export.csv?q=ana", "", "organiser"))
	body := w.Body.String()
	if !strings.Contains(body, "Ana Silva") || strings.Contains(body, "Bruno") {
		t.Errorf("csv filter wrong: %q", body)
	}
	if !strings.HasPrefix(body, "name,student_number") {
		t.Errorf("missing header: %q", body)
	}
}

// ---------- check-in ----------

func TestCheckInVerified(t *testing.T) {
	st := &fakeStore{regs: []store.Registration{{ID: "1", BookingRef: "CP-1", EventID: "e1", UserName: "Ana Silva", StudentNumber: "20220123", Status: "Confirmed"}}}
	ev := &fakeEvents{view: openEvent()}
	tk := &fakeTickets{verify: &VerifyResult{Valid: true, BookingRef: "CP-1"}}
	r := setup(st, ev, tk)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodPost, "/api/organiser/events/e1/check-in", `{"vcToken":"ok"}`, "organiser"))
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if out["outcome"] != "verified" || out["name"] != "Ana Silva" {
		t.Errorf("got %v", out)
	}
	if len(tk.marked) != 1 || len(ev.adjusted) != 1 {
		t.Errorf("side effects missing: marked=%v adjusted=%v", tk.marked, ev.adjusted)
	}
}

func TestCheckInAlreadyCheckedIn(t *testing.T) {
	st := &fakeStore{regs: []store.Registration{{ID: "1", BookingRef: "CP-1", EventID: "e1", UserName: "Ana Silva", StudentNumber: "20220123", Status: "Checked-in"}}}
	tk := &fakeTickets{verify: &VerifyResult{Valid: true, BookingRef: "CP-1"}}
	r := setup(st, &fakeEvents{}, tk)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodPost, "/api/organiser/events/e1/check-in", `{"vcToken":"ok"}`, "organiser"))
	if !strings.Contains(w.Body.String(), "already_checked_in") {
		t.Errorf("got %q", w.Body.String())
	}
}

func TestCheckInInvalidCredential(t *testing.T) {
	tk := &fakeTickets{verify: &VerifyResult{Valid: false, Reason: "Credential revoked"}}
	r := setup(&fakeStore{}, &fakeEvents{}, tk)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodPost, "/api/organiser/events/e1/check-in", `{"vcToken":"bad"}`, "organiser"))
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if out["outcome"] != "invalid" || out["detail"] != "Credential revoked" {
		t.Errorf("got %v", out)
	}
}

func TestCheckInWrongEvent(t *testing.T) {
	st := &fakeStore{regs: []store.Registration{{ID: "1", BookingRef: "CP-1", EventID: "other-event", UserName: "Ana Silva", Status: "Confirmed"}}}
	tk := &fakeTickets{verify: &VerifyResult{Valid: true, BookingRef: "CP-1"}}
	r := setup(st, &fakeEvents{}, tk)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodPost, "/api/organiser/events/e1/check-in", `{"vcToken":"ok"}`, "organiser"))
	if !strings.Contains(w.Body.String(), "Wrong event") {
		t.Errorf("got %q", w.Body.String())
	}
}

func TestCheckInVerificationUnavailable(t *testing.T) {
	tk := &fakeTickets{verifyErr: errors.New("connection refused")}
	r := setup(&fakeStore{}, &fakeEvents{}, tk)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, authedReq(t, http.MethodPost, "/api/organiser/events/e1/check-in", `{"vcToken":"ok"}`, "organiser"))
	if !strings.Contains(w.Body.String(), "unavailable") {
		t.Errorf("got %q", w.Body.String())
	}
}
