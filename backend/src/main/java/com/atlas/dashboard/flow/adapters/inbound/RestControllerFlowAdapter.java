package com.atlas.dashboard.flow.adapters.inbound;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import com.atlas.dashboard.flow.application.FlowUseCase;
import com.atlas.dashboard.flow.domain.TraceInvocation;
import com.atlas.dashboard.flow.domain.FlowRoute;
import com.atlas.dashboard.flow.domain.TraceDetail;
import com.atlas.dashboard.flow.domain.TraceSummary;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
@RequestMapping("/v1")
// note: liveFlow on FlowInboundPort is served by the WebSocket handler, so this REST
// controller maps the remaining operations without implementing the interface itself
public class RestControllerFlowAdapter {

    private final FlowUseCase useCase;

    @GetMapping("/traces")
    public Flux<TraceSummary> recentTraces(
            @RequestParam String component,
            @RequestParam(defaultValue = "12") int limit,
            @RequestParam(required = false) String rev,
            @RequestParam(required = false) String earliest,
            @RequestParam(required = false) String latest,
            @RequestParam(required = false) String edge) {
        return useCase.recentTraces(component, limit, rev, earliest, latest, edge);
    }

    @GetMapping("/traces/{traceId}")
    public Mono<TraceDetail> trace(@PathVariable String traceId) {
        return useCase.trace(traceId);
    }

    @GetMapping("/traces/{traceId}/invokes/{nodeId}")
    public Mono<TraceInvocation> invokes(@PathVariable String traceId, @PathVariable String nodeId) {
        return useCase.invokes(traceId, nodeId);
    }

    @GetMapping("/components/{component}/flows")
    public List<FlowRoute> flows(@PathVariable String component,
            @RequestParam(required = false) String rev) {
        return useCase.flows(component, rev);
    }
}
