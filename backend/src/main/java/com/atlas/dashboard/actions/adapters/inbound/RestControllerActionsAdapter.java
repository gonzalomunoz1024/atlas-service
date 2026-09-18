package com.atlas.dashboard.actions.adapters.inbound;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.atlas.dashboard.actions.application.ActionsUseCase;
import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.SyntheticTest;
import com.atlas.dashboard.actions.ports.inbound.ActionsInboundPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
@RequestMapping("/v1")
public class RestControllerActionsAdapter implements ActionsInboundPort {

    private final ActionsUseCase useCase;

    @Override
    @PostMapping("/synthetics/from-trace/{traceId}")
    public Mono<SyntheticTest> syntheticFromTrace(@PathVariable String traceId,
            @RequestParam(required = false) String node,
            @RequestParam(required = false) String endpoint) {
        return useCase.syntheticFromTrace(traceId, node, endpoint);
    }

    @Override
    @PostMapping("/enhancements/{component}")
    public Mono<EnhancementPlan> enhancement(@PathVariable String component) {
        return useCase.enhancement(component);
    }

    @Override
    @PostMapping("/enhancements/{component}/error-rate")
    public Mono<EnhancementPlan> errorRateEnhancement(@PathVariable String component,
            @RequestParam String target) {
        return useCase.errorRateEnhancement(component, target);
    }
}
