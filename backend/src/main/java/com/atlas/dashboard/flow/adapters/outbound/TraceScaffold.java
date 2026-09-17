package com.atlas.dashboard.flow.adapters.outbound;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.common.domain.CallStatus;

import lombok.RequiredArgsConstructor;

/**
 * Deterministic span skeleton for a trace, shared by the SPLOC (spans) and Splunk (logs) mock
 * adapters so their views correlate. Spans on the pricing-service and stripe-api hops deliberately
 * lack logs, mirroring the missing-link edges.
 */
@Component
@RequiredArgsConstructor
public class TraceScaffold {

    private static final Map<String, String> OPS = Map.ofEntries(
            Map.entry("vmforge", "POST /guardrails/evaluate"),
            Map.entry("lightspeed", "emit GuardrailsEvaluationRequestedEvent"),
            Map.entry("guardrails-client", "invoke policy client"),
            Map.entry("bpe-mongo", "find policy bundle"),
            Map.entry("guardrails-orchestrator", "orchestrate decision"),
            Map.entry("opa-pod", "POST /v1/data (decision)"),
            Map.entry("guardrails-registry", "lookup policy"),
            Map.entry("opa-sandbox", "sandbox eval"));

    private final Clock clock;

    public record SpanSkeleton(
            String spanId,
            String parentSpanId,
            String nodeId,
            String op,
            int startOffsetMs,
            int durationMs,
            CallStatus status,
            boolean shouldHaveLogs) {
    }

    public record Built(String traceId, String startedAt, int durationMs, CallStatus status, List<SpanSkeleton> spans) {
    }

    public Built build(String traceId) {
        Random r = new Random(traceId.hashCode());
        // Traffic reaches the platform from more than one entry point: VMForge calls in over HTTP,
        // while Lightspeed drives evaluations via the event stream. Vary the trace's source.
        String entry = r.nextBoolean() ? "vmforge" : "lightspeed";
        List<String> path = List.of(entry, "guardrails-client", "bpe-mongo",
                "guardrails-orchestrator", "opa-pod", "guardrails-registry", "opa-sandbox");
        boolean errored = r.nextDouble() > 0.82;
        String startedAt = clock.instant().minusMillis((long) (r.nextDouble() * 3_600_000)).toString();

        List<SpanSkeleton> spans = new ArrayList<>();
        int offset = 0;
        for (int i = 0; i < path.size(); i++) {
            String nodeId = path.get(i);
            int dur = 8 + r.nextInt(nodeId.startsWith("opa") ? 300 : 120);
            int start = offset;
            offset += (int) (dur * (0.3 + r.nextDouble() * 0.5));
            boolean shouldHaveLogs = !nodeId.startsWith("opa");
            CallStatus status = errored && i == path.size() - 1 ? CallStatus.ERROR : CallStatus.OK;
            spans.add(new SpanSkeleton(
                    traceId + "-s" + i,
                    i == 0 ? null : traceId + "-s" + (i - 1),
                    nodeId,
                    OPS.getOrDefault(nodeId, "handle"),
                    start,
                    dur,
                    status,
                    shouldHaveLogs));
        }
        return new Built(traceId, startedAt, offset + 40, errored ? CallStatus.ERROR : CallStatus.OK, spans);
    }

    public String op(String nodeId) {
        return OPS.getOrDefault(nodeId, "handle");
    }

    public String logTimestamp(String startedAt, int offsetMs) {
        return java.time.Instant.parse(startedAt).plus(Duration.ofMillis(offsetMs)).toString();
    }
}
