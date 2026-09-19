package com.atlas.dashboard.topology.ports.outbound;

import java.util.List;

import com.atlas.dashboard.topology.domain.ApiOperation;
import com.atlas.dashboard.topology.domain.ComponentGraph;
import com.atlas.dashboard.topology.domain.ComponentSummary;
import com.atlas.dashboard.topology.domain.EndpointFlow;
import com.atlas.dashboard.topology.domain.RepoRevisions;
import com.atlas.dashboard.topology.domain.WikiDoc;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** Devin/DeepWiki: the source of the dependency topology and generated documentation. */
public interface DeepWikiPort {
    Flux<ComponentSummary> search(String query);

    Mono<ComponentGraph> graph(String component, String rev);

    Mono<WikiDoc> wiki(String nodeId);

    /**
     * Raw endpoint data DeepWiki extracted for a node: each REST endpoint mapped to the edge ids
     * it triggers downstream. Flow composition (adding the upstream request path) is the use
     * case's rule, not the adapter's.
     */
    Mono<java.util.Map<String, List<String>>> endpointDownstream(String nodeId);

    /** Deployed environments + recent commits the repo's map can be viewed at. */
    Mono<RepoRevisions> revisions(String component);

    /** The node's OpenAPI operations (empty when the repo has no spec). */
    Mono<List<ApiOperation>> apiSpec(String nodeId);
}
