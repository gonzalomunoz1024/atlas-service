package com.atlas.dashboard.actions.ports.outbound;

import com.atlas.dashboard.actions.domain.EnhancementPlan;

import reactor.core.publisher.Mono;

/** Suggests logging/alerting enhancements for an owned repository. */
public interface RepoEnhancementPort {
    Mono<EnhancementPlan> plan(String component);

    /** Remediation plan for a source→target call whose live error rate crossed the threshold. */
    Mono<EnhancementPlan> errorRatePlan(String component, String target);
}
