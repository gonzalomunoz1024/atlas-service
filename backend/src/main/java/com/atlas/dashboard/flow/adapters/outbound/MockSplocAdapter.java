package com.atlas.dashboard.flow.adapters.outbound;

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

    private final TraceScaffold scaffold;
    private final TopologyFixture fixture;

    @Override
    public Flux<TraceSummary> recentTraces(String component, int limit) {
        Random r = new Random((fixture.slug(component) + ":traces").hashCode());
        return Flux.range(0, limit)
                .map(i -> {
                    String traceId = "trc-" + shortSlug(component) + "-"
                            + Integer.toHexString(1000 + r.nextInt(8999)) + i;
                    Built b = scaffold.build(traceId);
                    boolean hasGaps = b.spans().stream().anyMatch(s -> !s.shouldHaveLogs());
                    return new TraceSummary(
                            traceId,
                            entryServiceName(b.spans().get(0).nodeId()),
                            b.startedAt(),
                            b.durationMs(),
                            b.status(),
                            b.spans().size(),
                            hasGaps);
                })
                .sort((a, c) -> c.startedAt().compareTo(a.startedAt()));
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
