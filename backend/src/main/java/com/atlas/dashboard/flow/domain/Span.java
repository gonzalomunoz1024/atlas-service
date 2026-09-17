package com.atlas.dashboard.flow.domain;

import java.util.List;

import com.atlas.dashboard.common.domain.CallStatus;

public record Span(
        String spanId,
        String parentSpanId,
        String nodeId,
        String service,
        String op,
        int startOffsetMs,
        int durationMs,
        CallStatus status,
        boolean hasLogs,
        List<LogLine> logs) {

    public Span withLogs(List<LogLine> merged) {
        return new Span(spanId, parentSpanId, nodeId, service, op, startOffsetMs, durationMs,
                status, !merged.isEmpty(), merged);
    }
}
