package com.atlas.dashboard.actions.application;

import java.util.List;

import org.springframework.stereotype.Service;

import com.atlas.dashboard.actions.domain.AlertManifests;
import com.atlas.dashboard.actions.domain.AlertPlan;
import com.atlas.dashboard.actions.domain.AlertRules;
import com.atlas.dashboard.actions.domain.EnhancementPlan;
import com.atlas.dashboard.actions.domain.GeneratedTest;
import com.atlas.dashboard.actions.domain.SafeguardOption;
import com.atlas.dashboard.actions.domain.SilentEdgeFinding;
import com.atlas.dashboard.actions.domain.TestType;
import com.atlas.dashboard.actions.ports.inbound.ActionsInboundPort;
import com.atlas.dashboard.actions.ports.outbound.HyperExecutePort;
import com.atlas.dashboard.actions.ports.outbound.RepoEnhancementPort;
import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.insights.ports.outbound.ObservabilityPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class ActionsUseCase implements ActionsInboundPort {

    private final HyperExecutePort hyperExecute;
    private final RepoEnhancementPort repoEnhancement;
    private final ObservabilityPort observability;

    @Override
    public Mono<GeneratedTest> testFromTrace(String traceId, String node, String endpoint, TestType type) {
        return hyperExecute.fromTrace(traceId, node, endpoint, type);
    }

    @Override
    public Mono<EnhancementPlan> enhancement(String component) {
        // the missing-logs rule is ours: an observed edge leaving this component with no logs
        String slug = slugOf(component);
        return observability.edgeObservations(component, null)
                .map(obs -> obs.values().stream()
                        .filter(o -> o.observed() && !o.hasLogs())
                        .map(EdgeObservation::edgeId)
                        .filter(id -> id.startsWith(slug + "->"))
                        .map(id -> id.substring(id.indexOf("->") + 2))
                        .toList())
                .flatMap(gaps -> repoEnhancement.plan(component, gaps));
    }

    @Override
    public Mono<EnhancementPlan> errorRateEnhancement(String component, String target) {
        // ground the plan in OUR measured windowed rate rather than the caller's say-so
        String slug = slugOf(component);
        String targetSlug = slugOf(target);
        return observability.windowedErrorRates(component, null, 15)
                .map(rates -> rates.getOrDefault(slug + "->" + targetSlug, 0.0) * 100.0)
                .flatMap(ratePct -> repoEnhancement.errorRatePlan(component, target, ratePct));
    }

    @Override
    public Mono<AlertPlan> alertsFromTrace(String component, String traceId) {
        // the alert policy and the manifest format are Atlas's domain rules; observations are
        // fetched through the port, so no mock swap can erase either
        String slug = slugOf(component);
        return observability.edgeObservations(component, null)
                .map(obs -> {
                    var rules = AlertRules.derive(slug, traceId, obs.values());
                    return new AlertPlan(
                            traceId,
                            rules.size() + " alert rules for the service " + traceId + " travels: "
                                    + "logging-gap regression, error spike, and a latency guard.",
                            AlertManifests.yaml(traceId, slug, rules),
                            rules);
                });
    }

    @Override
    public Mono<SilentEdgeFinding> silentEdgeFinding(String component, String sourceId, String targetId) {
        return repoEnhancement.silentEdgeFinding(component, sourceId, targetId);
    }

    @Override
    public Mono<List<SafeguardOption>> safeguardCatalog() {
        // testing kinds come from the TestType enum (available today); roadmap kinds are
        // declared here so the UI never hardcodes availability
        List<SafeguardOption> options = new java.util.ArrayList<>();
        for (TestType t : TestType.values()) {
            options.add(new SafeguardOption(t.json(), "testing", true));
        }
        options.add(new SafeguardOption("regression", "testing", false));
        options.add(new SafeguardOption("performance", "testing", false));
        options.add(new SafeguardOption("alerts", "observability", true));
        return Mono.just(List.copyOf(options));
    }

    private static String slugOf(String component) {
        return component.toLowerCase().trim().replaceAll("\\s+", "-");
    }
}
