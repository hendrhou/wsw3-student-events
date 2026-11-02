// Package http wires the REST surface. DTOs match the frontend contract
// (frontend/packages/api/src/schema.ts) field-for-field, in camelCase.
package http

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/event-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

// Store is the persistence contract the handlers need (faked in unit tests).
type Store interface {
	List(ctx context.Context, f store.Filters) ([]store.Event, error)
	Get(ctx context.Context, id string) (*store.Event, error)
	ListMine(ctx context.Context, organiserID string) ([]store.Event, error)
	Create(ctx context.Context, e *store.Event) (string, error)
	Update(ctx context.Context, id, organiserID string, e *store.Event) error
	AdjustCounters(ctx context.Context, id string, usedDelta, checkedInDelta int) error
}

type Handlers struct {
	Store       Store
	Issuer      *authx.Issuer
	Logger      *slog.Logger
	SemanticURL string // optional push-on-write ingestion target
}

func RegisterRoutes(r *gin.Engine, h *Handlers) {
	r.GET("/api/events", h.listEvents)
	r.GET("/api/events/:id", h.getEvent)

	organiser := r.Group("/", authx.RequireAuth(h.Issuer), authx.RequireRole("organiser"))
	organiser.GET("/api/organiser/events", h.listMine)
	organiser.POST("/api/organiser/events", h.createEvent)
	organiser.PATCH("/api/organiser/events/:id", h.updateEvent)

	// Service-to-service (compose network only; not routed by Kong)
	r.POST("/internal/events/:id/counters", h.adjustCounters)
}

// ---------- DTOs (contract-shaped, camelCase) ----------

type capacityDTO struct {
	Used  int `json:"used"`
	Total int `json:"total"`
}

type summaryDTO struct {
	ID        string      `json:"id"`
	Title     string      `json:"title"`
	Category  string      `json:"category"`
	Date      string      `json:"date"`
	StartTime string      `json:"startTime"`
	EndTime   string      `json:"endTime"`
	Venue     string      `json:"venue"`
	CoverURL  *string     `json:"coverUrl"`
	Capacity  capacityDTO `json:"capacity"`
	Full      bool        `json:"full"`
}

type scheduleItem struct {
	Time string `json:"time"`
	Item string `json:"item"`
}

type detailDTO struct {
	summaryDTO
	ShortDescription     string         `json:"shortDescription"`
	About                string         `json:"about"`
	Organiser            string         `json:"organiser"`
	Competences          []string       `json:"competences"`
	Schedule             []scheduleItem `json:"schedule"`
	RegistrationDeadline *string        `json:"registrationDeadline"`
	Past                 bool           `json:"past"`
}

type organiserDTO struct {
	summaryDTO
	LifecycleStatus string `json:"lifecycleStatus"`
	CheckedIn       int    `json:"checkedIn"`
}

func toSummary(e *store.Event) summaryDTO {
	return summaryDTO{
		ID: e.ID, Title: e.Title, Category: e.Category,
		Date: e.Date.Format("2006-01-02"), StartTime: e.StartTime, EndTime: e.EndTime,
		Venue: e.Venue, CoverURL: e.CoverURL,
		Capacity: capacityDTO{Used: e.CapacityUsed, Total: e.CapacityTotal},
		Full:     e.CapacityUsed >= e.CapacityTotal,
	}
}

func toDetail(e *store.Event) detailDTO {
	var schedule []scheduleItem
	_ = json.Unmarshal(e.Schedule, &schedule)
	if schedule == nil {
		schedule = []scheduleItem{}
	}
	var deadline *string
	if e.RegistrationDeadline != nil {
		s := e.RegistrationDeadline.Format("2006-01-02")
		deadline = &s
	}
	return detailDTO{
		summaryDTO:           toSummary(e),
		ShortDescription:     e.ShortDescription,
		About:                e.About,
		Organiser:            e.OrganiserName,
		Competences:          nonNilStrings(e.Competences),
		Schedule:             schedule,
		RegistrationDeadline: deadline,
		Past:                 e.Date.Before(time.Now().Truncate(24*time.Hour)) || e.LifecycleStatus == "Past",
	}
}

func nonNilStrings(in []string) []string {
	if in == nil {
		return []string{}
	}
	return in
}

// ---------- handlers ----------

func (h *Handlers) listEvents(c *gin.Context) {
	events, err := h.Store.List(c.Request.Context(), store.Filters{
		Query:    c.Query("q"),
		Category: c.Query("category"),
		Date:     c.Query("date"),
		Venue:    c.Query("venue"),
	})
	if err != nil {
		h.Logger.Error("list events failed", "error", err)
		httpx.Internal(c)
		return
	}
	out := make([]summaryDTO, 0, len(events))
	for i := range events {
		out = append(out, toSummary(&events[i]))
	}
	c.JSON(200, out)
}

