package com.atlas.dashboard.insights.ports.inbound;

import java.util.List;

import com.atlas.dashboard.insights.domain.EdgeHealthStatus;
import com.atlas.dashboard.insights.domain.HealthMap;

import reactor.core.publisher.Mono;

public interface InsightsInboundPort {
    /** maxDepth (nullable) limits the map to N hops from the center, coverage re-scored server-side. */
    Mono<HealthMap> healthMap(String component, String rev, Integer maxDepth);

    /** Per-edge error rate over the trailing window, judged against the threshold server-side. */
    Mono<List<EdgeHealthStatus>> edgeHealth(String component, String rev, int windowMin, double thresholdPct);
}
