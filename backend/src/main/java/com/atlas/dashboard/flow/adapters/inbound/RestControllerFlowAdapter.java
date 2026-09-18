package com.atlas.dashboard.flow.adapters.inbound;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import com.atlas.dashboard.flow.application.FlowUseCase;
import com.atlas.dashboard.flow.domain.FlowRoute;
import com.atlas.dashboard.flow.domain.TraceDetail;
import com.atlas.dashboard.flow.domain.TraceSummary;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
@RequestMapping("/v1")
public class RestControllerFlowAdapter {

    private final FlowUseCase useCase;

    @GetMapping("/traces")
    public Flux<TraceSummary> traces(
            @RequestParam String component,
            @RequestParam(defaultValue = "12") int limit,
            @RequestParam(required = false) String rev) {
        return useCase.recentTraces(component, limit, rev);
    }

    @GetMapping("/traces/{traceId}")
    public Mono<TraceDetail> trace(@PathVariable String traceId) {
        return useCase.trace(traceId);
    }

    @GetMapping("/components/{component}/flows")
    public List<FlowRoute> flows(@PathVariable String component,
            @RequestParam(required = false) String rev) {
        return useCase.flows(component, rev);
    }
}
