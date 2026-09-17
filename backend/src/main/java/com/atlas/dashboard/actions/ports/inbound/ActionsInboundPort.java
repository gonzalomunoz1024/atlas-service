package com.atlas.dashboard.actions.ports.inbound;

import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.SyntheticTest;

import reactor.core.publisher.Mono;

public interface ActionsInboundPort {
    Mono<SyntheticTest> syntheticFromTrace(String traceId, String node, String endpoint);

    Mono<EnhancementPlan> enhancement(String component);
}
