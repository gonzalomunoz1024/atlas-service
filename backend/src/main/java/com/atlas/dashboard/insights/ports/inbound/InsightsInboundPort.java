package com.atlas.dashboard.insights.ports.inbound;

import com.atlas.dashboard.insights.domain.HealthMap;

import reactor.core.publisher.Mono;

public interface InsightsInboundPort {
    /** maxDepth (nullable) limits the map to N hops from the center, coverage re-scored server-side. */
    Mono<HealthMap> healthMap(String component, String rev, Integer maxDepth);
}
