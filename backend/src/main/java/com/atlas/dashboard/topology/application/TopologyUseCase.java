package com.atlas.dashboard.topology.application;

import org.springframework.stereotype.Service;

import java.util.List;

import com.atlas.dashboard.topology.domain.ApiOperation;
import com.atlas.dashboard.topology.domain.ComponentGraph;
import com.atlas.dashboard.topology.domain.ComponentSummary;
import com.atlas.dashboard.topology.domain.EndpointFlow;
import com.atlas.dashboard.topology.domain.NodeMetrics;
import com.atlas.dashboard.topology.domain.RepoRevisions;
import com.atlas.dashboard.topology.domain.WikiDoc;
import com.atlas.dashboard.topology.ports.inbound.TopologyInboundPort;
import com.atlas.dashboard.topology.ports.outbound.DeepWikiPort;
import com.atlas.dashboard.topology.ports.outbound.GrafanaPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class TopologyUseCase implements TopologyInboundPort {

    private final DeepWikiPort deepWiki;
    private final GrafanaPort grafana;

    @Override
    public Flux<ComponentSummary> search(String query) {
        return deepWiki.search(query == null ? "" : query);
    }

    @Override
    public Mono<ComponentGraph> graph(String component, String rev) {
        return deepWiki.graph(component, rev);
    }

    @Override
    public Mono<NodeMetrics> metrics(String component, String nodeId) {
        return grafana.metrics(nodeId);
    }

    @Override
    public Mono<WikiDoc> wiki(String component, String nodeId) {
        return deepWiki.wiki(nodeId);
    }

    @Override
    public Mono<List<EndpointFlow>> endpoints(String component, String nodeId) {
        return deepWiki.endpoints(nodeId);
    }

    @Override
    public Mono<RepoRevisions> revisions(String component) {
        return deepWiki.revisions(component);
    }

    @Override
    public Mono<List<ApiOperation>> apiSpec(String component, String nodeId) {
        return deepWiki.apiSpec(nodeId);
    }
}
