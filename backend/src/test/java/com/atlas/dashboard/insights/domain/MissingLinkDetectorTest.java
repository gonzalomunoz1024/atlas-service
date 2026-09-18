package com.atlas.dashboard.insights.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.atlas.dashboard.common.domain.DependencyEdge;
import com.atlas.dashboard.common.domain.EdgeKind;
import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.common.domain.LogEvidence;

class MissingLinkDetectorTest {

    private static EdgeObservation obs(String id, boolean observed, boolean hasLogs) {
        return new EdgeObservation(id, observed, hasLogs,
                hasLogs ? LogEvidence.SOURCE_ROUND_TRIP : LogEvidence.NONE, observed ? 100 : 0, 0.01, 42);
    }

    @Test
    void observedWithLogsIsHealthy() {
        assertThat(MissingLinkDetector.classify(obs("a->b", true, true))).isEqualTo(LinkStatus.HEALTHY);
    }

    @Test
    void observedWithoutLogsIsMissingLogs() {
        assertThat(MissingLinkDetector.classify(obs("a->b", true, false))).isEqualTo(LinkStatus.MISSING_LOGS);
    }

    @Test
    void notObservedIsSilent() {
        assertThat(MissingLinkDetector.classify(obs("a->b", false, false))).isEqualTo(LinkStatus.SILENT);
    }

    @Test
    void nullObservationIsSilent() {
        assertThat(MissingLinkDetector.classify(null)).isEqualTo(LinkStatus.SILENT);
    }

    @Test
    void annotateCarriesMetricsAndStatus() {
        DependencyEdge edge = DependencyEdge.of("a", "b", EdgeKind.HTTP);
        HealthEdge he = MissingLinkDetector.annotate(edge, obs("a->b", true, false));
        assertThat(he.linkStatus()).isEqualTo(LinkStatus.MISSING_LOGS);
        assertThat(he.observed()).isTrue();
        assertThat(he.hasLogs()).isFalse();
        assertThat(he.callsPerMin()).isEqualTo(100);
        assertThat(he.p95LatencyMs()).isEqualTo(42);
    }

    @Test
    void annotateWithMissingObservationDefaultsToSilentZeroed() {
        DependencyEdge edge = DependencyEdge.of("a", "b", EdgeKind.HTTP);
        HealthEdge he = MissingLinkDetector.annotate(edge, null);
        assertThat(he.linkStatus()).isEqualTo(LinkStatus.SILENT);
        assertThat(he.callsPerMin()).isZero();
    }

    @Test
    void coverageIsShareOfObservedEdgesThatAreLogged() {
        List<DependencyEdge> edges = List.of(
                DependencyEdge.of("a", "b", EdgeKind.HTTP),
                DependencyEdge.of("a", "c", EdgeKind.HTTP),
                DependencyEdge.of("a", "d", EdgeKind.HTTP),
                DependencyEdge.of("a", "e", EdgeKind.HTTP));
        Map<String, EdgeObservation> observations = Map.of(
                "a->b", obs("a->b", true, true),   // healthy
                "a->c", obs("a->c", true, true),   // healthy
                "a->d", obs("a->d", true, false),  // missing logs
                "a->e", obs("a->e", false, false)); // silent — excluded from denominator

        List<HealthEdge> annotated = MissingLinkDetector.annotateAll(edges, observations);
        CoverageScore cov = MissingLinkDetector.coverage(annotated);

        assertThat(cov.observedEdges()).isEqualTo(3);
        assertThat(cov.loggedEdges()).isEqualTo(2);
        assertThat(cov.totalEdges()).isEqualTo(4);
        assertThat(cov.score()).isEqualTo(67); // 2/3
    }

    @Test
    void coverageIsZeroWhenNothingObserved() {
        List<HealthEdge> annotated = MissingLinkDetector.annotateAll(
                List.of(DependencyEdge.of("a", "b", EdgeKind.HTTP)),
                Map.of("a->b", obs("a->b", false, false)));
        assertThat(MissingLinkDetector.coverage(annotated).score()).isZero();
    }

    @Test
    void missingLinksAreRankedMissingLogsBeforeSilentAndExcludeHealthy() {
        List<DependencyEdge> edges = List.of(
                DependencyEdge.of("a", "b", EdgeKind.HTTP),
                DependencyEdge.of("a", "c", EdgeKind.HTTP),
                DependencyEdge.of("a", "d", EdgeKind.HTTP));
        Map<String, EdgeObservation> observations = Map.of(
                "a->b", obs("a->b", false, false),  // silent
                "a->c", obs("a->c", true, false),   // missing logs
                "a->d", obs("a->d", true, true));   // healthy

        List<HealthEdge> flagged = MissingLinkDetector.missingLinks(
                MissingLinkDetector.annotateAll(edges, observations));

        assertThat(flagged).hasSize(2);
        assertThat(flagged.get(0).linkStatus()).isEqualTo(LinkStatus.MISSING_LOGS);
        assertThat(flagged.get(1).linkStatus()).isEqualTo(LinkStatus.SILENT);
    }
}
