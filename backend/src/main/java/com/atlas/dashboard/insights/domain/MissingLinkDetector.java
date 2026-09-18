package com.atlas.dashboard.insights.domain;

import java.util.List;
import java.util.Map;

import com.atlas.dashboard.common.domain.DependencyEdge;
import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.common.domain.LogEvidence;

/**
 * Pure domain logic that joins the DeepWiki topology with observed traffic + logs.
 *
 * <p>An edge counts as "logged" only when the logs actually prove the traffic: either the
 * source logged the round trip (request out + response back), or the source's trace id
 * appears in the receiver's logs ({@link LogEvidence}).</p>
 *
 * <ul>
 *   <li>topology edge + traffic + log evidence → {@code HEALTHY}</li>
 *   <li>topology edge + traffic + NO log evidence → {@code MISSING_LOGS} (misconfigured logging)</li>
 *   <li>topology edge + NO traffic       → {@code SILENT}</li>
 * </ul>
 */
public final class MissingLinkDetector {

    private MissingLinkDetector() {
    }

    public static LinkStatus classify(EdgeObservation obs) {
        if (obs == null || !obs.observed()) {
            return LinkStatus.SILENT;
        }
        return obs.hasLogs() ? LinkStatus.HEALTHY : LinkStatus.MISSING_LOGS;
    }

    public static HealthEdge annotate(DependencyEdge edge, EdgeObservation obs) {
        LinkStatus status = classify(obs);
        boolean observed = obs != null && obs.observed();
        boolean hasLogs = obs != null && obs.hasLogs();
        LogEvidence evidence = obs == null ? LogEvidence.NONE : obs.logEvidence();
        return new HealthEdge(
                edge.id(),
                edge.source(),
                edge.target(),
                edge.kind(),
                observed,
                hasLogs,
                evidence,
                status,
                obs == null ? 0 : obs.callsPerMin(),
                obs == null ? 0 : obs.errorRate(),
                obs == null ? 0 : obs.p95LatencyMs());
    }

    public static List<HealthEdge> annotateAll(List<DependencyEdge> edges, Map<String, EdgeObservation> obs) {
        return edges.stream().map(e -> annotate(e, obs.get(e.id()))).toList();
    }

    public static CoverageScore coverage(List<HealthEdge> edges) {
        int observed = (int) edges.stream().filter(HealthEdge::observed).count();
        int logged = (int) edges.stream().filter(HealthEdge::hasLogs).count();
        int score = observed == 0 ? 0 : Math.round((logged * 100f) / observed);
        return new CoverageScore(logged, observed, edges.size(), score);
    }

    /** Edges worth flagging to the user, worst first (missing logs before silent). */
    public static List<HealthEdge> missingLinks(List<HealthEdge> edges) {
        return edges.stream()
                .filter(e -> e.linkStatus() != LinkStatus.HEALTHY)
                .sorted((a, b) -> rank(a) - rank(b))
                .toList();
    }

    private static int rank(HealthEdge e) {
        return switch (e.linkStatus()) {
            case MISSING_LOGS -> 0;
            case SILENT -> 1;
            case HEALTHY -> 2;
        };
    }
}
