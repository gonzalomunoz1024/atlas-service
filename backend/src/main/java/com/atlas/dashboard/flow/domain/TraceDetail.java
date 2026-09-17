package com.atlas.dashboard.flow.domain;

import java.util.List;

import com.atlas.dashboard.common.domain.CallStatus;

public record TraceDetail(
        String traceId,
        String startedAt,
        int durationMs,
        CallStatus status,
        List<Span> spans) {
}
