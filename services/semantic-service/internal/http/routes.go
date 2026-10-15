// Package http wires semantic-service: ontology browsing (interest concepts)
// and SPARQL-backed recommendations, plus push-on-write ingestion.
package http

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/semantic-service/internal/sparql"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

// SPARQL is the store contract (faked in tests).
type SPARQL interface {
	Select(ctx context.Context, query string) ([]sparql.Binding, error)
	LoadTurtle(ctx context.Context, turtle string) error
}

// EventClient fetches full event summaries (semantic-service stores ids +
// topics; event-service stays the source of truth for capacity etc.).
type EventClient interface {
	GetEvent(ctx context.Context, id string) (map[string]any, error)
}

type Handlers struct {
	SPARQL      SPARQL
	Events      EventClient
	SessionKeys *authx.Issuer
	Logger      *slog.Logger
}

func RegisterRoutes(r *gin.Engine, h *Handlers) {
	r.GET("/api/ontology/interests", h.searchInterests)

	authed := r.Group("/", authx.RequireAuth(h.SessionKeys))
	authed.GET("/api/recommendations/me", h.recommendations)

	// Service-to-service ingestion (compose network only; not routed by Kong)
	r.POST("/internal/ingest/event", h.ingestEvent)
	r.POST("/internal/ingest/interests", h.ingestInterests)
}

// ---------- ontology browsing ----------

type interestDTO struct {
	Value string `json:"value"`
	Label string `json:"label"`
	URI   string `json:"uri"`
}

func (h *Handlers) searchInterests(c *gin.Context) {
	rows, err := h.SPARQL.Select(c.Request.Context(), sparql.SearchInterests(c.Query("q")))
	if err != nil {
		h.Logger.Error("interest search failed", "error", err)
		httpx.Abort(c, 502, "ontology store unavailable")
		return
	}
	out := make([]interestDTO, 0, len(rows))
	for _, row := range rows {
		uri := row["topic"]
		label := row["label"]
		out = append(out, interestDTO{Value: valueFromURI(uri), Label: label, URI: uri})
	}
	c.JSON(200, out)
}

// valueFromURI: "...ontology#SemanticWeb" → "semantic-web" (frontend value).
// Acronym fragments (all-caps like "RDF", "SPARQL") become a single lowercase word.
func valueFromURI(uri string) string {
	frag := uri
	if i := strings.LastIndex(uri, "#"); i >= 0 {
		frag = uri[i+1:]
	}
	if frag == strings.ToUpper(frag) {
		return strings.ToLower(frag)
	}
	var b strings.Builder
	for i, r := range frag {
		if r >= 'A' && r <= 'Z' && i > 0 {
			b.WriteByte('-')
		}
		b.WriteRune(r)
	}
	return strings.ToLower(b.String())
}

// ---------- recommendations ----------

func (h *Handlers) recommendations(c *gin.Context) {
	claims := authx.GetClaims(c)
	userURI := "https://campus-pulse.ufp.pt/users/" + claims.UserID
	ctx := c.Request.Context()

	rows, err := h.SPARQL.Select(ctx, sparql.RecommendationsForUser(userURI))
	if err != nil {
		h.Logger.Error("recommendation query failed", "error", err)
		httpx.Abort(c, 502, "recommendations unavailable")
		return
	}
	// Student-side fail-soft contract: an empty list hides the section.
	out := []gin.H{}
	for _, row := range rows {
		eventID := row["event"]
		if i := strings.LastIndex(eventID, "/"); i >= 0 {
			eventID = eventID[i+1:]
		}
		event, err := h.Events.GetEvent(ctx, eventID)
		if err != nil {
			h.Logger.Warn("recommended event missing from catalogue", "event", eventID, "error", err)
			continue
		}
		topicLabel := row["topicLabel"]
		out = append(out, gin.H{
			"event":       event,
			"matchReason": topicLabel,
			"explanation": fmt.Sprintf("Recommended because you follow %s and this event is tagged with it.", topicLabel),
		})
	}
	c.JSON(200, out)
}

// ---------- ingestion (push-on-write) ----------

type ingestEventBody struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Category string   `json:"category"`
	Date     string   `json:"date"`
	Venue    string   `json:"venue"`
	Topics   []string `json:"topics"`
}

func (h *Handlers) ingestEvent(c *gin.Context) {
	var body ingestEventBody
	if err := c.ShouldBindJSON(&body); err != nil || body.ID == "" {
		httpx.BadRequest(c, "id is required")
		return
	}
	var b strings.Builder
	esc := strings.ReplaceAll
	b.WriteString(fmt.Sprintf(`<https://campus-pulse.ufp.pt/events/%s> a cp:Event ;
	cp:eventTitle "%s" ; cp:eventCategory "%s" ; cp:eventDate "%s"^^xsd:date ; cp:venueName "%s"`,
		esc(body.ID, `"`, `\"`), esc(body.Title, `"`, `\"`), esc(body.Category, `"`, `\"`),
		esc(body.Date, `"`, `\"`), esc(body.Venue, `"`, `\"`)))
	for _, t := range body.Topics {
		b.WriteString(fmt.Sprintf(" ; cp:hasTopic cp:%s", pascal(t)))
	}
	b.WriteString(" .")
	if err := h.SPARQL.LoadTurtle(c.Request.Context(), "@prefix cp: <https://campus-pulse.ufp.pt/ontology#> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n"+b.String()); err != nil {
		h.Logger.Error("event ingestion failed", "error", err)
		httpx.Abort(c, 502, "ontology store unavailable")
		return
	}
	c.Status(204)
}

type ingestInterestsBody struct {
	UserID        string   `json:"userId"`
	InterestURIs  []string `json:"interestUris"`
}

func (h *Handlers) ingestInterests(c *gin.Context) {
	var body ingestInterestsBody
	if err := c.ShouldBindJSON(&body); err != nil || body.UserID == "" {
		httpx.BadRequest(c, "userId is required")
		return
	}
	var b strings.Builder
	for _, uri := range body.InterestURIs {
		frag := uri
		if i := strings.LastIndex(uri, "#"); i >= 0 {
			frag = uri[i+1:]
		}
		b.WriteString(fmt.Sprintf("<https://campus-pulse.ufp.pt/users/%s> a cp:Participant ; cp:hasInterest cp:%s .\n", body.UserID, frag))
	}
	if err := h.SPARQL.LoadTurtle(c.Request.Context(), "@prefix cp: <https://campus-pulse.ufp.pt/ontology#> .\n"+b.String()); err != nil {
		h.Logger.Error("interest ingestion failed", "error", err)
		httpx.Abort(c, 502, "ontology store unavailable")
		return
	}
	c.Status(204)
}

func pascal(value string) string {
	parts := strings.FieldsFunc(value, func(r rune) bool { return r == '-' || r == ' ' })
	for i, p := range parts {
		if p != "" {
			parts[i] = strings.ToUpper(p[:1]) + p[1:]
		}
	}
	return strings.Join(parts, "")
}

// ---------- HTTP peer client for event-service ----------

type httpEventClient struct{ baseURL string }

func NewEventClient(baseURL string) EventClient {
	return &httpEventClient{baseURL: strings.TrimRight(baseURL, "/")}
}

func (c *httpEventClient) GetEvent(ctx context.Context, id string) (map[string]any, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/events/"+id, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("event-service answered %d", resp.StatusCode)
	}
	var out map[string]any
	return out, json.NewDecoder(resp.Body).Decode(&out)
}
