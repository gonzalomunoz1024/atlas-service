package com.atlas.dashboard.common.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum EdgeKind {
    HTTP, GRPC, KAFKA, DB, MONGO, CACHE;

    @JsonValue
    public String json() {
        return name().toLowerCase();
    }
}
