package com.atlas.dashboard.insights.domain;

/** Share of observed (live) edges that also have logs — the headline ROI number. */
public record CoverageScore(int loggedEdges, int observedEdges, int totalEdges, int score, String band) {

    /** The verdict colouring rule lives here, not in the UI. */
    public static CoverageScore of(int logged, int observed, int total, int score) {
        String band = score >= 90 ? "good" : score >= 60 ? "warn" : "critical";
        return new CoverageScore(logged, observed, total, score, band);
    }
}
