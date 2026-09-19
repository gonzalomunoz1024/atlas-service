package com.atlas.dashboard.insights.application;

import org.springframework.stereotype.Service;

import com.atlas.dashboard.common.domain.NodeKindRule;
import java.util.List;

import com.atlas.dashboard.insights.domain.DepthScope;
import com.atlas.dashboard.insights.domain.EdgeHealthStatus;
import com.atlas.dashboard.insights.domain.EndpointStat;
import com.atlas.dashboard.insights.domain.HealthEdge;
import com.atlas.dashboard.insights.domain.HealthMap;
import com.atlas.dashboard.insights.domain.MissingLinkDetector;
import com.atlas.dashboard.insights.ports.inbound.InsightsInboundPort;
import com.atlas.dashboard.insights.ports.outbound.ObservabilityPort;
import com.atlas.dashboard.topology.ports.outbound.DeepWikiPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

/**
 * Joins the DeepWiki topology with observed traffic + logs to produce the annotated health map
 * and coverage score. This is the product's core insight — a read model materialized on the fly.
 */
@Service
@RequiredArgsConstructor
public class HealthMapUseCase implements InsightsInboundPort {

    private final DeepWikiPort deepWiki;
    private final ObservabilityPort observability;

    @Override
    public Mono<HealthMap> healthMap(String component, String rev, Integer maxDepth) {
        return Mono.zip(
                deepWiki.graph(component, rev),
                observability.edgeObservations(component, rev))
                .map(t -> {
                    var graph = t.getT1();
                    var obs = t.getT2();
                    java.util.List<HealthEdge> edges = MissingLinkDetector.annotateAll(graph.edges(), obs);
                    HealthMap map = new HealthMap(
                            graph.center(),
                            graph.nodes().stream().map(NodeKindRule::apply).toList(),
                            edges,
                            MissingLinkDetector.coverage(edges));
                    return maxDepth != null ? DepthScope.apply(map, maxDepth) : map;
                });
    }

    @Override
    public Mono<List<EndpointStat>> endpointStats(String component, String nodeId, int windowMin) {
        return observability.endpointStats(nodeId, windowMin);
    }

    @Override
    public Mono<List<EdgeHealthStatus>> edgeHealth(String component, String rev, int windowMin,
            double thresholdPct) {
        return observability.windowedErrorRates(component, rev, windowMin)
                .map(rates -> rates.entrySet().stream()
                        .map(e -> EdgeHealthStatus.of(e.getKey(), e.getValue(), thresholdPct / 100.0))
                        .toList());
    }
}
