package com.atlas.dashboard.topology.adapters.outbound;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Random;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.common.TopologyFixture;
import com.atlas.dashboard.topology.domain.ApiOperation;
import com.atlas.dashboard.topology.domain.ComponentGraph;
import com.atlas.dashboard.topology.domain.ComponentSummary;
import com.atlas.dashboard.topology.domain.EndpointFlow;
import com.atlas.dashboard.topology.domain.WikiDoc;
import com.atlas.dashboard.topology.domain.WikiDoc.WikiPage;
import com.atlas.dashboard.topology.domain.WikiDoc.WikiSection;
import com.atlas.dashboard.topology.ports.outbound.DeepWikiPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** In-memory stand-in for Devin/DeepWiki. Deterministic; no external calls. */
@Component
@RequiredArgsConstructor
public class MockDeepWikiAdapter implements DeepWikiPort {

    private static final List<String> LANGS =
            List.of("Java 21 · Spring WebFlux", "Kotlin · Ktor", "Go 1.22", "Node · NestJS");

    private final TopologyFixture fixture;
    private final Clock clock;

    @Override
    public Flux<ComponentSummary> search(String query) {
        String q = query.toLowerCase().trim();
        return Flux.fromIterable(TopologyFixture.ALL_COMPONENTS)
                .filter(name -> q.isEmpty() || name.toLowerCase().contains(q))
                .map(name -> {
                    TopologyFixture.NodeSpec s = fixture.spec(fixture.slug(name));
                    return new ComponentSummary(s.id(), s.name(), s.kind(), s.app(), fixture.isOwned(s.id()));
                });
    }

    @Override
    public Mono<ComponentGraph> graph(String component, String rev) {
        return Mono.fromSupplier(() -> new ComponentGraph(
                fixture.resolveCenter(component),
                fixture.nodes(component, rev),
                fixture.edges(component, rev)));
    }

    @Override
    public Mono<WikiDoc> wiki(String nodeId) {
        return Mono.fromSupplier(() -> buildWiki(nodeId));
    }

    @Override
    public Mono<com.atlas.dashboard.topology.domain.RepoRevisions> revisions(String component) {
        return Mono.fromSupplier(() -> fixture.revisions(component));
    }

    @Override
    public Mono<List<ApiOperation>> apiSpec(String nodeId) {
        return Mono.fromSupplier(() -> fixture.endpoints(nodeId).stream()
                .map(ep -> {
                    int sp = ep.indexOf(' ');
                    String method = sp > 0 ? ep.substring(0, sp) : "GET";
                    String path = sp > 0 ? ep.substring(sp + 1) : ep;
                    var doc = fixture.endpointDoc(nodeId, ep);
                    return new ApiOperation(method, path,
                            doc != null ? doc.summary() : "",
                            doc != null ? doc.requestBodyExample() : null);
                })
                .toList());
    }

    @Override
    public Mono<List<EndpointFlow>> endpoints(String nodeId) {
        // the request path from the original invoker into this node is shared by all its endpoints
        List<String> upstream = fixture.upstreamEdges(nodeId);
        return Mono.fromSupplier(() -> fixture.endpoints(nodeId).stream()
                .map(ep -> {
                    java.util.LinkedHashSet<String> edges = new java.util.LinkedHashSet<>(upstream);
                    edges.addAll(fixture.endpointDownstream(nodeId, ep));
                    java.util.LinkedHashSet<String> nodes = new java.util.LinkedHashSet<>();
                    nodes.add(nodeId);
                    for (String e : edges) {
                        int arrow = e.indexOf("->");
                        if (arrow >= 0) {
                            nodes.add(e.substring(0, arrow));
                            nodes.add(e.substring(arrow + 2));
                        }
                    }
                    return new EndpointFlow(ep, List.copyOf(nodes), List.copyOf(edges));
                })
                .toList());
    }

