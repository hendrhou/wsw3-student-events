// Package authx issues and verifies the HS256 session JWTs shared by all
// services. Tokens carry the user identity every service needs; each service
// verifies locally with the shared secret (no token introspection call).
package authx

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID        string `json:"sub"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	StudentNumber string `json:"student_number"`
	Role          string `json:"role"` // "user" | "organiser" | "admin"
	jwt.RegisteredClaims
}

type Issuer struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time // test hook
}

func NewIssuer(secret string, ttl time.Duration) (*Issuer, error) {
	if len(secret) < 16 {
		return nil, errors.New("JWT_SECRET must be at least 16 characters")
	}
	return &Issuer{secret: []byte(secret), ttl: ttl, now: time.Now}, nil
}

func (i *Issuer) Issue(userID, name, email, studentNumber, role string) (string, error) {
	now := i.now()
	claims := Claims{
		UserID: userID, Name: name, Email: email, StudentNumber: studentNumber, Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "campus-pulse",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(i.ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(i.secret)
}

func (i *Issuer) Verify(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return i.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// SetClock overrides time for tests.
func (i *Issuer) SetClock(now func() time.Time) { i.now = now }
