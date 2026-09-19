package com.atlas.dashboard.insights.domain;

import java.util.List;

import com.atlas.dashboard.common.domain.ComponentNode;

public record HealthMap(
        String center,
        List<ComponentNode> nodes,
        List<HealthEdge> edges,
        CoverageScore coverage,
        MapInsights insights) {
}
