package com.atlas.dashboard.flow.domain;

import java.util.List;

/**
 * A coherent flow that originates at {@code origin}: the set of nodes it touches and the edges it
 * traverses, walked from the topology with channel semantics (a synchronous request never fans out
 * onto the Kafka event bus). Lets the UI dim everything outside a selected flow.
 */
public record FlowRoute(String origin, List<String> nodes, List<String> edgeIds) {
}
