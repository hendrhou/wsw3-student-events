// Package http wires registration-service's REST surface: student
// registration (with capacity check against event-service), organiser
// registration lists, CSV export, and credential-verified check-in.
package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/registration-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

// Store is the persistence contract the handlers need (faked in unit tests).
type Store interface {
	Register(ctx context.Context, eventID, userID, userName, studentNumber, status string) (*store.Registration, error)
	GetActiveForUser(ctx context.Context, eventID, userID string) (*store.Registration, error)
	GetByBookingRef(ctx context.Context, ref string) (*store.Registration, error)
	ListByEvent(ctx context.Context, eventID string, statuses []string) ([]store.Registration, error)
	ListByUser(ctx context.Context, userID string) ([]store.Registration, error)
	CheckIn(ctx context.Context, bookingRef string) (*store.Registration, bool, error)
}

// EventClient checks capacity/existence with event-service.
type EventClient interface {
	GetEvent(ctx context.Context, id string) (*EventView, error)
	AdjustCounters(ctx context.Context, id string, usedDelta, checkedInDelta int) error
}

// TicketClient triggers/verifies credentials with ticket-service.
type TicketClient interface {
	Issue(ctx context.Context, in IssueRequest) error
	Verify(ctx context.Context, vcToken string) (*VerifyResult, error)
	MarkVerified(ctx context.Context, bookingRef string) error
}

type EventView struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Date     string `json:"date"`
	Venue    string `json:"venue"`
	Full     bool   `json:"full"`
	Past     bool   `json:"past"`
	Capacity struct {
		Used  int `json:"used"`
		Total int `json:"total"`
	} `json:"capacity"`
}

type IssueRequest struct {
	BookingRef    string
	EventID       string
	EventTitle    string
	DateVenueLabel string
	UserID        string
	UserName      string
	StudentNumber string
}

type VerifyResult struct {
	Valid      bool   `json:"valid"`
	BookingRef string `json:"bookingRef"`
	Reason     string `json:"reason"`
}

type Handlers struct {
	Store  Store
	Events EventClient
	Tickets TicketClient
	Issuer *authx.Issuer
	Logger *slog.Logger
}

func RegisterRoutes(r *gin.Engine, h *Handlers) {
	authed := r.Group("/", authx.RequireAuth(h.Issuer))
	authed.POST("/api/events/:id/register", h.register)

	organiser := r.Group("/", authx.RequireAuth(h.Issuer), authx.RequireRole("organiser"))
	organiser.GET("/api/organiser/events/:id/registrations", h.listRegistrations)
	organiser.GET("/api/organiser/events/:id/export.csv", h.exportCSV)
	organiser.POST("/api/organiser/events/:id/check-in", h.checkIn)
}

// register: duplicate → 409; past → 409; full → 409 (waitlist lands as a
// follow-up); otherwise create + adjust capacity + trigger credential issuance.
func (h *Handlers) register(c *gin.Context) {
	eventID := c.Param("id")
	claims := authx.GetClaims(c)
	ctx := c.Request.Context()

	event, err := h.Events.GetEvent(ctx, eventID)
	if err != nil {
		if errors.Is(err, errEventNotFound) {
			httpx.NotFound(c, "Event")
			return
		}
		h.Logger.Error("event lookup failed", "error", err)
		httpx.Abort(c, 502, "event catalogue unavailable — retry in a moment")
		return
	}
	if event.Past {
		httpx.Conflict(c, "Event ended")
		return
	}
	if event.Full {
		httpx.Conflict(c, "No seats left")
		return
	}
	if existing, err := h.Store.GetActiveForUser(ctx, eventID, claims.UserID); err == nil && existing != nil {
		httpx.Conflict(c, "Already registered")
		return
	} else if err != nil && !errors.Is(err, store.ErrNotFound) {
		httpx.Internal(c)
		return
	}

	reg, err := h.Store.Register(ctx, eventID, claims.UserID, claims.Name, claims.StudentNumber, "Confirmed")
	if errors.Is(err, store.ErrDuplicate) {
		httpx.Conflict(c, "Already registered")
		return
	}
	if err != nil {
		h.Logger.Error("register failed", "error", err)
		httpx.Internal(c)
		return
	}

	if err := h.Events.AdjustCounters(ctx, eventID, 1, 0); err != nil {
		h.Logger.Warn("capacity counter adjustment failed", "event", eventID, "error", err)
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := h.Tickets.Issue(ctx, IssueRequest{
			BookingRef: reg.BookingRef, EventID: eventID, EventTitle: event.Title,
			DateVenueLabel: fmt.Sprintf("%s · %s", event.Date, event.Venue),
			UserID: claims.UserID, UserName: claims.Name, StudentNumber: claims.StudentNumber,
		}); err != nil {
			h.Logger.Warn("credential issuance trigger failed", "bookingRef", reg.BookingRef, "error", err)
		}
	}()

	c.JSON(201, gin.H{"bookingRef": reg.BookingRef})
}

