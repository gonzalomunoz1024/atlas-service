package com.atlas.dashboard.flow.adapters.outbound;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.common.TopologyFixture;
import com.atlas.dashboard.common.domain.DependencyEdge;
import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.flow.ports.outbound.FlowTopologyPort;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class MockFlowTopologyAdapter implements FlowTopologyPort {

    private final TopologyFixture fixture;

    @Override
    public List<DependencyEdge> edges(String component, String rev) {
        return fixture.edges(component, rev);
    }

    @Override
    public Map<String, EdgeObservation> edgeObservations(String component, String rev) {
        return fixture.edgeObservations(component, rev);
    }

    @Override
    public Set<String> serviceIds(String component, String rev) {
        return fixture.serviceIds(rev);
    }

    @Override
    public List<String> endpoints(String nodeId) {
        return fixture.endpoints(nodeId);
    }
}
