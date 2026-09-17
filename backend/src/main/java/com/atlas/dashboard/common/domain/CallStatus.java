package com.atlas.dashboard.common.domain;

import com.fasterxml.jackson.annotation.JsonValue;

/** Shared ok/error status for flow events, spans and traces. */
public enum CallStatus {
    OK, ERROR;

    @JsonValue
    public String json() {
        return name().toLowerCase();
    }
}