type registrationDTO struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	StudentNumber string `json:"studentNumber"`
	RegisteredAt  string `json:"registeredAt"`
	Status        string `json:"status"`
}

func toDTO(r *store.Registration) registrationDTO {
	return registrationDTO{
		ID: r.ID, Name: r.UserName, StudentNumber: r.StudentNumber,
		RegisteredAt: r.RegisteredAt.Format("2006-01-02 15:04"), Status: r.Status,
	}
}

func tabStatuses(tab string) []string {
	switch tab {
	case "waitlist":
		return []string{"Waitlisted"}
	case "cancelled":
		return []string{"Cancelled"}
	default:
		return []string{"Confirmed", "Checked-in"}
	}
}

func (h *Handlers) listRegistrations(c *gin.Context) {
	regs, err := h.Store.ListByEvent(c.Request.Context(), c.Param("id"), tabStatuses(c.Query("tab")))
	if err != nil {
		httpx.Internal(c)
		return
	}
	out := make([]registrationDTO, 0, len(regs))
	for i := range regs {
		out = append(out, toDTO(&regs[i]))
	}
	c.JSON(200, out)
}

func (h *Handlers) exportCSV(c *gin.Context) {
	regs, err := h.Store.ListByEvent(c.Request.Context(), c.Param("id"), []string{"Confirmed", "Checked-in", "Waitlisted", "Cancelled"})
	if err != nil {
		httpx.Internal(c)
		return
	}
	q := strings.ToLower(c.Query("q"))
	var b strings.Builder
	b.WriteString("name,student_number,registered_at,status\n")
	for i := range regs {
		if q != "" && !strings.Contains(strings.ToLower(regs[i].UserName), q) && !strings.Contains(regs[i].StudentNumber, q) {
			continue
		}
		fmt.Fprintf(&b, "%s,%s,%s,%s\n", regs[i].UserName, regs[i].StudentNumber,
			regs[i].RegisteredAt.Format("2006-01-02 15:04"), regs[i].Status)
	}
	c.Header("Content-Disposition", `attachment; filename="registrations.csv"`)
	c.Data(200, "text/csv", []byte(b.String()))
}

