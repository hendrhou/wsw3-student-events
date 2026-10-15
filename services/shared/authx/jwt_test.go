package authx

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

const testSecret = "test-secret-key-1234567890"

func TestIssueAndVerifyRoundTrip(t *testing.T) {
	issuer, err := NewIssuer(testSecret, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	token, err := issuer.Issue("u1", "Vítor", "v@ufp.edu.pt", "20220123", "user")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := issuer.Verify(token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.UserID != "u1" || claims.Role != "user" || claims.StudentNumber != "20220123" {
		t.Errorf("claims mismatch: %+v", claims)
	}
}

func TestRejectsWeakSecrets(t *testing.T) {
	if _, err := NewIssuer("short", time.Hour); err == nil {
		t.Error("expected error for a weak secret")
	}
}

func TestRejectsExpiredTokens(t *testing.T) {
	issuer, _ := NewIssuer(testSecret, time.Hour)
	past := time.Now().Add(-2 * time.Hour)
	issuer.SetClock(func() time.Time { return past })
	token, _ := issuer.Issue("u1", "n", "e", "s", "user")
	issuer.SetClock(time.Now)
	if _, err := issuer.Verify(token); err == nil {
		t.Error("expired token must fail verification")
	}
}

func TestRejectsWrongSecret(t *testing.T) {
	a, _ := NewIssuer(testSecret, time.Hour)
	b, _ := NewIssuer("another-secret-key-9999", time.Hour)
	token, _ := a.Issue("u1", "n", "e", "s", "user")
	if _, err := b.Verify(token); err == nil {
		t.Error("token signed with another secret must fail")
	}
}

func TestMiddlewareChain(t *testing.T) {
	issuer, _ := NewIssuer(testSecret, time.Hour)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(httpx.RequestLogger(slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil))))
	r.GET("/me", RequireAuth(issuer), RequireRole("organiser"), func(c *gin.Context) {
		c.JSON(200, gin.H{"sub": GetClaims(c).UserID})
	})

	// No token → 401
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/me", nil))
	if w.Code != 401 {
		t.Errorf("no token: expected 401, got %d", w.Code)
	}

	// Wrong role → 403
	userToken, _ := issuer.Issue("u1", "n", "e", "s", "user")
	w = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer "+userToken)
	r.ServeHTTP(w, req)
	if w.Code != 403 {
		t.Errorf("user role: expected 403, got %d", w.Code)
	}

	// Organiser → 200 with claims
	orgToken, _ := issuer.Issue("u2", "Olga", "o@ufp.edu.pt", "staff1", "organiser")
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer "+orgToken)
	r.ServeHTTP(w, req)
	if w.Code != 200 || w.Body.String() != `{"sub":"u2"}` {
		t.Errorf("organiser: got %d %q", w.Code, w.Body.String())
	}
}
