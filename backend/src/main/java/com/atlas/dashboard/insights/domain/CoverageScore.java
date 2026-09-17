package com.atlas.dashboard.insights.domain;

/** Share of observed (live) edges that also have logs — the headline ROI number. */
public record CoverageScore(int loggedEdges, int observedEdges, int totalEdges, int score) {
}
