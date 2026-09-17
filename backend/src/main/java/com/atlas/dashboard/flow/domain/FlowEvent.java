package com.atlas.dashboard.flow.domain;

import com.atlas.dashboard.common.domain.CallStatus;
import com.atlas.dashboard.common.domain.EdgeKind;

/** A single observed call travelling one edge — drives the live particle overlay. */
public record FlowEvent(
        String id,
        String traceId,
        String origin,
        String source,
        String target,
        /** REST endpoint invoked on the target service, when the call is HTTP (null otherwise). */
        String endpoint,
        EdgeKind edgeKind,
        CallStatus status,
        int latencyMs,
        String ts) {
}
