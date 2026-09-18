package com.atlas.dashboard.common.domain;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * How Splunk logs prove that observed traffic on an edge is actually logged:
 * <ul>
 *   <li>{@code SOURCE_ROUND_TRIP} — the source logged both the outgoing request and the
 *       received response (two correlated log events on the caller's side).</li>
 *   <li>{@code TRACE_CORRELATED} — the source sent a message carrying a trace id, and that
 *       same trace id shows up in the receiver's logs.</li>
 *   <li>{@code NONE} — traffic may exist, but neither evidence pattern was found (the
 *       missing-link condition when the edge is observed).</li>
 * </ul>
 */
public enum LogEvidence {
    SOURCE_ROUND_TRIP, TRACE_CORRELATED, NONE;

    @JsonValue
    public String json() {
        return name().toLowerCase();
    }
}
