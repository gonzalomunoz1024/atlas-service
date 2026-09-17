package com.atlas.dashboard.actions.domain;

import java.util.Map;

public record SyntheticTest(
        String id,
        String name,
        String method,
        String path,
        Map<String, String> headers,
        String body,
        String summary,
        String hyperExecuteYaml) {
}
