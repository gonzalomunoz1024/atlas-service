package com.atlas.dashboard.insights.domain;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.atlas.dashboard.common.domain.ComponentNode;

/**
 * Scopes a health map to nodes within {@code maxDepth} hops (undirected BFS) of the center —
 * callers and callees both count as one hop, and an edge survives only when both ends are in
 * reach. Coverage is re-scored over the surviving edges with the one scoring rule
 * ({@link MissingLinkDetector#coverage}), so the depth-limited view never drifts from the full one.
 */
public final class DepthScope {

    private DepthScope() {
    }

    public static HealthMap apply(HealthMap map, int maxDepth) {
        // center is a nullable Boolean (Jackson omits it on non-center nodes) — never unbox it
        ComponentNode center = map.nodes().stream()
                .filter(n -> Boolean.TRUE.equals(n.center()))
                .findFirst().orElse(null);
        if (center == null) {
            return map;
        }
        Map<String, List<String>> adj = new HashMap<>();
        for (HealthEdge e : map.edges()) {
            adj.computeIfAbsent(e.source(), k -> new ArrayList<>()).add(e.target());
            adj.computeIfAbsent(e.target(), k -> new ArrayList<>()).add(e.source());
        }
        Map<String, Integer> depth = new HashMap<>();
        depth.put(center.id(), 0);
        List<String> frontier = List.of(center.id());
        while (!frontier.isEmpty()) {
            List<String> next = new ArrayList<>();
            for (String id : frontier) {
                for (String nb : adj.getOrDefault(id, List.of())) {
                    if (!depth.containsKey(nb)) {
                        depth.put(nb, depth.get(id) + 1);
                        next.add(nb);
                    }
                }
            }
            frontier = next;
        }
        Set<String> keep = new HashSet<>();
        for (ComponentNode n : map.nodes()) {
            if (depth.getOrDefault(n.id(), Integer.MAX_VALUE) <= maxDepth) {
                keep.add(n.id());
            }
        }
        List<HealthEdge> edges = map.edges().stream()
                .filter(e -> keep.contains(e.source()) && keep.contains(e.target()))
                .toList();
        return new HealthMap(
                map.center(),
                map.nodes().stream().filter(n -> keep.contains(n.id())).toList(),
                edges,
                MissingLinkDetector.coverage(edges),
                MapInsights.of(map.center(), edges));
    }
}
