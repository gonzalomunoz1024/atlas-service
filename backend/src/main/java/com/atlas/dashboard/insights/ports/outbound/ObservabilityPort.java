package com.atlas.dashboard.insights.ports.outbound;

import java.util.Map;

import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.insights.domain.EndpointStat;

import reactor.core.publisher.Mono;

/**
 * Observed traffic + log presence per edge, as would be derived by querying SPLOC (traces)
 * and Splunk (logs) and joining by edge.
 */
public interface ObservabilityPort {
    Mono<Map<String, EdgeObservation>> edgeObservations(String component, String rev);

    /** Observed error rate (0..1) per edge over the trailing window — what SPLOC/Grafana computes. */
    Mono<Map<String, Double>> windowedErrorRates(String component, String rev, int windowMin);

    /** Windowed per-endpoint traffic stats for a node — what a SPLOC endpoint query returns. */
    Mono<java.util.List<EndpointStat>> endpointStats(String nodeId, int windowMin);
}
