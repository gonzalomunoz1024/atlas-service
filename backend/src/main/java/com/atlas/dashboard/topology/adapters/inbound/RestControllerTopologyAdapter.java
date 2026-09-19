package com.atlas.dashboard.topology.adapters.inbound;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import com.atlas.dashboard.topology.application.TopologyUseCase;
import com.atlas.dashboard.topology.domain.ApiOperation;
import com.atlas.dashboard.topology.domain.BlastRadius;
import com.atlas.dashboard.topology.domain.ClusterDeployment;
import com.atlas.dashboard.topology.domain.ComponentGraph;
import com.atlas.dashboard.topology.domain.ComponentSummary;
import com.atlas.dashboard.topology.domain.EndpointFlow;
import com.atlas.dashboard.topology.domain.NodeMetrics;
import com.atlas.dashboard.topology.domain.RepoRevisions;
import com.atlas.dashboard.topology.domain.WikiDoc;
import com.atlas.dashboard.topology.ports.inbound.TopologyInboundPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
@RequestMapping("/v1")
public class RestControllerTopologyAdapter implements TopologyInboundPort {

    private final TopologyUseCase useCase;

    @Override
    @GetMapping("/components/search")
    public Flux<ComponentSummary> search(@RequestParam(name = "q", required = false) String query) {
        return useCase.search(query);
    }

    @Override
    @GetMapping("/components/{component}/graph")
    public Mono<ComponentGraph> graph(@PathVariable String component,
            @RequestParam(required = false) String rev) {
        return useCase.graph(component, rev);
    }

    @Override
    @GetMapping("/components/{component}/nodes/{nodeId}/metrics")
    public Mono<NodeMetrics> metrics(@PathVariable String component, @PathVariable String nodeId) {
        return useCase.metrics(component, nodeId);
    }

    @Override
    @GetMapping("/components/{component}/nodes/{nodeId}/wiki")
    public Mono<WikiDoc> wiki(@PathVariable String component, @PathVariable String nodeId) {
        return useCase.wiki(component, nodeId);
    }

    @Override
    @GetMapping("/components/{component}/nodes/{nodeId}/endpoints")
    public Mono<List<EndpointFlow>> endpoints(@PathVariable String component, @PathVariable String nodeId) {
        return useCase.endpoints(component, nodeId);
    }

    @Override
    @GetMapping("/components/{component}/revisions")
    public Mono<RepoRevisions> revisions(@PathVariable String component) {
        return useCase.revisions(component);
    }

    @Override
    @GetMapping("/components/{component}/nodes/{nodeId}/openapi")
    public Mono<List<ApiOperation>> apiSpec(@PathVariable String component, @PathVariable String nodeId) {
        return useCase.apiSpec(component, nodeId);
    }

    @Override
    @GetMapping("/components/{component}/nodes/{nodeId}/blast-radius")
    public Mono<BlastRadius> blastRadius(@PathVariable String component, @PathVariable String nodeId,
            @RequestParam(required = false) String rev,
            @RequestParam(required = false) Integer maxDepth) {
        return useCase.blastRadius(component, nodeId, rev, maxDepth);
    }

    @Override
    @GetMapping("/components/{component}/nodes/{nodeId}/deployments")
    public Mono<List<ClusterDeployment>> deployments(@PathVariable String component, @PathVariable String nodeId) {
        return useCase.deployments(component, nodeId);
    }
}
