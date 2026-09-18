package com.atlas.dashboard.actions.domain;

import java.util.Map;

/** A test generated from a trace — shape shared by all {@link TestType}s HyperExecute runs. */
public record GeneratedTest(
        TestType type,
        String id,
        String name,
        String method,
        String path,
        Map<String, String> headers,
        String body,
        String summary,
        String hyperExecuteYaml) {
}
