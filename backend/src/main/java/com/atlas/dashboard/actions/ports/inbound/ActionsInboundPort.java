package com.atlas.dashboard.actions.ports.inbound;

import java.util.List;

import com.atlas.dashboard.actions.domain.AlertPlan;
import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.GeneratedTest;
import com.atlas.dashboard.actions.domain.SafeguardOption;
import com.atlas.dashboard.actions.domain.SilentEdgeFinding;
import com.atlas.dashboard.actions.domain.TestType;

import reactor.core.publisher.Mono;

public interface ActionsInboundPort {
    Mono<GeneratedTest> testFromTrace(String traceId, String node, String endpoint, TestType type);

    Mono<EnhancementPlan> enhancement(String component);

    Mono<EnhancementPlan> errorRateEnhancement(String component, String target);

    /** Alert rules for Splunk/SPLOC derived from a trace's call path. */
    Mono<AlertPlan> alertsFromTrace(String component, String traceId);

    /** The case file for a mapped-but-silent link. */
    Mono<SilentEdgeFinding> silentEdgeFinding(String component, String sourceId, String targetId);

    /** Which safeguard kinds the platform can generate today (and which are coming). */
    Mono<List<SafeguardOption>> safeguardCatalog();
}
