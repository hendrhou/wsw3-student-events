package blobstore

import (
	"context"
	"errors"
	"io"
)

var ErrNotFound = errors.New("blob object not found")

type Store interface {
	Put(ctx context.Context, key, contentType string, data []byte) error
	Get(ctx context.Context, key string) (io.ReadCloser, string, error)
	Remove(ctx context.Context, key string) error
}
