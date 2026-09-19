package com.atlas.dashboard.flow.domain;

import com.atlas.dashboard.common.domain.CallStatus;

public record TraceSummary(
        String traceId,
        String entryService,
        String entryNodeId,
        String startedAt,
        int durationMs,
        CallStatus status,
        int spanCount,
        boolean hasLogGaps) {
}
