package com.atlas.dashboard.topology.application;

import org.springframework.stereotype.Service;

import java.util.List;

import java.util.Set;

import com.atlas.dashboard.common.domain.NodeKind;
import com.atlas.dashboard.common.domain.NodeKindRule;
import com.atlas.dashboard.common.domain.TopologyRules;
import com.atlas.dashboard.topology.domain.ApiOperation;
import com.atlas.dashboard.topology.domain.BlastRadius;
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
        // flow composition is OUR rule: the upstream request path (channel-correct, from the
        // original invokers) is shared by all of a node's endpoints; each endpoint adds its own
        // downstream edges. The adapter only supplies raw endpoint→downstream data.
        return Mono.zip(deepWiki.graph(component, null), deepWiki.endpointDownstream(nodeId))
                .map(t -> {
                    var graph = t.getT1();
                    var downstream = t.getT2();
                    Set<String> appIds = graph.nodes().stream()
                            .filter(n -> {
                                NodeKind kind = NodeKindRule.effective(n.kind(), n.owned());
                                return kind == NodeKind.SERVICE || kind == NodeKind.EXTERNAL;
                            })
                            .map(n -> n.id())
                            .collect(java.util.stream.Collectors.toSet());
                    List<String> upstream =
                            TopologyRules.upstreamEdges(nodeId, graph.edges(), appIds);
                    return downstream.entrySet().stream()
                            .map(e -> {
                                java.util.LinkedHashSet<String> edges = new java.util.LinkedHashSet<>(upstream);
                                edges.addAll(e.getValue());
                                java.util.LinkedHashSet<String> nodes = new java.util.LinkedHashSet<>();
                                nodes.add(nodeId);
                                for (String id : edges) {
                                    int arrow = id.indexOf("->");
                                    if (arrow >= 0) {
                                        nodes.add(id.substring(0, arrow));
                                        nodes.add(id.substring(arrow + 2));
                                    }
                                }
                                return new EndpointFlow(e.getKey(), List.copyOf(nodes), List.copyOf(edges));
                            })
                            .toList();
                });
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
        // Atlas's rule, not the mock's: only application nodes run on OCP — topics and stores
        // are managed infra, whatever the cluster inventory would say
        return deepWiki.graph(component, null)
                .flatMap(g -> g.nodes().stream()
                        .filter(n -> n.id().equals(nodeId))
                        .findFirst()
                        .filter(n -> {
                            NodeKind kind = NodeKindRule.effective(n.kind(), n.owned());
                            return kind == NodeKind.SERVICE || kind == NodeKind.EXTERNAL;
                        })
                        .map(n -> openShift.deployments(nodeId))
                        .orElse(Mono.just(List.of())));
    }

    @Override
    public Mono<BlastRadius> blastRadius(String component, String nodeId, String rev, Integer maxDepth) {
        // the traversal is a domain rule (TopologyRules); depth keeps the count honest to the view
        return deepWiki.graph(component, rev).map(g -> {
            var edges = g.edges();
            if (maxDepth != null) {
                Set<String> keep = TopologyRules.withinDepth(g.center(), edges, maxDepth);
                edges = edges.stream()
                        .filter(e -> keep.contains(e.source()) && keep.contains(e.target()))
                        .toList();
            }
            return new BlastRadius(nodeId, List.copyOf(TopologyRules.blastRadius(nodeId, edges)));
        });
    }
}
