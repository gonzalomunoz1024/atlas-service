package com.atlas.dashboard.actions.adapters.outbound;

import java.util.List;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.SilentEdgeFinding;
import com.atlas.dashboard.actions.ports.outbound.RepoEnhancementPort;
import com.atlas.dashboard.common.TopologyFixture;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class MockRepoEnhancementAdapter implements RepoEnhancementPort {

    private final TopologyFixture fixture;

    @Override
    public Mono<EnhancementPlan> plan(String component, List<String> gapIds) {
        return Mono.fromSupplier(() -> {
            String slug = fixture.slug(component);
            boolean owned = fixture.isOwned(slug);

            List<String> gapTargets = gapIds.stream()
                    .map(id -> {
                        var spec = fixture.spec(id);
                        return spec != null ? spec.name() : id;
                    })
                    .toList();

            if (gapIds.isEmpty()) {
                return new EnhancementPlan(
                        component,
                        owned,
                        "No logging gaps detected. Every live call edge leaving " + component
                                + " already lands in Splunk.",
                        List.of("All observed outbound edges have correlated log events."),
                        "",
                        List.of());
            }

            // Two repositories, one fix: the caller propagates the trace id and logs the round
            // trip; the receiving service logs the same id on arrival. Both hunks are needed —
            // caller-side logs alone can never prove the receiver saw the call.
            String receiver = gapIds.get(0);
            String diff = String.join("\n",
                    "# caller · github.com/acme/" + slug,
                    "--- a/src/main/java/com/acme/" + slug + "/OpaPolicyClient.java",
                    "+++ b/src/main/java/com/acme/" + slug + "/OpaPolicyClient.java",
                    "@@ propagate the trace id in the request headers and log the round trip",
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
                    "# receiver · github.com/acme/" + receiver,
                    "--- a/src/main/java/com/acme/" + receiver + "/TraceLogFilter.java",
                    "+++ b/src/main/java/com/acme/" + receiver + "/TraceLogFilter.java",
                    "@@ log the propagated trace id on every arriving request",
                    "+@Component",
                    "+public class TraceLogFilter implements WebFilter {",
                    "+    public Mono<Void> filter(ServerWebExchange ex, WebFilterChain chain) {",
                    "+        String traceId = TraceContext.from(ex.getRequest().getHeaders().getFirst(\"traceparent\"));",
                    "+        log.info(\"request.received traceId={} path={}\", traceId, ex.getRequest().getPath());",
                    "+        return chain.filter(ex);",
                    "+    }",
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
                                    + "the caller and the receiver makes every call correlate in Splunk. That is the "
                                    + "same evidence Atlas uses to mark a link healthy.",
                            "Once both sides log the id, this edge flips from amber to a solid grey hairline."),
                    diff,
                    // no alerts here — the fix stays grounded on adding the logging that makes
                    // the link traceable; alert rules are their own action (AlertingPort)
                    List.of());
        });
    }

    @Override
    public Mono<EnhancementPlan> errorRatePlan(String component, String target) {
        return Mono.fromSupplier(() -> {
            String slug = fixture.slug(component);
            String targetSlug = fixture.slug(target);
            var targetSpec = fixture.spec(targetSlug);
            String targetName = targetSpec != null ? targetSpec.name() : target;
            boolean owned = fixture.isOwned(slug);
            String diff = String.join("\n",
                    "# caller · github.com/acme/" + slug,
                    "--- a/src/main/java/com/acme/" + slug + "/DownstreamClient.java",
                    "+++ b/src/main/java/com/acme/" + slug + "/DownstreamClient.java",
                    "@@ bound the failure: retry transient errors, cap the wait",
                    " return webClient.post()",
                    "     .retrieve()",
                    "     .bodyToMono(Response.class)",
                    "+    .retryWhen(Retry.backoff(3, Duration.ofMillis(120))",
                    "+        .filter(TransientException.class::isInstance))",
                    "+    .timeout(Duration.ofSeconds(2))");
            return new EnhancementPlan(
                    component,
                    owned,
                    component + " → " + targetName + " is erroring above the configured threshold. "
                            + "Bound the failure with retry + timeout on the caller, and alert on the "
                            + "sustained rate so regressions page the owning team.",
                    List.of(
                            "Add bounded retry with backoff and a hard timeout on the call to " + targetName + ".",
                            "Alert on the sustained error rate so regressions page the owning team.",
                            "Use the traces tab to find the failing requests and their logs."),
                    diff,
                    List.of("grafana: rate(" + slug + " → " + targetSlug + " errors) > threshold for 5m → page owning team"));
        });
    }

    @Override
    public Mono<SilentEdgeFinding> silentEdgeFinding(String component, String sourceId, String targetId) {
        return Mono.fromSupplier(() -> {
            String source = name(sourceId);
            String target = name(targetId);
            return new SilentEdgeFinding(
                    "DeepWiki documents this dependency, yet SPLOC recorded zero calls across it in"
                            + " the live window. Either the calls aren't instrumented, or the code"
                            + " path is stale.",
                    List.of(
                            new SilentEdgeFinding.Item("Observability gap",
                                    "The calls happen, but " + source + " isn't propagating trace"
                                            + " context on this path, so SPLOC never sees them."),
                            new SilentEdgeFinding.Item("Stale code",
                                    "The dependency exists in the repository but the path is never"
                                            + " exercised anymore; the code (and the coupling) may"
                                            + " be removable.")),
                    List.of(
                            "Verify tracing instrumentation on " + source + "'s outbound client for "
                                    + target + ".",
                            "Run a synthetic through the path. If it appears on the map, it was an"
                                    + " instrumentation gap.",
                            "If genuinely unused, remove the dependency and let the next DeepWiki"
                                    + " run clear the edge."));
        });
    }

    private String name(String nodeId) {
        var spec = fixture.spec(nodeId);
        return spec != null ? spec.name() : nodeId;
    }
}
