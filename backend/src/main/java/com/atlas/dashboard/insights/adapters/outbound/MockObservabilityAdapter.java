package com.atlas.dashboard.insights.adapters.outbound;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Random;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.common.TopologyFixture;
import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.insights.ports.outbound.ObservabilityPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

/** Reads the shared fixture so observability stays consistent with the topology view. */
@Component
@RequiredArgsConstructor
public class MockObservabilityAdapter implements ObservabilityPort {

    private final TopologyFixture fixture;
    private final Clock clock;

    @Override
    public Mono<Map<String, EdgeObservation>> edgeObservations(String component, String rev) {
        return Mono.fromSupplier(() -> fixture.edgeObservations(component, rev));
    }

    @Override
    public Mono<Map<String, Double>> windowedErrorRates(String component, String rev, int windowMin) {
        // Windowed rates drift around each edge's base rate: deterministic per 2-minute bucket
        // (so repeated polls agree), noisier for short windows, with the occasional transient
        // spike — the behaviour a real SPLOC/Grafana rate query would show.
        return Mono.fromSupplier(() -> {
            long bucket = clock.instant().getEpochSecond() / 120;
            double jitter = Math.sqrt(15.0 / Math.max(1, windowMin));
            Map<String, Double> rates = new LinkedHashMap<>();
            for (EdgeObservation o : fixture.edgeObservations(component, rev).values()) {
                if (!o.observed()) {
                    continue;
                }
                Random r = new Random(Objects.hash(o.edgeId(), rev, windowMin, bucket));
                double rate = o.errorRate() * (1 + (r.nextDouble() - 0.5) * 0.8 * jitter);
                if (r.nextDouble() < 0.05 * jitter) {
                    rate += 0.08 + r.nextDouble() * 0.1;
                }
                rates.put(o.edgeId(), Math.min(1.0, Math.max(0.0, rate)));
            }
            return rates;
        });
    }
}
