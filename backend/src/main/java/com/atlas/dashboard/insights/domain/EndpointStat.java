package com.atlas.dashboard.insights.domain;

/** Windowed traffic stats for one REST endpoint of a node — served, never client-derived. */
public record EndpointStat(String endpoint, int calls, int avgLatencyMs, double errorRatePct) {
}
