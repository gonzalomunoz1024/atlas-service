package com.atlas.dashboard.insights.domain;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Live health verdict for one edge: the observed error rate over the configured trailing window,
 * and whether it crossed the threshold. The threshold rule lives here — the client only renders.
 */
public record EdgeHealthStatus(String edgeId, double ratePct, Status status) {

    public enum Status {
        OK, ERROR;

        @JsonValue
        public String json() {
            return name().toLowerCase();
        }
    }

    public static EdgeHealthStatus of(String edgeId, double rate, double threshold) {
        double ratePct = Math.round(rate * 1000) / 10.0;
        return new EdgeHealthStatus(edgeId, ratePct, rate > threshold ? Status.ERROR : Status.OK);
    }
}
