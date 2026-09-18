package com.atlas.dashboard.flow.application;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.atlas.dashboard.common.domain.CallStatus;
import com.atlas.dashboard.common.domain.DependencyEdge;
import com.atlas.dashboard.common.domain.EdgeKind;
import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.common.domain.TopologyRules;
import com.atlas.dashboard.flow.domain.FlowEvent;
import com.atlas.dashboard.flow.domain.FlowRoute;
import com.atlas.dashboard.flow.domain.Span;
import com.atlas.dashboard.flow.domain.TraceDetail;
import com.atlas.dashboard.flow.domain.TraceSummary;
import com.atlas.dashboard.flow.ports.inbound.FlowInboundPort;
import com.atlas.dashboard.flow.ports.outbound.FlowTopologyPort;
import com.atlas.dashboard.flow.ports.outbound.SplocPort;
import com.atlas.dashboard.flow.ports.outbound.SplunkPort;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class FlowUseCase implements FlowInboundPort {

    private final SplocPort sploc;
    private final SplunkPort splunk;
    private final FlowTopologyPort topology;
    private final Clock clock;
    private final Duration emitInterval;
    private final AtomicLong seq = new AtomicLong();

    public FlowUseCase(SplocPort sploc, SplunkPort splunk, FlowTopologyPort topology, Clock clock,
            @Value("${atlas.flow.emit-interval-ms:900}") long emitIntervalMs) {
        this.sploc = sploc;
        this.splunk = splunk;
        this.topology = topology;
        this.clock = clock;
        this.emitInterval = Duration.ofMillis(emitIntervalMs);
    }

    @Override
    public Flux<TraceSummary> recentTraces(String component, int limit, String rev, String earliest, String latest) {
        return sploc.recentTraces(component, Math.max(1, Math.min(limit, 50)), rev, earliest, latest);
    }

    @Override
    public Mono<TraceDetail> trace(String traceId) {
        return Mono.zip(sploc.spans(traceId), splunk.logsBySpan(traceId))
                .map(t -> {
                    TraceDetail skeleton = t.getT1();
                    var logsBySpan = t.getT2();
                    List<Span> merged = skeleton.spans().stream()
                            .map(s -> s.withLogs(logsBySpan.getOrDefault(s.spanId(), List.of())))
                            .toList();
                    return new TraceDetail(skeleton.traceId(), skeleton.startedAt(),
                            skeleton.durationMs(), skeleton.status(), merged);
                });
    }

    @Override
    public Flux<FlowEvent> liveFlow(String component, String rev) {
        // Real flows walked from our own topology data — each route follows actual observed edges
        // out of an entry point, honouring channel semantics (a synchronous request never spills
        // onto the Kafka event bus), so e.g. a VMForge flow never reaches Kafka or Lightspeed.
        List<Route> routes = buildRoutes(component, rev);
        if (routes.isEmpty()) {
            return Flux.empty();
        }
        Map<String, EdgeObservation> obs = topology.edgeObservations(component, rev);
        int[] cursor = new int[routes.size()];

        // round-robin the routes each tick, advancing each route's own cursor, so several real
        // flows progress concurrently and hop-by-hop in order.
        return Flux.interval(Duration.ZERO, emitInterval)
                .map(tick -> {
                    long n = seq.incrementAndGet();
                    Route route = routes.get((int) (tick % routes.size()));
                    int ri = routes.indexOf(route);
                    DependencyEdge hop = route.hops().get(cursor[ri] % route.hops().size());
                    long pass = cursor[ri] / route.hops().size();
                    cursor[ri]++;
                    EdgeObservation ob = obs.get(hop.id());
                    java.util.Random r = new java.util.Random(n * 31 + component.hashCode());
                    double errRate = ob != null ? ob.errorRate() : 0.0;
                    int p95 = ob != null ? ob.p95LatencyMs() : 40;
                    boolean error = r.nextDouble() < errRate + 0.02;
                    int latency = Math.max(4, (int) (p95 * (0.4 + r.nextDouble())));
                    String traceId = "trc-live-" + route.origin() + "-" + pass;
                    return new FlowEvent(
                            "flw-" + n,
                            traceId,
                            route.origin(),
                            hop.source(),
                            hop.target(),
                            endpointFor(hop, traceId),
                            hop.kind(),
                            error ? CallStatus.ERROR : CallStatus.OK,
                            latency,
                            clock.instant().toString());
                });
    }

    @Override
    public List<FlowRoute> flows(String component, String rev) {
        // The membership rule lives here (server-side, derived from topology + observations), so
        // the UI can dim everything outside a selected flow without re-implementing the rule.
        return buildRoutes(component, rev).stream()
                .map(route -> {
                    LinkedHashSet<String> nodes = new LinkedHashSet<>();
                    List<String> edgeIds = new ArrayList<>();
                    nodes.add(route.origin());
                    for (DependencyEdge hop : route.hops()) {
                        nodes.add(hop.source());
                        nodes.add(hop.target());
                        edgeIds.add(hop.id());
                    }
                    return new FlowRoute(route.origin(), List.copyOf(nodes), edgeIds);
                })
                .toList();
    }

    /** The REST endpoint an HTTP hop lands on at its target; stable per (trace, target). */
    private String endpointFor(DependencyEdge hop, String traceId) {
        if (hop.kind() != EdgeKind.HTTP) {
            return null;
        }
        List<String> endpoints = topology.endpoints(hop.target());
        if (endpoints.isEmpty()) {
            return null;
        }
        int idx = Math.floorMod((traceId + hop.target()).hashCode(), endpoints.size());
        return endpoints.get(idx);
    }

    /** A coherent flow: an ordered list of real edges leaving one entry point. */
    private record Route(String origin, List<DependencyEdge> hops) {
    }

    /** Build one route per entry point, over observed edges, honouring channel semantics. */
    private List<Route> buildRoutes(String component, String rev) {
        List<DependencyEdge> edges = topology.edges(component, rev);
        Set<String> observed = topology.edgeObservations(component, rev).values().stream()
                .filter(EdgeObservation::observed)
                .map(EdgeObservation::edgeId)
                .collect(java.util.stream.Collectors.toSet());
        Map<String, List<DependencyEdge>> out = new LinkedHashMap<>();
        for (DependencyEdge e : edges) {
            if (observed.contains(e.id())) {
                out.computeIfAbsent(e.source(), k -> new ArrayList<>()).add(e);
            }
        }
        List<Route> routes = new ArrayList<>();
        for (String entry : TopologyRules.entryPoints(edges, topology.serviceIds(component, rev))) {
            List<DependencyEdge> hops = channelWalk(entry, out);
            if (!hops.isEmpty()) {
                routes.add(new Route(entry, hops));
            }
        }
        return routes;
    }

    /** Breadth-first walk from an entry; a synchronous arrival never follows a Kafka publish. */
    private List<DependencyEdge> channelWalk(String entry, Map<String, List<DependencyEdge>> out) {
        List<DependencyEdge> ordered = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        seen.add(entry);
        record Frontier(String id, boolean async) {
        }
        List<Frontier> frontier = new ArrayList<>(List.of(new Frontier(entry, false)));
        boolean origin = true;
        while (!frontier.isEmpty()) {
            List<Frontier> next = new ArrayList<>();
            for (Frontier f : frontier) {
                for (DependencyEdge e : out.getOrDefault(f.id(), List.of())) {
                    boolean kafka = e.kind() == EdgeKind.KAFKA;
                    if (!origin && !f.async() && kafka) {
                        continue; // sync request must not fan out onto the event bus
                    }
                    ordered.add(e);
                    if (seen.add(e.target())) {
                        next.add(new Frontier(e.target(), f.async() || kafka));
                    }
                }
            }
            frontier = next;
            origin = false;
        }
        return ordered;
    }
}
