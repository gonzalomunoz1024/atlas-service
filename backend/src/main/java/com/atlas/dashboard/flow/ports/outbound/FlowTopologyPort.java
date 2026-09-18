package com.atlas.dashboard.flow.ports.outbound;

import java.util.List;
import java.util.Map;
import java.util.Set;

import com.atlas.dashboard.common.domain.DependencyEdge;
import com.atlas.dashboard.common.domain.EdgeObservation;

/**
 * Topology + observation data the flow slice needs to build coherent live flows: the dependency
 * edges of a component's map, which of them carry observed traffic, which nodes are services
 * (potential traffic origins), and the REST endpoints a node exposes. Backed by DeepWiki + SPLOC
 * in production; the mock adapter serves fixture data.
 */
public interface FlowTopologyPort {

    List<DependencyEdge> edges(String component, String rev);

    Map<String, EdgeObservation> edgeObservations(String component, String rev);

    /** Ids of service-class nodes on the component's map (candidates for flow entry points). */
    Set<String> serviceIds(String component, String rev);

    /** REST endpoints a node exposes (empty for non-HTTP infra like topics or stores). */
    List<String> endpoints(String nodeId);
}
