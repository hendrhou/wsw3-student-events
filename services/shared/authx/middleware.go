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

// RequireRole rejects authenticated users without the role (403).
func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := GetClaims(c)
		if claims == nil {
			httpx.Abort(c, 401, "authentication required")
			return
		}
		if claims.Role != role {
			httpx.Abort(c, 403, "this area requires the "+role+" role")
			return
		}
		c.Next()
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
