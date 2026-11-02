// Package http wires user-service's REST surface: Google OIDC sign-in,
// dev login (local only), session introspection, and interest profile.
package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
	"github.com/hendrhou/wsw3-student-events/services/user-service/internal/auth"
	"github.com/hendrhou/wsw3-student-events/services/user-service/internal/store"
)

// UserStore is the persistence surface the handlers need (interface for tests).
type UserStore interface {
	UpsertByGoogleSub(ctx context.Context, sub, email, name string) (*store.User, error)
	GetByEmail(ctx context.Context, email string) (*store.User, error)
	GetInterests(ctx context.Context, userID string) ([]string, error)
	SetInterests(ctx context.Context, userID string, uris []string) error
	ListStaff(ctx context.Context) ([]*store.User, error)
	SetRoleByEmail(ctx context.Context, email, role string) (*store.User, error)
}

type Handlers struct {
	Store         UserStore
	Issuer        *authx.Issuer
	Google        *auth.GoogleFlow
	FrontendURL   string
	AllowDevLogin bool
	SemanticURL   string // optional; interests are pushed here for the RDF layer
	Logger        *slog.Logger
}

func RegisterRoutes(r *gin.Engine, h *Handlers) {
	r.GET("/api/auth/google/login", h.googleLogin)
	r.GET("/api/auth/google/callback", h.googleCallback)
	r.POST("/api/auth/dev-login", h.devLogin)

	authed := r.Group("/", authx.RequireAuth(h.Issuer))
	authed.GET("/api/auth/me", h.me)
	authed.GET("/api/profile/interests", h.getInterests)
	authed.POST("/api/profile/interests", h.setInterests)

	// Team management: admins grant/revoke the organiser role in-app.
	admin := r.Group("/", authx.RequireAuth(h.Issuer), authx.RequireRole("admin"))
	admin.GET("/api/admin/organisers", h.listOrganisers)
	admin.POST("/api/admin/organisers", h.grantOrganiser)
	admin.DELETE("/api/admin/organisers/:email", h.revokeOrganiser)
}

func (h *Handlers) googleLogin(c *gin.Context) {
	if h.Google == nil {
		httpx.Abort(c, http.StatusServiceUnavailable, "Google sign-in is not configured on this environment — use developer access locally")
		return
	}
	url, _ := h.Google.LoginURL()
	c.Redirect(http.StatusFound, url)
}

func (h *Handlers) googleCallback(c *gin.Context) {
	if h.Google == nil {
		httpx.Abort(c, http.StatusServiceUnavailable, "Google sign-in is not configured on this environment")
		return
	}
	identity, err := h.Google.Exchange(c.Request.Context(), c.Query("state"), c.Query("code"))
	if err != nil {
		if errors.Is(err, auth.ErrHDRestriction) {
			h.redirectWithError(c, "only-ufp")
			return
		}
		h.Logger.Warn("oidc callback failed", "error", err)
		h.redirectWithError(c, "oidc-failed")
		return
	}
	user, err := h.Store.UpsertByGoogleSub(c.Request.Context(), identity.Subject, identity.Email, identity.Name)
	if err != nil {
		h.Logger.Error("user upsert failed", "error", err)
		httpx.Internal(c)
		return
	}
	h.issueAndRedirect(c, user)
}

func (h *Handlers) redirectWithError(c *gin.Context, code string) {
	c.Redirect(http.StatusFound, strings.TrimRight(h.FrontendURL, "/")+"/login?error="+code)
}

func (h *Handlers) issueAndRedirect(c *gin.Context, user *store.User) {
	token, err := h.Issuer.Issue(user.ID, user.Name, user.Email, user.StudentNumber, user.Role)
	if err != nil {
		httpx.Internal(c)
		return
	}
	c.Redirect(http.StatusFound, strings.TrimRight(h.FrontendURL, "/")+"/auth/callback?token="+token)
}

// devLogin exists for local development and automated tests. It is only
// registered when ALLOW_DEV_LOGIN=true; production never sets it.
func (h *Handlers) devLogin(c *gin.Context) {
	if !h.AllowDevLogin {
		httpx.NotFound(c, "Route")
		return
	}
	var body auth.DevLoginBody
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.BadRequest(c, "a valid email is required")
		return
	}
	if !strings.HasSuffix(body.Email, "@ufp.edu.pt") {
		httpx.Abort(c, http.StatusForbidden, "only @ufp.edu.pt accounts can sign in")
		return
	}
	user, err := h.Store.GetByEmail(c.Request.Context(), body.Email)
	if err != nil {
		httpx.Abort(c, http.StatusUnauthorized, "unknown account — ask an admin to provision it")
		return
	}
	// JSON for API clients (fetch cannot read Location off an opaque redirect);
	// the Google flow uses redirects because it drives browser navigation.
	token, err := h.Issuer.Issue(user.ID, user.Name, user.Email, user.StudentNumber, user.Role)
	if err != nil {
		httpx.Internal(c)
		return
	}
	c.JSON(200, gin.H{"token": token})
}

func (h *Handlers) me(c *gin.Context) {
	claims := authx.GetClaims(c)
	c.JSON(200, gin.H{
		"id": claims.UserID, "name": claims.Name, "email": claims.Email,
		"studentNumber": claims.StudentNumber, "role": claims.Role,
	})
}

