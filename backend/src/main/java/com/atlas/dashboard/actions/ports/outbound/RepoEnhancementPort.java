package com.atlas.dashboard.actions.ports.outbound;

import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.SilentEdgeFinding;

import reactor.core.publisher.Mono;

/** Suggests logging/alerting enhancements for an owned repository. */
public interface RepoEnhancementPort {
    /**
     * Enhancement plan for the component's logging gaps. {@code gapTargetIds} — the edges'
     * target node ids — are derived by the use case (the missing-logs rule is Atlas's, not
     * the adapter's); the adapter only synthesises the plan content.
     */
    Mono<EnhancementPlan> plan(String component, java.util.List<String> gapTargetIds);

    /** Remediation plan for a source→target call whose live error rate crossed the threshold. */
    Mono<EnhancementPlan> errorRatePlan(String component, String target);

    /** The case file for a mapped-but-silent link: what it means and what to do next. */
    Mono<SilentEdgeFinding> silentEdgeFinding(String component, String sourceId, String targetId);
}
