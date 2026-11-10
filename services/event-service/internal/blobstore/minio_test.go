package blobstore

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"strconv"
	"testing"
	"time"
)

func TestMinIORoundTrip(t *testing.T) {
	endpoint := os.Getenv("MINIO_TEST_ENDPOINT")
	if endpoint == "" {
		t.Skip("MINIO_TEST_ENDPOINT is not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	accessKey := os.Getenv("MINIO_TEST_ACCESS_KEY")
	secretKey := os.Getenv("MINIO_TEST_SECRET_KEY")
	if accessKey == "" || secretKey == "" {
		t.Fatal("MINIO_TEST_ACCESS_KEY and MINIO_TEST_SECRET_KEY are required")
	}
	bucket := "event-cover-test-" + strconv.Itoa(os.Getpid())
	objects, err := NewMinIO(ctx, endpoint, accessKey, secretKey, bucket, false)
	if err != nil {
		t.Fatalf("initialize MinIO: %v", err)
	}
	defer objects.client.RemoveBucket(ctx, bucket)

	key := "covers/round-trip.png"
	payload := []byte("minio storage round trip")
	if err := objects.Put(ctx, key, "image/png", payload); err != nil {
		t.Fatalf("put object: %v", err)
	}
	reader, contentType, err := objects.Get(ctx, key)
	if err != nil {
		t.Fatalf("get object: %v", err)
	}
	defer reader.Close()
	actual, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read object: %v", err)
	}
	if contentType != "image/png" || !bytes.Equal(actual, payload) {
		t.Fatalf("got content type %q and body %q", contentType, actual)
	}
	if err := objects.Remove(ctx, key); err != nil {
		t.Fatalf("remove object: %v", err)
	}
	if _, _, err := objects.Get(ctx, key); !errors.Is(err, ErrNotFound) {
		t.Fatalf("get after remove error = %v, want ErrNotFound", err)
	}
}
