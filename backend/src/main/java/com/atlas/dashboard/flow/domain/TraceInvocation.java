package com.atlas.dashboard.flow.domain;

/** Whether a trace's call path passes through a given node — the safeguard eligibility fact. */
public record TraceInvocation(String traceId, String nodeId, boolean invoked) {
}
