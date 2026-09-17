package com.atlas.dashboard.insights.ports.inbound;

import com.atlas.dashboard.insights.domain.HealthMap;

import reactor.core.publisher.Mono;

public interface InsightsInboundPort {
    Mono<HealthMap> healthMap(String component, String rev);
}
