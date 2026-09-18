package com.atlas.dashboard.common.domain;

/** Observed traffic characteristics for one edge, joined from SPLOC (traffic) + Splunk (logs). */
public record EdgeObservation(
        String edgeId,
        boolean observed,
        boolean hasLogs,
        /** how the logs prove the traffic (round-trip on the source, or trace-id in the receiver) */
        LogEvidence logEvidence,
        int callsPerMin,
        double errorRate,
        int p95LatencyMs) {
}
