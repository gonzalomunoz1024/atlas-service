package com.atlas.dashboard.flow.ports.outbound;

import com.atlas.dashboard.flow.domain.TraceDetail;
import com.atlas.dashboard.flow.domain.TraceSummary;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** SPLOC: trace/span topology (without logs). */
public interface SplocPort {
    Flux<TraceSummary> recentTraces(String component, int limit, String rev);

    /** Span skeleton for a trace, with empty log lists (logs come from Splunk). */
    Mono<TraceDetail> spans(String traceId);
}
