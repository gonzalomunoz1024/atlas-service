package com.atlas.dashboard.actions.adapters.inbound;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.atlas.dashboard.actions.application.ActionsUseCase;
import com.atlas.dashboard.actions.domain.AlertPlan;
import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.GeneratedTest;
import com.atlas.dashboard.actions.domain.TestType;
import com.atlas.dashboard.actions.ports.inbound.ActionsInboundPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
@RequestMapping("/v1")
public class RestControllerActionsAdapter implements ActionsInboundPort {

    private final ActionsUseCase useCase;

    @Override
    public Mono<GeneratedTest> testFromTrace(String traceId, String node, String endpoint, TestType type) {
        return useCase.testFromTrace(traceId, node, endpoint, type);
    }

    @PostMapping("/tests/from-trace/{traceId}")
    public Mono<GeneratedTest> testFromTraceHttp(@PathVariable String traceId,
            @RequestParam(required = false) String node,
            @RequestParam(required = false) String endpoint,
            @RequestParam(defaultValue = "synthetic") String type) {
        return testFromTrace(traceId, node, endpoint, TestType.valueOf(type.toUpperCase()));
    }

    @Override
    @PostMapping("/enhancements/{component}")
    public Mono<EnhancementPlan> enhancement(@PathVariable String component) {
        return useCase.enhancement(component);
    }

    @Override
    @PostMapping("/alerts/from-trace/{traceId}")
    public Mono<AlertPlan> alertsFromTrace(@RequestParam String component,
            @PathVariable String traceId) {
        return useCase.alertsFromTrace(component, traceId);
    }

    @Override
    @PostMapping("/enhancements/{component}/error-rate")
    public Mono<EnhancementPlan> errorRateEnhancement(@PathVariable String component,
            @RequestParam String target) {
        return useCase.errorRateEnhancement(component, target);
    }
}
