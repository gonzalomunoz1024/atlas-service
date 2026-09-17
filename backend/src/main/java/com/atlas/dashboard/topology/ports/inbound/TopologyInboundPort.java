package com.atlas.dashboard.topology.ports.inbound;

import java.util.List;

import com.atlas.dashboard.topology.domain.ApiOperation;
import com.atlas.dashboard.topology.domain.ComponentGraph;
import com.atlas.dashboard.topology.domain.ComponentSummary;
import com.atlas.dashboard.topology.domain.EndpointFlow;
import com.atlas.dashboard.topology.domain.NodeMetrics;
import com.atlas.dashboard.topology.domain.RepoRevisions;
import com.atlas.dashboard.topology.domain.WikiDoc;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface TopologyInboundPort {
    Flux<ComponentSummary> search(String query);

    Mono<ComponentGraph> graph(String component, String rev);

    Mono<NodeMetrics> metrics(String component, String nodeId);

    Mono<WikiDoc> wiki(String component, String nodeId);

    Mono<List<EndpointFlow>> endpoints(String component, String nodeId);

    Mono<RepoRevisions> revisions(String component);

    Mono<List<ApiOperation>> apiSpec(String component, String nodeId);
}
