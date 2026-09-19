package com.atlas.dashboard.topology.application;

import org.springframework.stereotype.Service;

import java.util.List;

import com.atlas.dashboard.common.domain.NodeKindRule;
import com.atlas.dashboard.topology.domain.ApiOperation;
import com.atlas.dashboard.topology.domain.ClusterDeployment;
import com.atlas.dashboard.topology.domain.ComponentGraph;
import com.atlas.dashboard.topology.domain.ComponentSummary;
import com.atlas.dashboard.topology.domain.EndpointFlow;
import com.atlas.dashboard.topology.domain.NodeMetrics;
import com.atlas.dashboard.topology.domain.RepoRevisions;
import com.atlas.dashboard.topology.domain.WikiDoc;
import com.atlas.dashboard.topology.ports.inbound.TopologyInboundPort;
import com.atlas.dashboard.topology.ports.outbound.DeepWikiPort;
import com.atlas.dashboard.topology.ports.outbound.GrafanaPort;
import com.atlas.dashboard.topology.ports.outbound.OpenShiftPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class TopologyUseCase implements TopologyInboundPort {

    private final DeepWikiPort deepWiki;
    private final GrafanaPort grafana;
    private final OpenShiftPort openShift;

    @Override
    public Flux<ComponentSummary> search(String query) {
        return deepWiki.search(query == null ? "" : query)
                .map(s -> new ComponentSummary(s.id(), s.name(),
                        NodeKindRule.effective(s.kind(), s.owned()), s.app(), s.owned()));
    }

    @Override
    public Mono<ComponentGraph> graph(String component, String rev) {
        // presentation-domain rule applied here so every adapter (mock or real) gets it
        return deepWiki.graph(component, rev)
                .map(g -> new ComponentGraph(g.center(),
                        g.nodes().stream().map(NodeKindRule::apply).toList(), g.edges()));
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

    @Override
    public Mono<List<ClusterDeployment>> deployments(String component, String nodeId) {
        return openShift.deployments(nodeId);
    }
}
