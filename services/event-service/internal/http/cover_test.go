package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hendrhou/wsw3-student-events/services/event-service/internal/store"
	"github.com/hendrhou/wsw3-student-events/services/shared/authx"
)

func TestInspectCoverImageAcceptsSupportedFormats(t *testing.T) {
	tests := []struct {
		name        string
		data        []byte
		contentType string
		extension   string
	}{
		{"png", append([]byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}, bytes.Repeat([]byte{0}, 16)...), "image/png", ".png"},
		{"jpeg", append([]byte{0xff, 0xd8, 0xff, 0xe0}, bytes.Repeat([]byte{0}, 16)...), "image/jpeg", ".jpg"},
		{"webp", append([]byte("RIFF"), append([]byte{0, 0, 0, 0}, append([]byte("WEBP"), bytes.Repeat([]byte{0}, 8)...)...)...), "image/webp", ".webp"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			contentType, extension, err := inspectCoverImage(test.data)
			if err != nil {
				t.Fatalf("inspectCoverImage() error = %v", err)
			}
			if contentType != test.contentType || extension != test.extension {
				t.Fatalf("inspectCoverImage() = (%q, %q), want (%q, %q)", contentType, extension, test.contentType, test.extension)
			}
		})
	}
}

func TestInspectCoverImageRejectsUnsupportedContent(t *testing.T) {
	_, _, err := inspectCoverImage([]byte("<script>alert(1)</script>"))
	if err == nil {
		t.Fatal("inspectCoverImage() accepted non-image content")
	}
}

func TestInspectCoverImageRejectsOversizedContent(t *testing.T) {
	_, _, err := inspectCoverImage(bytes.Repeat([]byte{0}, maxCoverImageBytes+1))
	if err == nil {
		t.Fatal("inspectCoverImage() accepted an oversized image")
	}
}

type coverTestStore struct {
	*fakeStore
}

func (s *coverTestStore) SetCover(_ context.Context, id, organiserID, key, altText string) (string, error) {
	for i := range s.events {
		if s.events[i].ID == id && s.events[i].OrganiserID == organiserID {
			oldKey := s.events[i].CoverObjectKey
			s.events[i].CoverObjectKey = key
			s.events[i].CoverAltText = &altText
			return oldKey, nil
		}
	}
	return "", store.ErrNotFound
}

func (s *coverTestStore) ClearCover(_ context.Context, id, organiserID string) (string, error) {
	for i := range s.events {
		if s.events[i].ID == id && s.events[i].OrganiserID == organiserID {
			oldKey := s.events[i].CoverObjectKey
			s.events[i].CoverObjectKey = ""
			s.events[i].CoverAltText = nil
			return oldKey, nil
		}
	}
	return "", store.ErrNotFound
}

type fakeBlobStore struct {
	objects map[string][]byte
	types   map[string]string
	putErr  error
}

func (s *fakeBlobStore) Put(_ context.Context, key, contentType string, data []byte) error {
	if s.putErr != nil {
		return s.putErr
	}
	if s.objects == nil {
		s.objects = make(map[string][]byte)
		s.types = make(map[string]string)
	}
	s.objects[key] = append([]byte(nil), data...)
	s.types[key] = contentType
	return nil
}

func (s *fakeBlobStore) Get(_ context.Context, key string) (io.ReadCloser, string, error) {
	data, ok := s.objects[key]
	if !ok {
		return nil, "", errors.New("object not found")
	}
	return io.NopCloser(bytes.NewReader(data)), s.types[key], nil
}

func (s *fakeBlobStore) Remove(_ context.Context, key string) error {
	delete(s.objects, key)
	delete(s.types, key)
	return nil
}

func setupCoverRoutes(t *testing.T, events ...store.Event) (*gin.Engine, *coverTestStore, *fakeBlobStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	issuer, err := authx.NewIssuer(testSecret, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	objects := &fakeBlobStore{}
	st := &coverTestStore{fakeStore: &fakeStore{events: events}}
	router := gin.New()
	RegisterRoutes(router, &Handlers{
		Store: st, CoverMetadata: st, Blobs: objects, Issuer: issuer,
		Logger: slog.New(slog.NewJSONHandler(io.Discard, nil)),
	})
	return router, st, objects
}

func coverUploadRequest(t *testing.T, image []byte, filename, altText string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("altText", altText); err != nil {
		t.Fatal(err)
	}
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(image); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/organiser/events/evt-sparql/cover", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Authorization", "Bearer "+organiserToken(t))
	return request
}

