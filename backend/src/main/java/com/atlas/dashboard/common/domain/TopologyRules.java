package com.atlas.dashboard.common.domain;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Topology derivation rules Atlas owns, independent of where the topology data comes from
 * (mock fixture today, real DeepWiki tomorrow). Pure functions over edges + node classes —
 * adapters supply data, these supply the rules.
 */
public final class TopologyRules {

    private TopologyRules() {
    }

    /**
     * Entry points that originate traffic into the platform — derived from the topology, not
     * hardcoded. A node is an entry point when it is a service that emits calls (has outbound
     * edges) but receives no <em>synchronous</em> inbound call; it may still receive
     * asynchronous (Kafka) responses to flows it started.
     */
    public static List<String> entryPoints(Collection<DependencyEdge> edges, Set<String> serviceIds) {
        Set<String> hasOutbound = new HashSet<>();
        Set<String> hasSyncInbound = new HashSet<>();
        for (DependencyEdge e : edges) {
            hasOutbound.add(e.source());
            if (e.kind() != EdgeKind.KAFKA) {
                hasSyncInbound.add(e.target());
            }
        }
        List<String> entries = new ArrayList<>();
        for (String id : serviceIds) {
            if (hasOutbound.contains(id) && !hasSyncInbound.contains(id)) {
                entries.add(id);
            }
        }
        return entries;
    }

    /**
     * Edge ids on the request path(s) that lead <em>into</em> a node, from each original invoker
     * (entry point) down to the node — channel-correct (a synchronous request never travels the
     * Kafka bus). Lets a flow be shown end-to-end, starting at the invoker, not just downstream.
     */
    public static List<String> upstreamEdges(String target, Collection<DependencyEdge> edges,
            Set<String> serviceIds) {
        Map<String, List<DependencyEdge>> out = new LinkedHashMap<>();
        for (DependencyEdge e : edges) {
            out.computeIfAbsent(e.source(), k -> new ArrayList<>()).add(e);
        }
        record Frontier(String id, boolean async) {
        }
        Set<String> collected = new LinkedHashSet<>();
        for (String entry : entryPoints(edges, serviceIds)) {
            // channel-correct BFS from the invoker, recording the edge each node was reached by
            Map<String, DependencyEdge> parent = new HashMap<>();
            Set<String> seen = new HashSet<>();
            seen.add(entry);
            Deque<Frontier> queue = new ArrayDeque<>();
            queue.add(new Frontier(entry, false));
            while (!queue.isEmpty()) {
                Frontier f = queue.poll();
                boolean isOrigin = f.id().equals(entry);
                for (DependencyEdge e : out.getOrDefault(f.id(), List.of())) {
                    boolean kafka = e.kind() == EdgeKind.KAFKA;
                    if (!isOrigin && !f.async() && kafka) {
                        continue;
                    }
                    if (seen.add(e.target())) {
                        parent.put(e.target(), e);
                        queue.add(new Frontier(e.target(), f.async() || kafka));
                    }
                }
            }
            // walk parents back from the target to the invoker, collecting the path edges
            String cur = target;
            while (parent.containsKey(cur)) {
                DependencyEdge e = parent.get(cur);
                collected.add(e.id());
                cur = e.source();
            }
        }
        return new ArrayList<>(collected);
    }

    /**
     * Everything a failure at {@code nodeId} would hurt: the transitive closure of its CALLERS,
     * walked over reversed edges (source→target = "source depends on target"). Includes the node
     * itself.
     */
    public static Set<String> blastRadius(String nodeId, Collection<DependencyEdge> edges) {
        Map<String, List<String>> inTo = new HashMap<>();
        for (DependencyEdge e : edges) {
            inTo.computeIfAbsent(e.target(), k -> new ArrayList<>()).add(e.source());
        }
        Set<String> seen = new LinkedHashSet<>();
        seen.add(nodeId);
        Deque<String> stack = new ArrayDeque<>();
        stack.push(nodeId);
        while (!stack.isEmpty()) {
            for (String caller : inTo.getOrDefault(stack.pop(), List.of())) {
                if (seen.add(caller)) {
                    stack.push(caller);
                }
            }
        }
        return seen;
    }

    /** Node ids within {@code maxDepth} undirected hops of {@code centerId}. */
    public static Set<String> withinDepth(String centerId, Collection<DependencyEdge> edges, int maxDepth) {
        Map<String, List<String>> adj = new HashMap<>();
        for (DependencyEdge e : edges) {
            adj.computeIfAbsent(e.source(), k -> new ArrayList<>()).add(e.target());
            adj.computeIfAbsent(e.target(), k -> new ArrayList<>()).add(e.source());
        }
        Map<String, Integer> depth = new HashMap<>();
        depth.put(centerId, 0);
        List<String> frontier = List.of(centerId);
        while (!frontier.isEmpty()) {
            List<String> next = new ArrayList<>();
            for (String id : frontier) {
                for (String nb : adj.getOrDefault(id, List.of())) {
                    if (!depth.containsKey(nb) && depth.get(id) < maxDepth) {
                        depth.put(nb, depth.get(id) + 1);
                        next.add(nb);
                    }
                }
            }
            frontier = next;
        }
        return depth.keySet();
    }
}
