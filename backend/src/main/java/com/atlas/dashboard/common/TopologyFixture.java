package com.atlas.dashboard.common;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.common.domain.ComponentNode;
import com.atlas.dashboard.common.domain.DependencyEdge;
import com.atlas.dashboard.common.domain.EdgeKind;
import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.common.domain.LogEvidence;
import com.atlas.dashboard.common.domain.Health;
import com.atlas.dashboard.common.domain.NodeKind;

/**
 * The Guardrails platform dependency map — a single fixed ecosystem, re-focused on whichever
 * component is searched. This is the in-memory source of truth the mock outbound adapters
 * (DeepWiki, SPLOC, Splunk, Grafana) all read from, so their views stay consistent. Mirrors the
 * frontend {@code demo.ts} fixtures.
 *
 * <p>Ownership is by application id: our app is {@link #OUR_APP} (TAP); components under other app
 * ids (CLAUT, BPE) are external. The two Kafka topics share one {@code cluster}.
 */
@Component
public class TopologyFixture {

    public record NodeSpec(String id, String name, NodeKind kind, String app, String cluster) {
    }

    /** Our application id — components under it are "owned" and can be enhanced. */
    private static final String OUR_APP = "TAP";
    private static final String DEFAULT_CENTER = "guardrails-orchestrator";
    private static final String KAFKA_CLUSTER = "bpe-events";


    /** Searchable components (the services, not the infra/topic nodes). */
    public static final List<String> ALL_COMPONENTS = List.of(
            "Guardrails Orchestrator", "Guardrails Client", "Guardrails Registry",
            "Guardrails Studio", "Lightspeed Platform Service", "VMForge");

    private static final List<NodeSpec> NODES = List.of(
            new NodeSpec("guardrails-orchestrator", "Guardrails Orchestrator", NodeKind.SERVICE, "TAP", null),
            new NodeSpec("guardrails-client", "Guardrails Client", NodeKind.SERVICE, "TAP", null),
            new NodeSpec("guardrails-registry", "Guardrails Registry", NodeKind.SERVICE, "TAP", null),
            new NodeSpec("guardrails-studio", "Guardrails Studio", NodeKind.SERVICE, "TAP", null),
            new NodeSpec("opa-pod", "OPA Pod", NodeKind.SERVICE, "TAP", null),
            new NodeSpec("opa-sandbox", "Sandbox OPA", NodeKind.SERVICE, "TAP", null),
            new NodeSpec("vmforge", "VMForge", NodeKind.SERVICE, "CLAUT", null),
            new NodeSpec("lightspeed", "Lightspeed Platform Service", NodeKind.SERVICE, "BPE", null),
            new NodeSpec("bpe-mongo", "BPE Mongo DB", NodeKind.MONGO, "BPE", null),
            new NodeSpec("evt-request", "GuardrailsEvaluationRequestedEvent", NodeKind.KAFKA, "BPE", KAFKA_CLUSTER),
            new NodeSpec("evt-response", "GuardrailsEvaluationResponseEvent", NodeKind.KAFKA, "BPE", KAFKA_CLUSTER));

    private static final List<DependencyEdge> EDGES = List.of(
            DependencyEdge.of("guardrails-client", "guardrails-orchestrator", EdgeKind.HTTP),
            DependencyEdge.of("guardrails-orchestrator", "bpe-mongo", EdgeKind.MONGO),
            DependencyEdge.of("guardrails-orchestrator", "opa-pod", EdgeKind.HTTP),
            DependencyEdge.of("lightspeed", "evt-request", EdgeKind.KAFKA),
            DependencyEdge.of("evt-request", "guardrails-client", EdgeKind.KAFKA),
            DependencyEdge.of("guardrails-client", "evt-response", EdgeKind.KAFKA),
            DependencyEdge.of("evt-response", "lightspeed", EdgeKind.KAFKA),
            DependencyEdge.of("guardrails-client", "bpe-mongo", EdgeKind.MONGO),
            DependencyEdge.of("guardrails-registry", "bpe-mongo", EdgeKind.MONGO),
            DependencyEdge.of("guardrails-studio", "guardrails-registry", EdgeKind.HTTP),
            DependencyEdge.of("guardrails-registry", "opa-sandbox", EdgeKind.HTTP),
            DependencyEdge.of("vmforge", "guardrails-client", EdgeKind.HTTP));

