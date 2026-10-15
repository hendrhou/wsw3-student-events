// Package http wires ticket-service: VC issuance (internal), the student's
// ticket wallet, and the public third-party verification endpoint.
package http

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
	"github.com/hendrhou/wsw3-student-events/services/ticket-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/ticket-service/internal/vc"
)

type Store interface {
	Create(ctx context.Context, t *store.Ticket) error
	AttachCredential(ctx context.Context, bookingRef string, credential []byte, vcJWT string) error
	GetByBookingRef(ctx context.Context, ref string) (*store.Ticket, error)
	ListByUser(ctx context.Context, userID string) ([]store.Ticket, error)
	Unsigned(ctx context.Context) ([]store.Ticket, error)
	MarkVerified(ctx context.Context, bookingRef string) error
}

type Handlers struct {
	Store       Store
	Issuer      *vc.Issuer
	SessionKeys *authx.Issuer
	Logger      *slog.Logger
	PublicBaseURL string
}

func RegisterRoutes(r *gin.Engine, h *Handlers) {
	authed := r.Group("/", authx.RequireAuth(h.SessionKeys))
	authed.GET("/api/tickets", h.listMine)
	authed.GET("/api/tickets/:id/credential-status", h.credentialStatus)

	// Public third-party verification — no auth by design (Web 3.0 story).
	r.GET("/api/tickets/verify", h.publicVerify)

	// Service-to-service (compose network only; not routed by Kong)
	r.POST("/internal/tickets", h.issue)
	r.POST("/internal/tickets/verify", h.internalVerify)
	r.POST("/internal/tickets/:bookingRef/mark-verified", h.markVerified)
}

// ---------- DTOs (contract-shaped) ----------

type ticketDTO struct {
	ID               string          `json:"id"`
	EventID          string          `json:"eventId"`
	EventTitle       string          `json:"eventTitle"`
	DateVenueLabel   string          `json:"dateVenueLabel"`
	BookingRef       string          `json:"bookingRef"`
	Status           string          `json:"status"`
	CredentialStatus string          `json:"credentialStatus"`
	Credential       json.RawMessage `json:"credential"`
	VcJWT            *string         `json:"vcJwt"`
	VerifierURL      *string         `json:"verifierUrl"`
}

func (h *Handlers) toDTO(t *store.Ticket) ticketDTO {
	today := time.Now().Truncate(24 * time.Hour)
	past := t.EventDate.Before(today)

	credentialStatus := t.Status
	if past && credentialStatus == "Issued" {
		credentialStatus = "Expired"
	}
	ticketStatus := "upcoming"
	if past {
		ticketStatus = "past"
	}
	if credentialStatus == "Revoked" {
		ticketStatus = "cancelled"
	}

	var credential json.RawMessage
	if len(t.Credential) > 0 {
		credential = json.RawMessage(t.Credential)
	}
	var verifierURL *string
	if t.VcJWT != nil {
		u := strings.TrimRight(h.PublicBaseURL, "/") + "/api/tickets/verify?token=" + *t.VcJWT
		verifierURL = &u
	}

	return ticketDTO{
		ID: t.ID, EventID: t.EventID, EventTitle: t.EventTitle, DateVenueLabel: t.DateVenueLabel,
		BookingRef: t.BookingRef, Status: ticketStatus, CredentialStatus: credentialStatus,
		Credential: credential, VcJWT: t.VcJWT, VerifierURL: verifierURL,
	}
}

// ---------- student endpoints ----------

func (h *Handlers) listMine(c *gin.Context) {
	claims := authx.GetClaims(c)
	tickets, err := h.Store.ListByUser(c.Request.Context(), claims.UserID)
	if err != nil {
		httpx.Internal(c)
		return
	}
	out := make([]ticketDTO, 0, len(tickets))
	for i := range tickets {
		out = append(out, h.toDTO(&tickets[i]))
	}
	c.JSON(200, out)
}

func (h *Handlers) credentialStatus(c *gin.Context) {
	claims := authx.GetClaims(c)
	t, err := h.Store.GetByBookingRef(c.Request.Context(), c.Param("id"))
	if errors.Is(err, store.ErrNotFound) {
		// The registration flow polls with the booking ref; accept the ticket id too
		httpx.NotFound(c, "Ticket")
		return
	}
	if err != nil {
		httpx.Internal(c)
		return
	}
	if t.UserID != claims.UserID {
		httpx.Abort(c, 403, "not your ticket")
		return
	}
	c.JSON(200, gin.H{"status": h.toDTO(t).CredentialStatus})
}

// ---------- public verification (no auth: third-party verifiability) ----------

func (h *Handlers) publicVerify(c *gin.Context) {
	h.verifyAndAnswer(c, c.Query("token"), true)
}

func (h *Handlers) internalVerify(c *gin.Context) {
	var body struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.BadRequest(c, "token is required")
		return
	}
	h.verifyAndAnswer(c, body.Token, false)
}

