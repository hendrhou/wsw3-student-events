package http

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gabriel-vasile/mimetype"
	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/event-service/internal/blobstore"
	"github.com/hendrhou/wsw3-student-events/services/event-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
	"github.com/hendrhou/wsw3-student-events/services/shared/httpx"
)

const maxCoverImageBytes = 5 << 20

func inspectCoverImage(data []byte) (string, string, error) {
	if len(data) == 0 || len(data) > maxCoverImageBytes {
		return "", "", errors.New("cover image must be between 1 byte and 5 MiB")
	}

	mediaType := mimetype.Detect(data)
	contentType := mediaType.String()
	if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/webp" {
		return "", "", errors.New("cover image must be JPEG, PNG, or WebP")
	}
	return contentType, mediaType.Extension(), nil
}

func (h *Handlers) uploadCover(c *gin.Context) {
	if h.Blobs == nil || h.CoverMetadata == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Cover storage is unavailable"})
		return
	}
	event, ok := h.ownedEvent(c)
	if !ok {
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxCoverImageBytes+(64<<10))
	altText := strings.TrimSpace(c.PostForm("altText"))
	if altText == "" || utf8.RuneCountInString(altText) > 200 {
		httpxBadCover(c, "Alt text is required and must be 200 characters or fewer")
		return
	}
	fileHeader, fileErr := c.FormFile("file")
	if errors.Is(fileErr, http.ErrMissingFile) && event.CoverObjectKey != "" {
		claims := authx.GetClaims(c)
		_, err := h.CoverMetadata.SetCover(c.Request.Context(), event.ID, claims.UserID, event.CoverObjectKey, altText)
		if err != nil {
			h.Logger.Error("cover alt text update failed", "error", err, "event", event.ID)
			httpx.Internal(c)
			return
		}
		c.JSON(http.StatusOK, gin.H{"coverUrl": "/api/events/" + event.ID + "/cover", "coverAltText": altText})
		return
	}
	if fileErr != nil || fileHeader.Size > maxCoverImageBytes {
		httpxBadCover(c, "Select an image smaller than 5 MiB")
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		httpxBadCover(c, "Could not read the selected image")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxCoverImageBytes+1))
	if err != nil {
		httpxBadCover(c, "Could not read the selected image")
		return
	}
	contentType, extension, err := inspectCoverImage(data)
	if err != nil {
		httpxBadCover(c, err.Error())
		return
	}

	key, err := coverObjectKey(extension)
	if err != nil {
		h.Logger.Error("cover key generation failed", "error", err, "event", event.ID)
		httpx.Internal(c)
		return
	}
	if err := h.Blobs.Put(c.Request.Context(), key, contentType, data); err != nil {
		h.Logger.Error("cover upload failed", "error", err, "event", event.ID)
		httpx.Internal(c)
		return
	}

	claims := authx.GetClaims(c)
	oldKey, err := h.CoverMetadata.SetCover(c.Request.Context(), event.ID, claims.UserID, key, altText)
	if err != nil {
		if cleanupErr := h.Blobs.Remove(context.WithoutCancel(c.Request.Context()), key); cleanupErr != nil {
			h.Logger.Warn("orphan cover cleanup failed", "error", cleanupErr, "event", event.ID)
		}
		if errors.Is(err, store.ErrNotFound) {
			httpx.NotFound(c, "Event")
			return
		}
		h.Logger.Error("cover metadata update failed", "error", err, "event", event.ID)
		httpx.Internal(c)
		return
	}
	if oldKey != "" && oldKey != key {
		if err := h.Blobs.Remove(c.Request.Context(), oldKey); err != nil {
			h.Logger.Warn("replaced cover cleanup failed", "error", err, "event", event.ID)
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"coverUrl":     "/api/events/" + event.ID + "/cover",
		"coverAltText": altText,
	})
}

func (h *Handlers) deleteCover(c *gin.Context) {
	if h.Blobs == nil || h.CoverMetadata == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Cover storage is unavailable"})
		return
	}
	event, ok := h.ownedEvent(c)
	if !ok {
		return
	}
	claims := authx.GetClaims(c)
	oldKey, err := h.CoverMetadata.ClearCover(c.Request.Context(), event.ID, claims.UserID)
	if errors.Is(err, store.ErrNotFound) {
		httpx.NotFound(c, "Event")
		return
	}
	if err != nil {
		h.Logger.Error("cover metadata removal failed", "error", err, "event", event.ID)
		httpx.Internal(c)
		return
	}
	if oldKey != "" {
		if err := h.Blobs.Remove(c.Request.Context(), oldKey); err != nil {
			h.Logger.Warn("cover removal failed", "error", err, "event", event.ID)
		}
	}
	c.Status(http.StatusNoContent)
}

func (h *Handlers) getCover(c *gin.Context) {
	if h.Blobs == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Cover storage is unavailable"})
		return
	}
	event, err := h.Store.Get(c.Request.Context(), c.Param("id"))
	if errors.Is(err, store.ErrNotFound) || (err == nil && event.CoverObjectKey == "") {
		httpx.NotFound(c, "Event cover")
		return
	}
	if err != nil {
		h.Logger.Error("cover metadata lookup failed", "error", err, "event", c.Param("id"))
		httpx.Internal(c)
		return
	}
	image, contentType, err := h.Blobs.Get(c.Request.Context(), event.CoverObjectKey)
	if errors.Is(err, blobstore.ErrNotFound) {
		httpx.NotFound(c, "Event cover")
		return
	}
	if err != nil {
		h.Logger.Error("cover read failed", "error", err, "event", event.ID)
		httpx.Internal(c)
		return
	}
	defer image.Close()
	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", "inline")
	c.Header("Cache-Control", "no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	if _, err := io.Copy(c.Writer, image); err != nil {
		h.Logger.Warn("cover response stream failed", "error", err, "event", event.ID)
	}
}

func (h *Handlers) ownedEvent(c *gin.Context) (*store.Event, bool) {
	event, err := h.Store.Get(c.Request.Context(), c.Param("id"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.NotFound(c, "Event")
		return nil, false
	}
	if err != nil {
		h.Logger.Error("cover event lookup failed", "error", err, "event", c.Param("id"))
		httpx.Internal(c)
		return nil, false
	}
	claims := authx.GetClaims(c)
	if event.OrganiserID != claims.UserID {
		httpx.NotFound(c, "Event")
		return nil, false
	}
	return event, true
}

func coverObjectKey(extension string) (string, error) {
	var randomID [16]byte
	if _, err := rand.Read(randomID[:]); err != nil {
		return "", err
	}
	return "event-covers/" + hex.EncodeToString(randomID[:]) + extension, nil
}

func httpxBadCover(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, gin.H{"message": message})
}
