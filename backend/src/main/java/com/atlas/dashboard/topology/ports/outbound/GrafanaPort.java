package com.atlas.dashboard.topology.ports.outbound;

import com.atlas.dashboard.topology.domain.NodeMetrics;

import reactor.core.publisher.Mono;

/** Grafana: time-series metrics for a node. */
public interface GrafanaPort {
    Mono<NodeMetrics> metrics(String nodeId);
}