    /** Live call paths that reach a target but emit no logs — the missing-link story (OPA policy calls). */
    private static final Set<String> MISSING_LOG_EDGES =
            Set.of("guardrails-orchestrator->opa-pod", "guardrails-registry->opa-sandbox");
    /** Mapped but with no observed traffic. */
    private static final Set<String> SILENT_EDGES = Set.of("guardrails-studio->guardrails-registry");

    // --- per-revision topology: dev introduced an S3 dependency not yet in test/prod ---
    private static final String S3_COMMIT = "a1b2c3d"; // the dev environment's commit
    private static final NodeSpec S3_NODE =
            new NodeSpec("s3-bucket", "S3", NodeKind.EXTERNAL, "AWS", null);
    private static final DependencyEdge S3_EDGE =
            DependencyEdge.of("guardrails-orchestrator", "s3-bucket", EdgeKind.HTTP);

    /** The S3 dependency exists only in the dev revision (its commit). */
    private boolean hasS3(String rev) {
        return S3_COMMIT.equals(rev);
    }

    private List<NodeSpec> nodeSpecsFor(String rev) {
        if (!hasS3(rev)) {
            return NODES;
        }
        List<NodeSpec> out = new ArrayList<>(NODES);
        out.add(S3_NODE);
        return out;
    }

    private List<DependencyEdge> edgesFor(String rev) {
        if (!hasS3(rev)) {
            return EDGES;
        }
        List<DependencyEdge> out = new ArrayList<>(EDGES);
        out.add(S3_EDGE);
        return out;
    }

    public String slug(String name) {
        return name == null ? "" : name.toLowerCase().trim().replaceAll("\\s+", "-");
    }

    /** Resolve the searched name to a node id, defaulting to the platform's hub service. */
    public String resolveCenter(String center) {
        String s = slug(center);
        return NODES.stream().anyMatch(n -> n.id().equals(s)) ? s : DEFAULT_CENTER;
    }

    private Random rng(String seed) {
        return new Random(seed.hashCode() * 2654435761L);
    }

    public List<ComponentNode> nodes(String center) {
        return nodes(center, null);
    }

    public List<ComponentNode> nodes(String center, String rev) {
        String c = resolveCenter(center);
        List<ComponentNode> out = new ArrayList<>();
        for (NodeSpec s : nodeSpecsFor(rev)) {
            boolean owned = OUR_APP.equals(s.app());
            if (s.id().equals(c)) {
                out.add(new ComponentNode(s.id(), s.name(), s.kind(), s.app(), s.cluster(), owned, Health.HEALTHY, true));
            } else {
                out.add(ComponentNode.of(s.id(), s.name(), s.kind(), s.app(), s.cluster(), owned,
                        health(rng(s.id() + ":health"))));
            }
        }
        return out;
    }

    public List<DependencyEdge> edges(String center) {
        return edges(center, null);
    }

    public List<DependencyEdge> edges(String center, String rev) {
        return edgesFor(rev);
    }

    public NodeSpec spec(String nodeId) {
        return NODES.stream().filter(n -> n.id().equals(nodeId)).findFirst().orElse(null);
    }

