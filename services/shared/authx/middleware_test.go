package authx

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func requestWithRole(t *testing.T, path, role string) int {
	t.Helper()
	issuer, err := NewIssuer("test-secret-key-1234", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/org", RequireAuth(issuer), RequireRole("organiser"), func(c *gin.Context) { c.Status(204) })
	r.GET("/adm", RequireAuth(issuer), RequireRole("admin"), func(c *gin.Context) { c.Status(204) })
	token, err := issuer.Issue("usr_x", "X", "x@ufp.edu.pt", "", role)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec.Code
}

func TestRequireRoleExactMatch(t *testing.T) {
	if got := requestWithRole(t, "/org", "organiser"); got != 204 {
		t.Fatalf("organiser on organiser route: got %d, want 204", got)
	}
}

func TestRequireRoleAdminIsOrganiserSuperset(t *testing.T) {
	if got := requestWithRole(t, "/org", "admin"); got != 204 {
		t.Fatalf("admin should pass organiser routes: got %d, want 204", got)
	}
}

func TestRequireRoleAdminIsStrict(t *testing.T) {
	if got := requestWithRole(t, "/adm", "organiser"); got != 403 {
		t.Fatalf("organiser on admin route: got %d, want 403", got)
	}
	if got := requestWithRole(t, "/adm", "admin"); got != 204 {
		t.Fatalf("admin on admin route: got %d, want 204", got)
	}
}

func TestRequireRoleUserRejected(t *testing.T) {
	if got := requestWithRole(t, "/org", "user"); got != 403 {
		t.Fatalf("user on organiser route: got %d, want 403", got)
	}
}
