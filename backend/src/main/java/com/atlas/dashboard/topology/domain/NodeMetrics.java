package com.atlas.dashboard.topology.domain;

import java.util.List;

/** Grafana-sourced time series for a node, shown as sparklines in the node modal. */
public record NodeMetrics(
        String nodeId,
        List<MetricPoint> requestRate,
        List<MetricPoint> errorRate,
        List<MetricPoint> p95Latency) {

    public record MetricPoint(String ts, double value) {
    }
}
