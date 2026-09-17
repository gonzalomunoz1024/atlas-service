package com.atlas.dashboard.topology.domain;

import java.util.List;

import com.atlas.dashboard.common.domain.ComponentNode;
import com.atlas.dashboard.common.domain.DependencyEdge;

public record ComponentGraph(String center, List<ComponentNode> nodes, List<DependencyEdge> edges) {
}
