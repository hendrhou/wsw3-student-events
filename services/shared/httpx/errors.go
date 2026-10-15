// Package httpx provides the shared HTTP layer: the error envelope the
// frontend's ApiError parser expects, and the request logging middleware (R4).
package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrorBody is the single error shape across all services. The frontend reads
// .message — do not add detail fields containing internals.
type ErrorBody struct {
	Message string `json:"message"`
}

// Abort writes the error envelope and stops the handler chain.
func Abort(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, ErrorBody{Message: message})
}

func NotFound(c *gin.Context, what string) {
	Abort(c, http.StatusNotFound, what+" not found")
}

func Conflict(c *gin.Context, message string) {
	Abort(c, http.StatusConflict, message)
}

func BadRequest(c *gin.Context, message string) {
	Abort(c, http.StatusBadRequest, message)
}

func Internal(c *gin.Context) {
	// Deliberately generic — internals are logged by the middleware, never sent.
	Abort(c, http.StatusInternalServerError, "internal error")
}