func (h *Handlers) getInterests(c *gin.Context) {
	uris, err := h.Store.GetInterests(c.Request.Context(), authx.GetClaims(c).UserID)
	if err != nil {
		httpx.Internal(c)
		return
	}
	// The labels/URIs come from the ontology; user-service stores URIs only.
	// Labels are humanized from the URI fragment ("SemanticWeb" → "Semantic Web").
	out := make([]gin.H, 0, len(uris))
	for _, uri := range uris {
		label := uri
		if i := strings.LastIndex(uri, "#"); i >= 0 {
			label = uri[i+1:]
		}
		out = append(out, gin.H{"value": slugify(label), "label": humanize(label), "uri": uri})
	}
	c.JSON(200, out)
}

type setInterestsBody struct {
	Interests []string `json:"interests"`
}

func (h *Handlers) setInterests(c *gin.Context) {
	var body setInterestsBody
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.BadRequest(c, "interests must be an array")
		return
	}
	userID := authx.GetClaims(c).UserID
	// The frontend sends concept values; store canonical URIs.
	uris := make([]string, 0, len(body.Interests))
	for _, v := range body.Interests {
		uris = append(uris, "https://campus-pulse.ufp.pt/ontology#"+pascal(v))
	}
	if err := h.Store.SetInterests(c.Request.Context(), userID, uris); err != nil {
		httpx.Internal(c)
		return
	}
	go h.pushInterests(userID, uris)
	c.JSON(200, gin.H{"saved": len(uris)})
}

// ---------- team management (admin) ----------

type staffDTO struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

func toStaffDTO(u *store.User) staffDTO {
	return staffDTO{Email: u.Email, Name: u.Name, Role: u.Role}
}

func (h *Handlers) listOrganisers(c *gin.Context) {
	staff, err := h.Store.ListStaff(c.Request.Context())
	if err != nil {
		httpx.Internal(c)
		return
	}
	out := make([]staffDTO, 0, len(staff))
	for _, u := range staff {
		out = append(out, toStaffDTO(u))
	}
	c.JSON(200, out)
}

type grantBody struct {
	Email string `json:"email"`
}

// grantOrganiser makes a @ufp.edu.pt account an organiser. The role lands in
// the DB immediately and reaches the person in the JWT at their next sign-in.
func (h *Handlers) grantOrganiser(c *gin.Context) {
	var body grantBody
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.BadRequest(c, "a valid email is required")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if !strings.HasSuffix(email, "@ufp.edu.pt") {
		httpx.BadRequest(c, "only @ufp.edu.pt accounts can be organisers")
		return
	}
	user, err := h.Store.SetRoleByEmail(c.Request.Context(), email, "organiser")
	if err != nil {
		httpx.Internal(c)
		return
	}
	h.Logger.Info("organiser granted", "by", authx.GetClaims(c).Email, "to", email)
	c.JSON(200, gin.H{"user": toStaffDTO(user), "message": "Organiser access granted — applies at their next sign-in"})
}

func (h *Handlers) revokeOrganiser(c *gin.Context) {
	email := strings.ToLower(c.Param("email"))
	caller := authx.GetClaims(c)
	if email == caller.Email {
		httpx.BadRequest(c, "you cannot revoke your own access")
		return
	}
	target, err := h.Store.GetByEmail(c.Request.Context(), email)
	if err != nil {
		httpx.NotFound(c, "Account")
		return
	}
	if target.Role == "admin" {
		httpx.BadRequest(c, "admins are managed via ADMIN_EMAILS, not the Team screen")
		return
	}
	if target.Role != "organiser" {
		httpx.NotFound(c, "Organiser")
		return
	}
	if _, err := h.Store.SetRoleByEmail(c.Request.Context(), email, "user"); err != nil {
		httpx.Internal(c)
		return
	}
	h.Logger.Info("organiser revoked", "by", caller.Email, "to", email)
	c.Status(http.StatusNoContent)
}

// pushInterests feeds the semantic layer (push-on-write; failure only logs).
func (h *Handlers) pushInterests(userID string, uris []string) {
	if h.SemanticURL == "" {
		return
	}
	payload := strings.NewReader(`{"userId":"` + userID + `","interestUris":[` + quoteJoin(uris) + `]}`)
	resp, err := http.Post(strings.TrimRight(h.SemanticURL, "/")+"/internal/ingest/interests", "application/json", payload)
	if err != nil {
		h.Logger.Warn("semantic ingestion failed", "error", err)
		return
	}
	_ = resp.Body.Close()
}

func quoteJoin(xs []string) string {
	out := make([]string, len(xs))
	for i, x := range xs {
		out[i] = `"` + x + `"`
	}
	return strings.Join(out, ",")
}

func slugify(label string) string {
	// "Semantic Web" / "SemanticWeb" → "semantic-web"
	var b strings.Builder
	for i, r := range label {
		if r >= 'A' && r <= 'Z' && i > 0 {
			b.WriteByte('-')
		}
		if r == ' ' {
			b.WriteByte('-')
			continue
		}
		b.WriteRune(r)
	}
	return strings.ToLower(b.String())
}

func humanize(fragment string) string {
	var b strings.Builder
	for i, r := range fragment {
		if r >= 'A' && r <= 'Z' && i > 0 {
			b.WriteByte(' ')
		}
		b.WriteRune(r)
	}
	return b.String()
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
