package com.atlas.dashboard.insights.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum LinkStatus {
    HEALTHY, MISSING_LOGS, SILENT;

    @JsonValue
    public String json() {
        return name().toLowerCase();
    }
}
