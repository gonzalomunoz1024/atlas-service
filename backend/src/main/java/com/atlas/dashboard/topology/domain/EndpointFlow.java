package com.atlas.dashboard.topology.domain;

import java.util.List;

/**
 * A REST endpoint on a service plus the sub-flow it triggers: the nodes it touches and the edges it
 * traverses downstream (from DeepWiki's per-endpoint dependency analysis). Lets the UI dim the graph
 * to just one endpoint's flow.
 */
public record EndpointFlow(String endpoint, List<String> nodes, List<String> edgeIds) {
}
