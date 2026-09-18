package com.atlas.dashboard.insights.domain;

import com.atlas.dashboard.common.domain.EdgeKind;
import com.atlas.dashboard.common.domain.LogEvidence;

/** A dependency edge annotated with the topology↔observability join result. */
public record HealthEdge(
        String id,
        String source,
        String target,
        EdgeKind kind,
        boolean observed,
        boolean hasLogs,
        LogEvidence logEvidence,
        LinkStatus linkStatus,
        int callsPerMin,
        double errorRate,
        int p95LatencyMs) {
}
