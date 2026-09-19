package com.atlas.dashboard.topology.ports.outbound;

import java.util.List;

import com.atlas.dashboard.topology.domain.ClusterDeployment;

import reactor.core.publisher.Mono;

/**
 * OpenShift cluster inventory: where an application node is deployed. Backed by the OCP
 * cluster APIs in production; the mock derives deterministic placements.
 */
public interface OpenShiftPort {

    /** Deployments for an app node across clusters/environments; empty for non-app nodes. */
    Mono<List<ClusterDeployment>> deployments(String nodeId);
}