    private WikiDoc buildWiki(String nodeId) {
        Random r = new Random(nodeId.hashCode());
        String pretty = title(nodeId);
        String lang = LANGS.get(r.nextInt(LANGS.size()));
        String generatedAt = clock.instant().minus(Duration.ofDays(r.nextInt(6))).toString();
        String lower = pretty.toLowerCase();

        String endpointsBody = fixture.endpoints(nodeId).isEmpty()
                ? "No HTTP surface — this component is reached over Kafka / as a data store."
                : fixture.endpoints(nodeId).stream().map(e -> "• " + e).collect(java.util.stream.Collectors.joining("\n"));

        List<WikiPage> pages = List.of(
                new WikiPage("Overview",
                        pretty + " is a " + lang + " component in the Guardrails platform. This wiki was "
                                + "generated by Devin from the repository source, commit history and runtime traces.",
                        List.of(
                                new WikiSection("Purpose",
                                        "Owns the " + lower + " bounded context — policy evaluation, bundle "
                                                + "management and orchestration of OPA decisions."),
                                new WikiSection("Tech Stack",
                                        "Built with " + lang + ". Stateless and horizontally scaled behind the "
                                                + "service mesh; configuration via Spring profiles per environment."),
                                new WikiSection("Repository Layout",
                                        "adapters/{inbound,outbound} · application · domain · ports — a "
                                                + "vertical-slice hexagonal structure, one package per capability."))),
                new WikiPage("Architecture",
                        "How " + pretty + " is structured internally and how a request flows through it.",
                        List.of(
                                new WikiSection("Request Lifecycle",
                                        "1. Inbound adapter validates and maps the request\n"
                                                + "2. The use case joins policy state with the OPA decision\n"
                                                + "3. Outbound adapters call downstream stores and services\n"
                                                + "4. The response is assembled and traced end-to-end"),
                                new WikiSection("Concurrency Model",
                                        "Fully reactive (Project Reactor). No blocking calls on the event loop; "
                                                + "downstream I/O is non-blocking and back-pressured."))),
                new WikiPage("API Reference",
                        "HTTP endpoints " + pretty + " exposes, extracted from the routing layer.",
                        List.of(
                                new WikiSection("Endpoints", endpointsBody),
                                new WikiSection("Conventions",
                                        "JSON over HTTP/2. W3C traceparent propagated on every call. Errors use "
                                                + "RFC-7807 problem+json."))),
                new WikiPage("Data & Ownership",
                        "What state " + pretty + " owns and how it persists it.",
                        List.of(
                                new WikiSection("Owned Data",
                                        "Reads and writes policy bundles in BPE Mongo DB. Never writes to another "
                                                + "service’s store; policy decisions are delegated to OPA."),
                                new WikiSection("Consistency",
                                        "Bundle writes are idempotent and versioned; readers tolerate eventual "
                                                + "propagation across replicas."))),
                new WikiPage("Dependencies",
                        "Downstream components " + pretty + " calls at runtime.",
                        List.of(
                                new WikiSection("Downstream",
                                        "• BPE Mongo DB (Mongo) — policy bundle storage\n"
                                                + "• OPA Pod / Sandbox OPA (HTTP) — policy decisions\n"
                                                + "• Guardrails Client (HTTP) — evaluation chain\n"
                                                + "• lightspeed-events (Kafka) — inbound event stream"))),
                new WikiPage("Observability",
                        "Signals " + pretty + " emits and the known gaps.",
                        List.of(
                                new WikiSection("Telemetry",
                                        "Metrics to Grafana, traces to SPLOC, logs to Splunk — correlated by "
                                                + "trace id."),
                                new WikiSection("Known Gaps",
                                        "NOTE: the OPA policy-decision call path is missing structured logs — see "
                                                + "the Atlas missing-link finding and the suggested enhancement."))));

        return new WikiDoc(
                nodeId,
                pretty,
                "github.com/acme/" + nodeId,
                generatedAt,
                pages,
                List.of(lang.split(" · ")[0], "reactive", "owned by #guardrails"));
    }

    private static String title(String nodeId) {
        String[] parts = nodeId.split("-");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p.isEmpty()) {
                continue;
            }
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1)).append(' ');
        }
        return sb.toString().trim();
    }
}
