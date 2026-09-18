package com.atlas.dashboard.actions.adapters.outbound;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.actions.domain.AlertPlan;
import com.atlas.dashboard.actions.domain.AlertPlan.AlertRule;
import com.atlas.dashboard.actions.ports.outbound.AlertingPort;
import com.atlas.dashboard.common.TopologyFixture;
import com.atlas.dashboard.common.domain.EdgeObservation;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class MockAlertingAdapter implements AlertingPort {

    private final TopologyFixture fixture;

    @Override
    public Mono<AlertPlan> planFromTrace(String component, String traceId) {
        // Rules are derived from the component's observed topology, not canned: one absence
        // alert per logging-gap hop, an error-spike alert on the service itself, and a latency
        // guard on the slowest observed hop.
        return Mono.fromSupplier(() -> {
            String slug = fixture.slug(component);
            List<EdgeObservation> observed = fixture.edgeObservations(component).values().stream()
                    .filter(EdgeObservation::observed)
                    .toList();
            List<AlertRule> rules = new ArrayList<>();

            for (EdgeObservation o : observed) {
                if (o.hasLogs()) {
                    continue;
                }
                String target = o.edgeId().substring(o.edgeId().indexOf("->") + 2);
                rules.add(new AlertRule(
                        "splunk",
                        "Logging gap regression: " + o.edgeId(),
                        "index=prod service=\"" + target + "\" traceId=* earliest=-15m | stats count"
                                + " | where count == 0",
                        "This hop carries live traffic but writes no logs (seen on " + traceId
                                + "). Fire while it stays silent so the gap can't regress unnoticed."));
            }

            rules.add(new AlertRule(
                    "splunk",
                    "Error spike: " + slug,
                    "index=prod service=\"" + slug + "\" level=ERROR earliest=-15m"
                            + " | timechart span=5m count | where count > 25",
                    "Errors on the service this trace flows through — page before callers notice."));

            observed.stream()
                    .max(Comparator.comparingInt(EdgeObservation::p95LatencyMs))
                    .ifPresent(slowest -> rules.add(new AlertRule(
                            "sploc",
                            "Latency guard: " + slowest.edgeId(),
                            "p95(span.duration{edge=\"" + slowest.edgeId() + "\"}) > "
                                    + slowest.p95LatencyMs() * 2 + "ms for 10m",
                            "The slowest hop on this path runs at p95 " + slowest.p95LatencyMs()
                                    + "ms — alert at 2× before it degrades the whole trace.")));

            return new AlertPlan(
                    traceId,
                    rules.size() + " alert rules derived from " + traceId + "'s call path — "
                            + "logging-gap regression, error spike, and a latency guard.",
                    List.copyOf(rules));
        });
    }
}
