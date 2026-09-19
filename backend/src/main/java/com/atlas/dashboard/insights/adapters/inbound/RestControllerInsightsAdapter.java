package com.atlas.dashboard.insights.adapters.inbound;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.atlas.dashboard.insights.application.HealthMapUseCase;
import com.atlas.dashboard.insights.domain.EdgeHealthStatus;
import com.atlas.dashboard.insights.domain.EndpointStat;
import com.atlas.dashboard.insights.domain.HealthMap;
import com.atlas.dashboard.insights.ports.inbound.InsightsInboundPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
@RequestMapping("/v1")
public class RestControllerInsightsAdapter implements InsightsInboundPort {

    private final HealthMapUseCase useCase;

    @Override
    @GetMapping("/components/{component}/health-map")
    public Mono<HealthMap> healthMap(@PathVariable String component,
            @RequestParam(required = false) String rev,
            @RequestParam(required = false) Integer maxDepth) {
        return useCase.healthMap(component, rev, maxDepth);
    }

    @Override
    @GetMapping("/components/{component}/nodes/{nodeId}/endpoint-stats")
    public Mono<java.util.List<EndpointStat>> endpointStats(@PathVariable String component,
            @PathVariable String nodeId,
            @RequestParam(defaultValue = "15") int windowMin) {
        return useCase.endpointStats(component, nodeId, windowMin);
    }

    @Override
    @GetMapping("/components/{component}/edge-health")
    public Mono<java.util.List<EdgeHealthStatus>> edgeHealth(@PathVariable String component,
            @RequestParam(required = false) String rev,
            @RequestParam(defaultValue = "15") int windowMin,
            @RequestParam(defaultValue = "10") double thresholdPct) {
        return useCase.edgeHealth(component, rev, windowMin, thresholdPct);
    }
}