func TestUploadCoverStoresImageAndMetadata(t *testing.T) {
	router, st, objects := setupCoverRoutes(t, fixtureEvent())
	image := append([]byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}, bytes.Repeat([]byte{0}, 16)...)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, coverUploadRequest(t, image, "cover.png", "Students at a workshop"))

	if response.Code != http.StatusOK {
		t.Fatalf("upload returned %d: %s", response.Code, response.Body.String())
	}
	if len(objects.objects) != 1 || len(st.events) != 1 {
		t.Fatalf("expected one stored image and event, got %d images and %d events", len(objects.objects), len(st.events))
	}
	if st.events[0].CoverObjectKey == "" || st.events[0].CoverAltText == nil || *st.events[0].CoverAltText != "Students at a workshop" {
		t.Fatalf("cover metadata was not saved: %+v", st.events[0])
	}
	if !strings.Contains(response.Body.String(), `"coverUrl":"/api/events/evt-sparql/cover"`) {
		t.Fatalf("upload response missing public cover URL: %s", response.Body.String())
	}
}

func TestUploadCoverRejectsInvalidImageWithoutWritingObject(t *testing.T) {
	router, _, objects := setupCoverRoutes(t, fixtureEvent())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, coverUploadRequest(t, []byte("not an image"), "cover.png", "Description"))

	if response.Code != http.StatusBadRequest || len(objects.objects) != 0 {
		t.Fatalf("invalid image returned %d and stored %d objects", response.Code, len(objects.objects))
	}
}

func TestGetCoverStreamsStoredImage(t *testing.T) {
	event := fixtureEvent()
	event.CoverObjectKey = "event-covers/evt-sparql/cover.png"
	event.CoverAltText = stringPointer("Students at a workshop")
	router, _, objects := setupCoverRoutes(t, event)
	image := []byte("png bytes")
	if err := objects.Put(context.Background(), event.CoverObjectKey, "image/png", image); err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/events/evt-sparql/cover", nil))

	if response.Code != http.StatusOK || response.Header().Get("Content-Type") != "image/png" || !bytes.Equal(response.Body.Bytes(), image) {
		t.Fatalf("unexpected image response: status=%d type=%q body=%q", response.Code, response.Header().Get("Content-Type"), response.Body.Bytes())
	}
}

func TestGetEventDetailReturnsCoverURLAndAltText(t *testing.T) {
	event := fixtureEvent()
	event.CoverObjectKey = "event-covers/cover.png"
	event.CoverAltText = stringPointer("Students in a workshop")
	router, _, _ := setupCoverRoutes(t, event)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/events/evt-sparql", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("event detail returned %d: %s", response.Code, response.Body.String())
	}
	var detail map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if detail["coverUrl"] != "/api/events/evt-sparql/cover" || detail["coverAltText"] != "Students in a workshop" {
		t.Fatalf("unexpected cover response fields: coverUrl=%v coverAltText=%v", detail["coverUrl"], detail["coverAltText"])
	}
}

func TestUploadCoverCanUpdateAltTextWithoutReplacingImage(t *testing.T) {
	event := fixtureEvent()
	event.CoverObjectKey = "event-covers/existing.png"
	event.CoverAltText = stringPointer("Old description")
	router, st, objects := setupCoverRoutes(t, event)
	if err := objects.Put(context.Background(), event.CoverObjectKey, "image/png", []byte("existing image")); err != nil {
		t.Fatal(err)
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("altText", "Updated description"); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/organiser/events/evt-sparql/cover", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Authorization", "Bearer "+organiserToken(t))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK || string(objects.objects[event.CoverObjectKey]) != "existing image" {
		t.Fatalf("alt update returned %d and changed image: %s", response.Code, response.Body.String())
	}
	if st.events[0].CoverAltText == nil || *st.events[0].CoverAltText != "Updated description" {
		t.Fatalf("alt text was not updated: %+v", st.events[0].CoverAltText)
	}
}

func stringPointer(value string) *string { return &value }