    /**
     * Deployed environments and recent commits for a repository. Prod is the default view; a commit
     * not deployed anywhere can be mapped but shows no live flow (nothing is running it).
     */
    public com.atlas.dashboard.topology.domain.RepoRevisions revisions(String component) {
        String repo = "registry.internal/" + slug(component);
        var environments = List.of(
                new com.atlas.dashboard.topology.domain.RepoRevisions.Environment(
                        "prod", "9f8e7d6", repo + ":1.24.0"),
                new com.atlas.dashboard.topology.domain.RepoRevisions.Environment(
                        "test", "e4f5a6b", repo + ":test-e4f5a6b"),
                new com.atlas.dashboard.topology.domain.RepoRevisions.Environment(
                        "dev", "a1b2c3d", repo + ":dev-a1b2c3d"));
        var commits = List.of(
                new com.atlas.dashboard.topology.domain.RepoRevisions.CommitRef(
                        "3c1aa90", "wip: batch-evaluate concurrency", null),
                new com.atlas.dashboard.topology.domain.RepoRevisions.CommitRef(
                        "a1b2c3d", "feat: sandbox OPA policy cache", "dev"),
                new com.atlas.dashboard.topology.domain.RepoRevisions.CommitRef(
                        "e4f5a6b", "fix: null policy-bundle handling", "test"),
                new com.atlas.dashboard.topology.domain.RepoRevisions.CommitRef(
                        "9f8e7d6", "release: guardrails 1.24.0", "prod"),
                new com.atlas.dashboard.topology.domain.RepoRevisions.CommitRef(
                        "77d0c12", "chore: bump spring-boot 3.4.1", null));
        return new com.atlas.dashboard.topology.domain.RepoRevisions(environments, commits);
    }

    /** REST endpoints each service exposes — what an incoming HTTP call lands on. */
    private static final Map<String, List<String>> ENDPOINTS = Map.of(
            "guardrails-orchestrator", List.of(
                    "POST /v1/evaluate",
                    "POST /v1/policies/decide",
                    "POST /v1/guardrails/batch-evaluate",
                    "GET /v1/health"),
            "guardrails-client", List.of("POST /v1/guardrails/invoke", "GET /v1/status"),
            "guardrails-registry", List.of("GET /v1/policies/{id}", "PUT /v1/policies", "GET /v1/health"),
            "guardrails-studio", List.of("GET /v1/studio/policies"),
            "opa-pod", List.of("POST /v1/data"),
            "opa-sandbox", List.of("POST /v1/data/sandbox"));

    /** REST endpoints exposed by a node (empty for non-HTTP infra like Kafka topics or Mongo). */
    public List<String> endpoints(String nodeId) {
        return ENDPOINTS.getOrDefault(nodeId, List.of());
    }

    /** OpenAPI-style operation doc: summary + example request body (null for body-less ops). */
    public record EndpointDoc(String summary, String requestBodyExample) {
    }

