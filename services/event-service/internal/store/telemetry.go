package store

import "github.com/hendrhou/wsw3-student-events/services/shared/telemetry"

func (store *Store) Stats() telemetry.PoolStats {
	stats := store.pool.Stat()
	return telemetry.PoolStats{Acquired: stats.AcquiredConns(), Idle: stats.IdleConns(), Total: stats.TotalConns(), Max: stats.MaxConns()}
}