// checkIn verifies the VC with ticket-service, then marks attendance.
// Never fails silently: every outcome maps to a named result.
func (h *Handlers) checkIn(c *gin.Context) {
	var body struct {
		VcToken string `json:"vcToken"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.VcToken) == "" {
		c.JSON(200, gin.H{"outcome": "invalid", "detail": "Credential unreadable"})
		return
	}
	ctx := c.Request.Context()

	verify, err := h.Tickets.Verify(ctx, body.VcToken)
	if err != nil {
		h.Logger.Warn("verification call failed", "error", err)
		c.JSON(200, gin.H{"outcome": "unavailable", "detail": "Network error — credential unreadable"})
		return
	}
	if !verify.Valid {
		c.JSON(200, gin.H{"outcome": "invalid", "detail": verify.Reason})
		return
	}

	reg, already, err := h.Store.CheckIn(ctx, verify.BookingRef)
	if errors.Is(err, store.ErrNotFound) {
		c.JSON(200, gin.H{"outcome": "invalid", "detail": "Wrong event"})
		return
	}
	if err != nil {
		h.Logger.Error("check-in failed", "error", err)
		httpx.Internal(c)
		return
	}
	if reg.EventID != c.Param("id") {
		c.JSON(200, gin.H{"outcome": "invalid", "detail": "Wrong event"})
		return
	}
	if already {
		c.JSON(200, gin.H{
			"outcome": "already_checked_in", "name": reg.UserName, "studentNumber": reg.StudentNumber,
			"detail": "Checked in at " + reg.CheckedInAt.Format("15:04"),
		})
		return
	}

	if err := h.Events.AdjustCounters(ctx, reg.EventID, 0, 1); err != nil {
		h.Logger.Warn("checked-in counter adjustment failed", "event", reg.EventID, "error", err)
	}
	if err := h.Tickets.MarkVerified(ctx, reg.BookingRef); err != nil {
		h.Logger.Warn("credential mark-verified failed", "bookingRef", reg.BookingRef, "error", err)
	}
	c.JSON(200, gin.H{"outcome": "verified", "name": reg.UserName, "studentNumber": reg.StudentNumber})
}

// errEventNotFound is returned by EventClient when the event does not exist.
var errEventNotFound = errors.New("event not found")

// ---------- HTTP peer clients (compose network) ----------

type httpEventClient struct {
	baseURL string
}

func NewEventClient(baseURL string) EventClient { return &httpEventClient{baseURL: strings.TrimRight(baseURL, "/")} }

func (c *httpEventClient) GetEvent(ctx context.Context, id string) (*EventView, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/events/"+id, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == 404 {
		return nil, errEventNotFound
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("event-service answered %d", resp.StatusCode)
	}
	var view EventView
	return &view, json.NewDecoder(resp.Body).Decode(&view)
}

func (c *httpEventClient) AdjustCounters(ctx context.Context, id string, usedDelta, checkedInDelta int) error {
	payload, _ := json.Marshal(gin.H{"usedDelta": usedDelta, "checkedInDelta": checkedInDelta})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/internal/events/"+id+"/counters", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != 204 {
		return fmt.Errorf("event-service counters answered %d", resp.StatusCode)
	}
	return nil
}

type httpTicketClient struct {
	baseURL string
}

func NewTicketClient(baseURL string) TicketClient { return &httpTicketClient{baseURL: strings.TrimRight(baseURL, "/")} }

func (c *httpTicketClient) post(ctx context.Context, path string, in, out any) error {
	payload, _ := json.Marshal(in)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("ticket-service %s answered %d", path, resp.StatusCode)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

func (c *httpTicketClient) Issue(ctx context.Context, in IssueRequest) error {
	return c.post(ctx, "/internal/tickets", gin.H{
		"bookingRef": in.BookingRef, "eventId": in.EventID, "eventTitle": in.EventTitle,
		"dateVenueLabel": in.DateVenueLabel, "userId": in.UserID, "userName": in.UserName,
		"studentNumber": in.StudentNumber,
	}, nil)
}

func (c *httpTicketClient) Verify(ctx context.Context, vcToken string) (*VerifyResult, error) {
	var out VerifyResult
	return &out, c.post(ctx, "/internal/tickets/verify", gin.H{"token": vcToken}, &out)
}

func (c *httpTicketClient) MarkVerified(ctx context.Context, bookingRef string) error {
	return c.post(ctx, "/internal/tickets/"+bookingRef+"/mark-verified", gin.H{}, nil)
}
