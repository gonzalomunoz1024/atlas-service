package com.atlas.dashboard.flow.ports.inbound;

import java.util.List;

import com.atlas.dashboard.flow.domain.FlowEvent;
import com.atlas.dashboard.flow.domain.FlowRoute;
import com.atlas.dashboard.flow.domain.TraceDetail;
import com.atlas.dashboard.flow.domain.TraceInvocation;
import com.atlas.dashboard.flow.domain.TraceSummary;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface FlowInboundPort {
    /** earliest/latest are Splunk time modifiers; {@code edge} scopes to traces crossing that hop. */
    Flux<TraceSummary> recentTraces(String component, int limit, String rev, String earliest,
            String latest, String edge);

    Mono<TraceDetail> trace(String traceId);

    /** Whether the trace's call path passes through the node — the safeguard eligibility fact. */
    Mono<TraceInvocation> invokes(String traceId, String nodeId);

    /** Endless stream of simulated live calls travelling the map's observed edges. */
    Flux<FlowEvent> liveFlow(String component, String rev);

    /** Coherent flows (origin → node/edge membership) so the UI can dim outside a selected flow. */
    List<FlowRoute> flows(String component, String rev);
}
