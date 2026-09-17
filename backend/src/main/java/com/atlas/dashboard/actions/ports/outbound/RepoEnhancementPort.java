package com.atlas.dashboard.actions.ports.outbound;

import com.atlas.dashboard.actions.domain.EnhancementPlan;

import reactor.core.publisher.Mono;

/** Suggests logging/alerting enhancements for an owned repository. */
public interface RepoEnhancementPort {
    Mono<EnhancementPlan> plan(String component);
}