// verifyAndAnswer: cryptographic check first (works offline for any verifier),
// then the revocation check against our store (needs network — documented).
func (h *Handlers) verifyAndAnswer(c *gin.Context, token string, public bool) {
	payload, err := vc.Verify(token)
	if err != nil {
		out := gin.H{"valid": false, "reason": "invalid signature or malformed credential"}
		if public {
			c.JSON(200, out)
		} else {
			c.JSON(200, gin.H{"valid": false, "bookingRef": "", "reason": out["reason"]})
		}
		return
	}
	bookingRef, _ := payload["jti"].(string)
	t, err := h.Store.GetByBookingRef(c.Request.Context(), bookingRef)
	if errors.Is(err, store.ErrNotFound) {
		c.JSON(200, gin.H{"valid": false, "bookingRef": bookingRef, "reason": "unknown credential"})
		return
	}
	if err != nil {
		httpx.Internal(c)
		return
	}
	if t.Status == "Revoked" {
		c.JSON(200, gin.H{"valid": false, "bookingRef": bookingRef, "reason": "Credential revoked"})
		return
	}
	c.JSON(200, gin.H{
		"valid": true, "bookingRef": bookingRef, "status": t.Status,
		"credential": json.RawMessage(t.Credential),
		"studentNumber": t.StudentNumber, "eventTitle": t.EventTitle,
	})
}

// ---------- issuance (internal) ----------

type issueBody struct {
	BookingRef     string `json:"bookingRef"`
	EventID        string `json:"eventId"`
	EventTitle     string `json:"eventTitle"`
	DateVenueLabel string `json:"dateVenueLabel"`
	EventDate      string `json:"eventDate"`
	UserID         string `json:"userId"`
	UserName       string `json:"userName"`
	StudentNumber  string `json:"studentNumber"`
}

func (h *Handlers) issue(c *gin.Context) {
	var body issueBody
	if err := c.ShouldBindJSON(&body); err != nil || body.BookingRef == "" {
		httpx.BadRequest(c, "bookingRef is required")
		return
	}
	if err := h.IssueOne(c.Request.Context(), body); err != nil {
		h.Logger.Error("issuance failed", "bookingRef", body.BookingRef, "error", err)
		httpx.Internal(c)
		return
	}
	c.Status(201)
}

// IssueOne creates (idempotently) and signs a credential. Shared by the HTTP
// handler and the startup backfill for seeded tickets.
func (h *Handlers) IssueOne(ctx context.Context, body issueBody) error {
	eventDate := body.EventDate
	if eventDate == "" {
		eventDate = time.Now().Add(7 * 24 * time.Hour).Format("2006-01-02")
	}
	t := &store.Ticket{
		ID: "tkt_" + bookingSlug(body.BookingRef), BookingRef: body.BookingRef,
		EventID: body.EventID, EventTitle: body.EventTitle, DateVenueLabel: body.DateVenueLabel,
		UserID: body.UserID, UserName: body.UserName, StudentNumber: body.StudentNumber,
	}
	parsed, err := time.Parse("2006-01-02", eventDate)
	if err != nil {
		return errors.New("eventDate must be YYYY-MM-DD")
	}
	t.EventDate = parsed

	if err := h.Store.Create(ctx, t); err != nil {
		return err
	}
	token, credJSON, err := h.Issuer.Issue(body.BookingRef, body.StudentNumber, body.EventID, body.EventTitle, time.Now())
	if err != nil {
		return err
	}
	credBytes, _ := json.Marshal(credJSON)
	return h.Store.AttachCredential(ctx, body.BookingRef, credBytes, token)
}

// SignUnsigned backfills seeded tickets on boot (proves issuance on fresh envs).
func (h *Handlers) SignUnsigned(ctx context.Context) error {
	unsigned, err := h.Store.Unsigned(ctx)
	if err != nil {
		return err
	}
	for _, t := range unsigned {
		err := h.IssueOne(ctx, issueBody{
			BookingRef: t.BookingRef, EventID: t.EventID, EventTitle: t.EventTitle,
			DateVenueLabel: t.DateVenueLabel, EventDate: t.EventDate.Format("2006-01-02"),
			UserID: t.UserID, UserName: t.UserName, StudentNumber: t.StudentNumber,
		})
		if err != nil {
			return err
		}
		h.Logger.Info("seeded ticket signed", "bookingRef", t.BookingRef)
	}
	return nil
}

func (h *Handlers) markVerified(c *gin.Context) {
	if err := h.Store.MarkVerified(c.Request.Context(), c.Param("bookingRef")); err != nil {
		httpx.Internal(c)
		return
	}
	c.Status(204)
}

func bookingSlug(ref string) string {
	return strings.ToLower(strings.ReplaceAll(ref, "-", ""))
}
