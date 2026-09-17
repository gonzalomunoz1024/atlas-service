package com.atlas.dashboard.common.domain;

/** Observed traffic characteristics for one edge, joined from SPLOC (traffic) + Splunk (logs). */
public record EdgeObservation(
        String edgeId,
        boolean observed,
        boolean hasLogs,
        int callsPerMin,
        double errorRate,
        int p95LatencyMs) {
}
