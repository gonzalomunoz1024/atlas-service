package com.atlas.dashboard.insights.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.atlas.dashboard.common.domain.ComponentNode;
import com.atlas.dashboard.common.domain.DependencyEdge;
import com.atlas.dashboard.common.domain.EdgeKind;
import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.common.domain.LogEvidence;
import com.atlas.dashboard.insights.domain.HealthEdge;
import com.atlas.dashboard.insights.domain.LinkStatus;
import com.atlas.dashboard.insights.ports.outbound.ObservabilityPort;
import com.atlas.dashboard.topology.domain.ComponentGraph;
import com.atlas.dashboard.topology.ports.outbound.DeepWikiPort;

import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

@ExtendWith(MockitoExtension.class)
class HealthMapUseCaseTest {

    @Mock private DeepWikiPort deepWiki;
    @Mock private ObservabilityPort observability;

    private HealthMapUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new HealthMapUseCase(deepWiki, observability);
    }

    @Test
    void joinsTopologyWithObservabilityAndFlagsMissingLogs() {
        ComponentGraph graph = new ComponentGraph(
                "svc",
                List.of(ComponentNode.center("svc", "svc")),
                List.of(
                        DependencyEdge.of("svc", "logged-dep", EdgeKind.HTTP),
                        DependencyEdge.of("svc", "silent-dep", EdgeKind.HTTP),
                        DependencyEdge.of("svc", "gap-dep", EdgeKind.HTTP)));

        Map<String, EdgeObservation> obs = Map.of(
                "svc->logged-dep", new EdgeObservation("svc->logged-dep", true, true, LogEvidence.SOURCE_ROUND_TRIP, 200, 0.01, 30),
                "svc->silent-dep", new EdgeObservation("svc->silent-dep", false, false, LogEvidence.NONE, 0, 0, 0),
                "svc->gap-dep", new EdgeObservation("svc->gap-dep", true, false, LogEvidence.NONE, 150, 0.05, 90));

        when(deepWiki.graph("svc", null)).thenReturn(Mono.just(graph));
        when(observability.edgeObservations("svc", null)).thenReturn(Mono.just(obs));

        StepVerifier.create(useCase.healthMap("svc", null))
                .assertNext(map -> {
                    assertThat(map.center()).isEqualTo("svc");
                    assertThat(status(map.edges(), "svc->logged-dep")).isEqualTo(LinkStatus.HEALTHY);
                    assertThat(status(map.edges(), "svc->silent-dep")).isEqualTo(LinkStatus.SILENT);
                    assertThat(status(map.edges(), "svc->gap-dep")).isEqualTo(LinkStatus.MISSING_LOGS);
                    // 2 observed, 1 logged -> 50%
                    assertThat(map.coverage().observedEdges()).isEqualTo(2);
                    assertThat(map.coverage().loggedEdges()).isEqualTo(1);
                    assertThat(map.coverage().score()).isEqualTo(50);
                })
                .verifyComplete();
    }

    private static LinkStatus status(List<HealthEdge> edges, String id) {
        return edges.stream().filter(e -> e.id().equals(id)).findFirst().orElseThrow().linkStatus();
    }
}
