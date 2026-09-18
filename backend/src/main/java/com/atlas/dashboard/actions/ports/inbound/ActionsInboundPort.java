package com.atlas.dashboard.actions.ports.inbound;

import com.atlas.dashboard.actions.domain.AlertPlan;
import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.GeneratedTest;
import com.atlas.dashboard.actions.domain.TestType;

import reactor.core.publisher.Mono;

public interface ActionsInboundPort {
    Mono<GeneratedTest> testFromTrace(String traceId, String node, String endpoint, TestType type);

    Mono<EnhancementPlan> enhancement(String component);

    Mono<EnhancementPlan> errorRateEnhancement(String component, String target);

    /** Alert rules for Splunk/SPLOC derived from a trace's call path. */
    Mono<AlertPlan> alertsFromTrace(String component, String traceId);
}