func (h *Handlers) getEvent(c *gin.Context) {
	event, err := h.Store.Get(c.Request.Context(), c.Param("id"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.NotFound(c, "Event")
		return
	}
	if err != nil {
		h.Logger.Error("get event failed", "error", err)
		httpx.Internal(c)
		return
	}
	c.JSON(200, toDetail(event))
}

func (h *Handlers) listMine(c *gin.Context) {
	claims := authx.GetClaims(c)
	events, err := h.Store.ListMine(c.Request.Context(), claims.UserID)
	if err != nil {
		h.Logger.Error("list mine failed", "error", err)
		httpx.Internal(c)
		return
	}
	out := make([]organiserDTO, 0, len(events))
	for i := range events {
		out = append(out, organiserDTO{
			summaryDTO:      toSummary(&events[i]),
			LifecycleStatus: events[i].LifecycleStatus,
			CheckedIn:       events[i].CheckedIn,
		})
	}
	c.JSON(200, out)
}

// eventPayload matches EventPayloadSchema on the frontend.
type eventPayload struct {
	Title                string   `json:"title"`
	ShortDescription     string   `json:"shortDescription"`
	FullDescription      string   `json:"fullDescription"`
	Category             string   `json:"category"`
	Date                 string   `json:"date"`
	StartTime            string   `json:"startTime"`
	EndTime              string   `json:"endTime"`
	Venue                string   `json:"venue"`
	Online               bool     `json:"online"`
	OnlineURL            *string  `json:"onlineUrl"`
	Capacity             int      `json:"capacity"`
	Waitlist             bool     `json:"waitlist"`
	RegistrationDeadline *string  `json:"registrationDeadline"`
	Topics               []string `json:"topics"`
}

func (p eventPayload) validate() string {
	switch {
	case strings.TrimSpace(p.Title) == "" || len(p.Title) > 80:
		return "title is required (80 characters max)"
	case strings.TrimSpace(p.ShortDescription) == "" || len(p.ShortDescription) > 200:
		return "short description is required (200 characters max)"
	case p.Category == "":
		return "category is required"
	case p.Date == "" || p.StartTime == "" || p.EndTime == "":
		return "date and start/end times are required"
	case !p.Online && strings.TrimSpace(p.Venue) == "":
		return "venue is required for on-site events"
	case p.Online && (p.OnlineURL == nil || *p.OnlineURL == ""):
		return "online URL is required for online events"
	case p.Capacity < 1:
		return "capacity must be at least 1"
	case len(p.Topics) == 0:
		return "at least one topic tag is required"
	}
	return ""
}

func (p eventPayload) toStore(organiserID, organiserName string) (*store.Event, error) {
	date, err := time.Parse("2006-01-02", p.Date)
	if err != nil {
		return nil, errors.New("date must be YYYY-MM-DD")
	}
	var deadline *time.Time
	if p.RegistrationDeadline != nil && *p.RegistrationDeadline != "" {
		d, err := time.Parse("2006-01-02", *p.RegistrationDeadline)
		if err != nil {
			return nil, errors.New("registration deadline must be YYYY-MM-DD")
		}
		deadline = &d
	}
	return &store.Event{
		Title: p.Title, Category: p.Category, ShortDescription: p.ShortDescription, About: p.FullDescription,
		Date: date, StartTime: p.StartTime, EndTime: p.EndTime, Venue: p.Venue,
		CapacityTotal: p.Capacity, RegistrationDeadline: deadline,
		OrganiserID: organiserID, OrganiserName: organiserName,
		Schedule: []byte("[]"), Competences: []string{}, Topics: p.Topics,
		Online: p.Online, OnlineURL: p.OnlineURL,
	}, nil
}

func (h *Handlers) createEvent(c *gin.Context) {
	var p eventPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		httpx.BadRequest(c, "invalid event payload")
		return
	}
	if msg := p.validate(); msg != "" {
		httpx.BadRequest(c, msg)
		return
	}
	claims := authx.GetClaims(c)
	event, err := p.toStore(claims.UserID, claims.Name)
	if err != nil {
		httpx.BadRequest(c, err.Error())
		return
	}
	id, err := h.Store.Create(c.Request.Context(), event)
	if err != nil {
		h.Logger.Error("create event failed", "error", err)
		httpx.Internal(c)
		return
	}
	event.ID = id
	go h.pushToSemantic(event)
	c.JSON(201, gin.H{"id": id})
}

func (h *Handlers) updateEvent(c *gin.Context) {
	var p eventPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		httpx.BadRequest(c, "invalid event payload")
		return
	}
	if msg := p.validate(); msg != "" {
		httpx.BadRequest(c, msg)
		return
	}
	claims := authx.GetClaims(c)
	event, err := p.toStore(claims.UserID, claims.Name)
	if err != nil {
		httpx.BadRequest(c, err.Error())
		return
	}
	if err := h.Store.Update(c.Request.Context(), c.Param("id"), claims.UserID, event); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			httpx.NotFound(c, "Event")
			return
		}
		h.Logger.Error("update event failed", "error", err)
		httpx.Internal(c)
		return
	}
	event.ID = c.Param("id")
	go h.pushToSemantic(event)
	c.JSON(200, gin.H{"id": event.ID})
}

type countersBody struct {
	UsedDelta      int `json:"usedDelta"`
	CheckedInDelta int `json:"checkedInDelta"`
}

func (h *Handlers) adjustCounters(c *gin.Context) {
	var body countersBody
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.BadRequest(c, "usedDelta/checkedInDelta must be integers")
		return
	}
	if err := h.Store.AdjustCounters(c.Request.Context(), c.Param("id"), body.UsedDelta, body.CheckedInDelta); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			httpx.NotFound(c, "Event")
			return
		}
		httpx.Internal(c)
		return
	}
	c.Status(204)
}

// pushToSemantic feeds the semantic layer (push-on-write; failure only logs).
func (h *Handlers) pushToSemantic(event *store.Event) {
	if h.SemanticURL == "" {
		return
	}
	payload, err := json.Marshal(gin.H{
		"id": event.ID, "title": event.Title, "category": event.Category,
		"date": event.Date.Format("2006-01-02"), "venue": event.Venue, "topics": event.Topics,
	})
	if err != nil {
		return
	}
	resp, err := http.Post(strings.TrimRight(h.SemanticURL, "/")+"/internal/ingest/event", "application/json", strings.NewReader(string(payload)))
	if err != nil {
		h.Logger.Warn("semantic ingestion failed", "error", err, "event", event.ID)
		return
	}
	_ = resp.Body.Close()
}
