package com.atlas.dashboard.flow.adapters.outbound;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Random;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.common.TopologyFixture;
import com.atlas.dashboard.flow.adapters.outbound.TraceScaffold.Built;
import com.atlas.dashboard.flow.domain.Span;
import com.atlas.dashboard.flow.domain.TraceDetail;
import com.atlas.dashboard.flow.domain.TraceSummary;
import com.atlas.dashboard.flow.ports.outbound.SplocPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class MockSplocAdapter implements SplocPort {

    /** Candidate pool per (component, rev) — a Splunk window cuts it down, never grows it. */
    private static final int POOL = 48;
    private static final long SEVEN_DAYS_MS = 7L * 24 * 3_600_000;

    private final TraceScaffold scaffold;
    private final TopologyFixture fixture;
    private final Clock clock;

    @Override
    public Flux<TraceSummary> recentTraces(String component, int limit, String rev, String earliest,
            String latest) {
        // traces are per-environment: each deployed revision has its own recent set.
        // Splunk semantics: the pool spans the last 7 days (cubed skew towards now, like real
        // traffic), and the earliest/latest window filters it server-side before the limit.
        Instant now = clock.instant();
        Instant from = SplunkTime.resolve(earliest, now, Instant.EPOCH);
        Instant to = SplunkTime.resolve(latest, now, now);
        Random r = new Random((fixture.slug(component) + ":traces" + (rev != null ? ":" + rev : "")).hashCode());
        List<TraceSummary> pool = new ArrayList<>(POOL);
        for (int i = 0; i < POOL; i++) {
            String traceId = "trc-" + shortSlug(component) + "-"
                    + Integer.toHexString(1000 + r.nextInt(8999)) + i;
            double u = r.nextDouble();
            Instant startedAt = now.minusMillis((long) (u * u * u * SEVEN_DAYS_MS));
            Built b = scaffold.build(traceId);
            boolean hasGaps = b.spans().stream().anyMatch(s -> !s.shouldHaveLogs());
            pool.add(new TraceSummary(
                    traceId,
                    entryServiceName(b.spans().get(0).nodeId()),
                    b.spans().get(0).nodeId(),
                    startedAt.toString(),
                    b.durationMs(),
                    b.status(),
                    b.spans().size(),
                    hasGaps));
        }
        return Flux.fromIterable(pool.stream()
                .filter(t -> {
                    Instant s = Instant.parse(t.startedAt());
                    return !s.isBefore(from) && !s.isAfter(to);
                })
                .sorted(Comparator.comparing(TraceSummary::startedAt).reversed())
                .limit(limit)
                .toList());
    }

    @Override
    public Mono<TraceDetail> spans(String traceId) {
        return Mono.fromSupplier(() -> {
            Built b = scaffold.build(traceId);
            List<Span> spans = b.spans().stream()
                    .map(s -> new Span(
                            s.spanId(),
                            s.parentSpanId(),
                            s.nodeId(),
                            s.nodeId(),
                            s.op(),
                            s.startOffsetMs(),
                            s.durationMs(),
                            s.status(),
                            s.shouldHaveLogs(),
                            List.of()))
                    .toList();
            return new TraceDetail(b.traceId(), b.startedAt(), b.durationMs(), b.status(), spans);
        });
    }

    private String shortSlug(String component) {
        String s = fixture.slug(component);
        return s.length() <= 4 ? s : s.substring(0, 4);
    }

    /** Resolve the entry span's node id to its human-readable service name for display. */
    private String entryServiceName(String nodeId) {
        var spec = fixture.spec(nodeId);
        return spec != null ? spec.name() : nodeId;
    }
}
