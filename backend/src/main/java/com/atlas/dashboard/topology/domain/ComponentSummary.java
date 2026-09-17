package com.atlas.dashboard.topology.domain;

import com.atlas.dashboard.common.domain.NodeKind;

public record ComponentSummary(String id, String name, NodeKind kind, String app, boolean owned) {
}
