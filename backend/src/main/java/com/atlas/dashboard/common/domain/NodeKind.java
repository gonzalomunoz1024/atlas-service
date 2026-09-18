package com.atlas.dashboard.common.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeKind {
    SERVICE, KAFKA, DATABASE, STORE, CACHE, EXTERNAL;

    @JsonValue
    public String json() {
        return name().toLowerCase();
    }
}
