package com.atlas.dashboard.actions.domain;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * The kind of test generated from a trace. SYNTHETIC replays the request and asserts on the
 * response; future kinds (e.g. PERFORMANCE load runs) slot in here — the port, endpoint, and UI
 * are all parameterised on it.
 */
public enum TestType {
    SYNTHETIC;

    @JsonValue
    public String json() {
        return name().toLowerCase();
    }
}
