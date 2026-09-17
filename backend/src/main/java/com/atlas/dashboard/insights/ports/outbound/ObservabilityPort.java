package com.atlas.dashboard.insights.ports.outbound;

import java.util.Map;

import com.atlas.dashboard.common.domain.EdgeObservation;

import reactor.core.publisher.Mono;

/**
 * Observed traffic + log presence per edge, as would be derived by querying SPLOC (traces)
 * and Splunk (logs) and joining by edge.
 */
public interface ObservabilityPort {
    Mono<Map<String, EdgeObservation>> edgeObservations(String component, String rev);
}
