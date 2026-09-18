package com.atlas.dashboard.actions.adapters.outbound;

import java.util.List;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.ports.outbound.RepoEnhancementPort;
import com.atlas.dashboard.common.TopologyFixture;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class MockRepoEnhancementAdapter implements RepoEnhancementPort {

    private final TopologyFixture fixture;

    @Override
    public Mono<EnhancementPlan> plan(String component) {
        return Mono.fromSupplier(() -> {
            String slug = fixture.slug(component);
            boolean owned = fixture.isOwned(slug);

            // stay consistent with the map: only propose a fix when this component actually has
            // an outgoing live edge with no logs (the amber dashes in the graph)
            List<String> gapTargets = fixture.edgeObservations(component).values().stream()
                    .filter(o -> o.observed() && !o.hasLogs())
                    .map(o -> o.edgeId())
                    .filter(id -> id.startsWith(slug + "->"))
                    .map(id -> {
                        String target = id.substring(id.indexOf("->") + 2);
                        var spec = fixture.spec(target);
                        return spec != null ? spec.name() : target;
                    })
                    .toList();

            if (gapTargets.isEmpty()) {
                return new EnhancementPlan(
                        component,
                        owned,
                        "No logging gaps detected — every live call edge leaving " + component
                                + " already lands in Splunk.",
                        List.of("All observed outbound edges have correlated log events."),
                        "",
                        List.of());
            }

            String diff = String.join("\n",
                    "--- a/src/main/java/com/acme/" + slug + "/OpaPolicyClient.java",
                    "+++ b/src/main/java/com/acme/" + slug + "/OpaPolicyClient.java",
                    "@@ caller: propagate the trace id in the headers and log it",
                    " public Mono<Decision> decide(PolicyRequest req) {",
                    "+    String traceparent = tracer.currentTraceparent();",
                    "+    log.info(\"opa.decide.request traceId={} subject={}\", tracer.currentTraceId(), req.subject());",
                    "     return opaWebClient.post()",
                    "         .uri(\"/v1/data/guardrails/allow\")",
                    "+        .header(\"traceparent\", traceparent)",
                    "         .bodyValue(req)",
                    "         .retrieve()",
                    "         .bodyToMono(Decision.class)",
                    "+        .doOnNext(d -> log.info(\"opa.decide.response traceId={} allow={}\", tracer.currentTraceId(), d.allow()));",
                    " }",
                    "",
                    "--- a/receiver: log the propagated trace id on arrival",
                    "+++ b/src/main/java/.../TraceLogFilter.java",
                    "@@ receiver: read traceparent from the headers and log it",
                    "+public Mono<Void> filter(ServerWebExchange ex, WebFilterChain chain) {",
                    "+    String traceId = TraceContext.from(ex.getRequest().getHeaders().getFirst(\"traceparent\"));",
                    "+    log.info(\"request.received traceId={} path={}\", traceId, ex.getRequest().getPath());",
                    "+    return chain.filter(ex);",
                    "+}");
            return new EnhancementPlan(
                    component,
                    owned,
                    component + " → " + String.join(", ", gapTargets) + " is missing structured logs on "
                            + "the policy-decision path. Propagate the trace id in the request headers and "
                            + "log it on both sides, so the same id shows up in both services' logs.",
                    List.of(
                            "DeepWiki shows a live call edge to " + String.join(", ", gapTargets)
                                    + ", but Splunk has zero correlated log events for it.",
                            "Carrying the trace id in the headers (W3C traceparent) and logging it on both "
                                    + "the caller and the receiver makes every call correlate in Splunk — the "
                                    + "same evidence Atlas uses to mark a link healthy.",
                            "Once both sides log the id, this edge flips from amber to a solid grey hairline."),
                    diff,
                    List.of(
                            "grafana: p95(opa.decide) > 400ms for 5m → page #guardrails-oncall",
                            "grafana: rate(opa.decide.error) > 2% for 10m → warn #guardrails-oncall"));
        });
    }
}
