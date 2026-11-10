package telemetry

import "github.com/prometheus/client_golang/prometheus"

type PoolStats struct {
	Acquired int32
	Idle     int32
	Total    int32
	Max      int32
}

type poolCollector struct {
	stats func() PoolStats
	desc  *prometheus.Desc
}

func (runtime *Runtime) ObservePool(stats func() PoolStats) error {
	return runtime.registry.Register(&poolCollector{stats: stats, desc: prometheus.NewDesc(
		"campus_db_connections", "Database pool connections by bounded state", []string{"state"}, nil)})
}

func (collector *poolCollector) Describe(output chan<- *prometheus.Desc) {
	output <- collector.desc
}

func (collector *poolCollector) Collect(output chan<- prometheus.Metric) {
	stats := collector.stats()
	for state, value := range map[string]int32{"acquired": stats.Acquired, "idle": stats.Idle, "total": stats.Total, "max": stats.Max} {
		output <- prometheus.MustNewConstMetric(collector.desc, prometheus.GaugeValue, float64(value), state)
	}
}