    /** Per-endpoint OpenAPI docs, as DeepWiki would extract them from the repo's spec. */
    private static final Map<String, Map<String, EndpointDoc>> ENDPOINT_DOCS = Map.of(
            "guardrails-orchestrator", Map.of(
                    "POST /v1/evaluate", new EndpointDoc(
                            "Evaluate a policy request end-to-end (bundle lookup + OPA decision).",
                            "{\n  \"subject\": \"vmforge-deploy-7f3\",\n  \"action\": \"deploy\",\n"
                                    + "  \"resource\": \"cluster/prod-eu1\",\n  \"policyBundle\": \"guardrails/base\",\n"
                                    + "  \"context\": { \"env\": \"prod\", \"region\": \"eu-west-1\" }\n}"),
                    "POST /v1/policies/decide", new EndpointDoc(
                            "Single policy decision without bundle resolution.",
                            "{\n  \"subject\": \"lightspeed-batch-42\",\n  \"action\": \"publish\",\n"
                                    + "  \"resource\": \"topic/lightspeed-events\"\n}"),
                    "POST /v1/guardrails/batch-evaluate", new EndpointDoc(
                            "Evaluate a batch of policy requests in one round-trip.",
                            "{\n  \"requests\": [\n    { \"subject\": \"svc-a\", \"action\": \"read\","
                                    + " \"resource\": \"vault/creds\" },\n    { \"subject\": \"svc-b\","
                                    + " \"action\": \"write\", \"resource\": \"bucket/exports\" }\n  ]\n}"),
                    "GET /v1/health", new EndpointDoc("Liveness/readiness probe.", null)),
            "guardrails-client", Map.of(
                    "POST /v1/guardrails/invoke", new EndpointDoc(
                            "Invoke a guardrails evaluation on behalf of a caller.",
                            "{\n  \"caller\": \"vmforge\",\n  \"request\": { \"subject\": \"deploy-7f3\","
                                    + " \"action\": \"deploy\" }\n}"),
                    "GET /v1/status", new EndpointDoc("Client liveness and queue depth.", null)),
            "guardrails-registry", Map.of(
                    "GET /v1/policies/{id}", new EndpointDoc("Fetch a policy bundle by id.", null),
                    "PUT /v1/policies", new EndpointDoc(
                            "Create or update a policy bundle.",
                            "{\n  \"id\": \"guardrails/base\",\n  \"version\": \"1.25.0\",\n"
                                    + "  \"rego\": \"package guardrails\\n\\ndefault allow = false\"\n}"),
                    "GET /v1/health", new EndpointDoc("Liveness/readiness probe.", null)),
            "opa-pod", Map.of(
                    "POST /v1/data", new EndpointDoc(
                            "OPA data API — evaluate the guardrails/allow rule.",
                            "{\n  \"input\": { \"subject\": \"vmforge-deploy-7f3\", \"action\": \"deploy\","
                                    + " \"resource\": \"cluster/prod-eu1\" }\n}")),
            "opa-sandbox", Map.of(
                    "POST /v1/data/sandbox", new EndpointDoc(
                            "Sandboxed OPA evaluation for policy authoring.",
                            "{\n  \"input\": { \"subject\": \"studio-preview\", \"action\": \"evaluate\" }\n}")),
            "guardrails-studio", Map.of(
                    "GET /v1/studio/policies", new EndpointDoc("List policies for the authoring UI.", null)));

    /** OpenAPI doc for one endpoint of a node, or null when the spec doesn't cover it. */
    public EndpointDoc endpointDoc(String nodeId, String endpoint) {
        return ENDPOINT_DOCS.getOrDefault(nodeId, Map.of()).get(endpoint);
    }

    /**
     * Per-endpoint downstream calls — what each REST endpoint fans out to, as DeepWiki's code
     * analysis would report. Distinct endpoints hit distinct dependencies (e.g. /health calls
     * nothing), so selecting an endpoint reveals only its sub-flow.
     */
    private static final Map<String, Map<String, List<String>>> ENDPOINT_DOWNSTREAM = Map.of(
            "guardrails-orchestrator", Map.of(
                    "POST /v1/evaluate",
                    List.of("guardrails-orchestrator->opa-pod", "guardrails-orchestrator->bpe-mongo"),
                    "POST /v1/policies/decide",
                    List.of("guardrails-orchestrator->opa-pod"),
                    "POST /v1/guardrails/batch-evaluate",
                    List.of("guardrails-orchestrator->opa-pod", "guardrails-orchestrator->bpe-mongo"),
                    "GET /v1/health",
                    List.of()));

    /** Edge ids a given endpoint on a node triggers downstream (empty when it calls nothing). */
    public List<String> endpointDownstream(String nodeId, String endpoint) {
        return ENDPOINT_DOWNSTREAM.getOrDefault(nodeId, Map.of()).getOrDefault(endpoint, List.of());
    }

