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
                    "@@",
                    " public Mono<Decision> decide(PolicyRequest req) {",
                    "+    log.info(\"opa.decide.start traceId={} subject={}\", tracer.currentTraceId(), req.subject());",
                    "     return opaWebClient.post()",
                    "         .uri(\"/v1/data/guardrails/allow\")",
                    "         .bodyValue(req)",
                    "         .retrieve()",
                    "         .bodyToMono(Decision.class)",
                    "+        .doOnNext(d -> log.info(\"opa.decide.ok traceId={} allow={}\", tracer.currentTraceId(), d.allow()))",
                    "+        .doOnError(e -> log.error(\"opa.decide.error traceId={}\", tracer.currentTraceId(), e));",
                    " }");
            return new EnhancementPlan(
                    component,
                    owned,
                    component + " → " + String.join(", ", gapTargets) + " is missing structured logs on "
                            + "the policy-decision path, so its decisions never reach Splunk. Add MDC "
                            + "trace-id logging and a latency alert.",
                    List.of(
                            "DeepWiki shows a live call edge to " + String.join(", ", gapTargets)
                                    + ", but Splunk has zero correlated log events for it.",
                            "Adding trace-id-scoped start/ok/error logs restores end-to-end policy-decision visibility.",
                            "A Grafana p95 alert closes the loop so regressions page the owning team."),
                    diff,
                    List.of(
                            "grafana: p95(opa.decide) > 400ms for 5m → page #guardrails-oncall",
                            "grafana: rate(opa.decide.error) > 2% for 10m → warn #guardrails-oncall"));
        });
    }
}
