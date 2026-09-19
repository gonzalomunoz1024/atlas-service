package com.atlas.dashboard.actions.domain;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;

import com.atlas.dashboard.actions.domain.AlertPlan.AlertRule;
import com.atlas.dashboard.common.domain.EdgeObservation;

/**
 * Atlas's alert-derivation policy — one absence alert per logging-gap hop, an error-spike alert
 * on the service, and a latency guard at 2x the slowest hop's p95. Lives in domain so swapping
 * the alerting adapter can never erase the policy.
 */
public final class AlertRules {

    private AlertRules() {
    }

    public static List<AlertRule> derive(String serviceSlug, String traceId,
            Collection<EdgeObservation> observations) {
        List<EdgeObservation> observed = observations.stream()
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
                    "Logging gap regression: " + arrow(o.edgeId()),
                    "index=prod service=\"" + target + "\" traceId=* earliest=-15m | stats count"
                            + " | where count == 0",
                    "This hop carries live traffic but writes no logs (seen on " + traceId
                            + "). Fire while it stays silent so the gap can't regress unnoticed."));
        }

        rules.add(new AlertRule(
                "splunk",
                "Error spike: " + serviceSlug,
                "index=prod service=\"" + serviceSlug + "\" level=ERROR earliest=-15m"
                        + " | timechart span=5m count | where count > 25",
                "Errors on the service this trace flows through. Page before callers notice."));

        observed.stream()
                .max(Comparator.comparingInt(EdgeObservation::p95LatencyMs))
                .ifPresent(slowest -> rules.add(new AlertRule(
                        "sploc",
                        "Latency guard: " + arrow(slowest.edgeId()),
                        "p95(span.duration{edge=\"" + slowest.edgeId() + "\"}) > "
                                + slowest.p95LatencyMs() * 2 + "ms for 10m",
                        "The slowest hop on this path runs at p95 " + slowest.p95LatencyMs()
                                + "ms. Alert at 2x before it degrades the whole trace.")));
        return List.copyOf(rules);
    }

    /** Edge ids read as prose in rule names; queries keep the raw ASCII id. */
    private static String arrow(String edgeId) {
        return edgeId.replace("->", " \u2192 ");
    }
}
