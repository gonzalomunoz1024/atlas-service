package com.atlas.dashboard.actions.application;

import org.springframework.stereotype.Service;

import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.SyntheticTest;
import com.atlas.dashboard.actions.ports.inbound.ActionsInboundPort;
import com.atlas.dashboard.actions.ports.outbound.HyperExecutePort;
import com.atlas.dashboard.actions.ports.outbound.RepoEnhancementPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class ActionsUseCase implements ActionsInboundPort {

    private final HyperExecutePort hyperExecute;
    private final RepoEnhancementPort repoEnhancement;

    @Override
    public Mono<SyntheticTest> syntheticFromTrace(String traceId, String node, String endpoint) {
        return hyperExecute.fromTrace(traceId, node, endpoint);
    }

    @Override
    public Mono<EnhancementPlan> enhancement(String component) {
        return repoEnhancement.plan(component);
    }
}
