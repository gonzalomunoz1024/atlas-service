package com.atlas.dashboard.topology.domain;

import java.util.List;

/** What a failure at {@code nodeId} would hurt: its transitive callers (self included). */
public record BlastRadius(String nodeId, List<String> impactedNodeIds) {
}
