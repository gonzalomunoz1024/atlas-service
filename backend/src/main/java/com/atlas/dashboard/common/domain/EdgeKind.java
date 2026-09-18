package com.atlas.dashboard.common.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum EdgeKind {
    HTTP, KAFKA, MONGO;

    @JsonValue
    public String json() {
        return name().toLowerCase();
    }
}