    /**
     * Edge ids on the request path(s) that lead <em>into</em> a node, from each original invoker
     * (entry point) down to the node — channel-correct (a synchronous request never travels the
     * Kafka bus). Lets a flow be shown end-to-end, starting at the invoker, not just downstream.
     */
    public List<String> upstreamEdges(String target) {
        Map<String, List<DependencyEdge>> out = new LinkedHashMap<>();
        for (DependencyEdge e : EDGES) {
            out.computeIfAbsent(e.source(), k -> new ArrayList<>()).add(e);
        }
        record Frontier(String id, boolean async) {
        }
        Set<String> collected = new LinkedHashSet<>();
        for (String entry : entryPoints()) {
            // channel-correct BFS from the invoker, recording the edge each node was reached by
            Map<String, DependencyEdge> parent = new HashMap<>();
            Set<String> seen = new HashSet<>();
            seen.add(entry);
            Deque<Frontier> queue = new ArrayDeque<>();
            queue.add(new Frontier(entry, false));
            while (!queue.isEmpty()) {
                Frontier f = queue.poll();
                boolean isOrigin = f.id().equals(entry);
                for (DependencyEdge e : out.getOrDefault(f.id(), List.of())) {
                    boolean kafka = e.kind() == EdgeKind.KAFKA;
                    if (!isOrigin && !f.async() && kafka) {
                        continue;
                    }
                    if (seen.add(e.target())) {
                        parent.put(e.target(), e);
                        queue.add(new Frontier(e.target(), f.async() || kafka));
                    }
                }
            }
            // walk parents back from the target to the invoker, collecting the path edges
            String cur = target;
            while (parent.containsKey(cur)) {
                DependencyEdge e = parent.get(cur);
                collected.add(e.id());
                cur = e.source();
            }
        }
        return new ArrayList<>(collected);
    }

    /**
     * Entry points that originate traffic into the platform — derived from the topology, not
     * hardcoded, so it keeps working against real data. A node is an entry point when it is a
     * service that emits calls (has outbound edges) but receives no <em>synchronous</em> inbound
     * call; it may still receive asynchronous (Kafka) responses to flows it started. This yields
     * VMForge (HTTP caller) and Lightspeed (event producer); downstream services like the
     * Orchestrator or Registry — which receive HTTP calls — are excluded.
     */
    public List<String> entryPoints() {
        Set<String> hasOutbound = new HashSet<>();
        Set<String> hasSyncInbound = new HashSet<>();
        for (DependencyEdge e : EDGES) {
            hasOutbound.add(e.source());
            if (e.kind() != EdgeKind.KAFKA) {
                hasSyncInbound.add(e.target());
            }
        }
        List<String> entries = new ArrayList<>();
        for (NodeSpec s : NODES) {
            if (s.kind() == NodeKind.SERVICE && hasOutbound.contains(s.id())
                    && !hasSyncInbound.contains(s.id())) {
                entries.add(s.id());
            }
        }
        return entries;
    }

    public Map<String, EdgeObservation> edgeObservations(String center) {
        return edgeObservations(center, null);
    }

    /** Per-edge observed traffic + log presence. */
    public Map<String, EdgeObservation> edgeObservations(String center, String rev) {
        Map<String, EdgeObservation> out = new LinkedHashMap<>();
        for (DependencyEdge e : edgesFor(rev)) {
            Random r = rng(e.id() + ":obs");
            boolean isSilent = SILENT_EDGES.contains(e.id());
            boolean isMissing = MISSING_LOG_EDGES.contains(e.id());
            boolean observed = !isSilent;
            boolean hasLogs = observed && !isMissing;
            // how the logs prove the traffic: half the healthy edges are confirmed by the
            // source logging the request+response round trip, the other half by the source's
            // trace id appearing in the receiver's logs
            LogEvidence evidence = !hasLogs ? LogEvidence.NONE
                    : (r.nextBoolean() ? LogEvidence.SOURCE_ROUND_TRIP : LogEvidence.TRACE_CORRELATED);
            out.put(e.id(), new EdgeObservation(
                    e.id(),
                    observed,
                    hasLogs,
                    evidence,
                    observed ? 40 + r.nextInt(900) : 0,
                    observed ? round4(r.nextDouble() * (isMissing ? 0.06 : 0.02)) : 0,
                    observed ? 12 + r.nextInt(240) : 0));
        }
        return out;
    }

    public boolean isOwned(String nodeId) {
        NodeSpec s = spec(nodeId);
        return s != null && OUR_APP.equals(s.app());
    }

    private Health health(Random r) {
        double v = r.nextDouble();
        return v > 0.9 ? Health.DEGRADED : Health.HEALTHY;
    }

    private static double round4(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}
