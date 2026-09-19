package com.atlas.dashboard.insights.domain;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Server-judged map facts the UI must not re-derive: which nodes touch a logging gap (the
 * enhancement banner), which nodes originate one (the fix offer), and which edges touch the
 * center (the safeguard-offer context).
 */
public record MapInsights(
        List<String> gapTouchedNodeIds,
        List<String> gapSourceNodeIds,
        List<String> centerEdgeIds,
        List<String> flaggedEdgeIds) {

    public static MapInsights of(String centerId, List<HealthEdge> edges) {
        Set<String> touched = new LinkedHashSet<>();
        Set<String> sources = new LinkedHashSet<>();
        Set<String> centerEdges = new LinkedHashSet<>();
        for (HealthEdge e : edges) {
            if (e.linkStatus() == LinkStatus.MISSING_LOGS) {
                touched.add(e.source());
                touched.add(e.target());
                sources.add(e.source());
            }
            if (e.source().equals(centerId) || e.target().equals(centerId)) {
                centerEdges.add(e.id());
            }
        }
        List<String> flagged = MissingLinkDetector.missingLinks(edges).stream()
                .map(HealthEdge::id)
                .toList();
        return new MapInsights(List.copyOf(touched), List.copyOf(sources), List.copyOf(centerEdges),
                flagged);
    }
}
