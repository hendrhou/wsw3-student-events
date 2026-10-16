package authx

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

// ContextKey is where RequireAuth stores the verified claims.
const ContextKey = "authx.claims"

// RequireAuth rejects requests without a valid bearer token (401).
func RequireAuth(issuer *Issuer) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			httpx.Abort(c, 401, "authentication required")
			return
		}
		claims, err := issuer.Verify(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			httpx.Abort(c, 401, "invalid or expired token")
			return
		}
		c.Set(ContextKey, claims)
		c.Next()
	}
}

// RequireRole rejects authenticated users below the required role (403).
// Roles are cumulative: admin ⊃ organiser ⊃ user — an organiser is also a
// student, an admin is both. RequireRole("user") just means "signed in".
func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := GetClaims(c)
		if claims == nil {
			httpx.Abort(c, 401, "authentication required")
			return
		}
		if roleRank(claims.Role) < roleRank(role) {
			httpx.Abort(c, 403, "this area requires the "+role+" role")
			return
		}
		c.Next()
	}
}

func roleRank(role string) int {
	switch role {
	case "user":
		return 1
	case "organiser":
		return 2
	case "admin":
		return 3
	default:
		return 0
	}
}

// GetClaims returns the verified claims, or nil when unauthenticated.
func GetClaims(c *gin.Context) *Claims {
	v, ok := c.Get(ContextKey)
	if !ok {
		return nil
	}
	claims, _ := v.(*Claims)
	return claims
}
