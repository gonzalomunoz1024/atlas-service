package com.atlas.dashboard.topology.adapters.outbound;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.function.DoubleSupplier;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.topology.domain.NodeMetrics;
import com.atlas.dashboard.topology.domain.NodeMetrics.MetricPoint;
import com.atlas.dashboard.topology.ports.outbound.GrafanaPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

/** In-memory stand-in for Grafana time-series. */
@Component
@RequiredArgsConstructor
public class MockGrafanaAdapter implements GrafanaPort {

    private final Clock clock;

    @Override
    public Mono<NodeMetrics> metrics(String nodeId) {
        return Mono.fromSupplier(() -> {
            Random r = new Random((nodeId + ":metrics").hashCode());
            return new NodeMetrics(
                    nodeId,
                    series(r, 420, 260, false),
                    series(r, 0.8, 1.2, true),
                    series(r, 120, 90, true));
        });
    }

    private List<MetricPoint> series(Random r, double base, double jitter, boolean floorZero) {
        List<MetricPoint> pts = new ArrayList<>(30);
        for (int i = 0; i < 30; i++) {
            double value = base + (r.nextDouble() - 0.5) * jitter;
            DoubleSupplier v = () -> floorZero ? Math.max(0, value) : value;
            String ts = clock.instant().minus(Duration.ofMinutes(29L - i)).toString();
            pts.add(new MetricPoint(ts, round2(v.getAsDouble())));
        }
        return pts;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
