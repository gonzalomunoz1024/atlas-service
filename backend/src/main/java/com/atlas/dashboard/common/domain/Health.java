package com.atlas.dashboard.common.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Health {
    HEALTHY, DEGRADED, CRITICAL, UNKNOWN;

    @JsonValue
    public String json() {
        return name().toLowerCase();
    }
}
