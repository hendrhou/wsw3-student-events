package telemetry

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

func Start(service string) (*Runtime, error) {
	config, err := FromEnv(service)
	if err != nil {
		return nil, err
	}
	runtime, err := New(config, os.Stdout)
	if err != nil {
		return nil, err
	}
	http.DefaultTransport = runtime.Transport(http.DefaultTransport)
	return runtime, nil
}

func (runtime *Runtime) Serve(router *gin.Engine, address string) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	metricsMux := http.NewServeMux()
	metricsMux.Handle("GET /metrics", runtime.Metrics)
	application := &http.Server{Addr: address, Handler: router, ReadHeaderTimeout: 5 * time.Second}
	metrics := &http.Server{Addr: ":9090", Handler: metricsMux, ReadHeaderTimeout: 5 * time.Second}
	failures := make(chan error, 2)
	for _, server := range []*http.Server{application, metrics} {
		go func() { failures <- server.ListenAndServe() }()
	}
	var result error
	select {
	case <-ctx.Done():
	case err := <-failures:
		if !errors.Is(err, http.ErrServerClosed) {
			result = fmt.Errorf("HTTP listener failed: %w", err)
		}
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return errors.Join(result, application.Shutdown(shutdown), metrics.Shutdown(shutdown))
}
