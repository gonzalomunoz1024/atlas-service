package com.atlas.dashboard.actions.application;

import org.springframework.stereotype.Service;

import com.atlas.dashboard.actions.domain.AlertPlan;
import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.GeneratedTest;
import com.atlas.dashboard.actions.domain.TestType;
import com.atlas.dashboard.actions.ports.inbound.ActionsInboundPort;
import com.atlas.dashboard.actions.ports.outbound.AlertingPort;
import com.atlas.dashboard.actions.ports.outbound.HyperExecutePort;
import com.atlas.dashboard.actions.ports.outbound.RepoEnhancementPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class ActionsUseCase implements ActionsInboundPort {

    private final HyperExecutePort hyperExecute;
    private final RepoEnhancementPort repoEnhancement;
    private final AlertingPort alerting;

    @Override
    public Mono<GeneratedTest> testFromTrace(String traceId, String node, String endpoint, TestType type) {
        return hyperExecute.fromTrace(traceId, node, endpoint, type);
    }

    @Override
    public Mono<EnhancementPlan> enhancement(String component) {
        return repoEnhancement.plan(component);
    }

    @Override
    public Mono<EnhancementPlan> errorRateEnhancement(String component, String target) {
        return repoEnhancement.errorRatePlan(component, target);
    }

    @Override
    public Mono<AlertPlan> alertsFromTrace(String component, String traceId) {
        return alerting.planFromTrace(component, traceId);
    }
}
