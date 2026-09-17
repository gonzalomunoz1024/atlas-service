package com.atlas.dashboard.insights.adapters.outbound;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.common.TopologyFixture;
import com.atlas.dashboard.common.domain.EdgeObservation;
import com.atlas.dashboard.insights.ports.outbound.ObservabilityPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

/** Reads the shared fixture so observability stays consistent with the topology view. */
@Component
@RequiredArgsConstructor
public class MockObservabilityAdapter implements ObservabilityPort {

    private final TopologyFixture fixture;

    @Override
    public Mono<Map<String, EdgeObservation>> edgeObservations(String component, String rev) {
        return Mono.fromSupplier(() -> fixture.edgeObservations(component, rev));
    }
}
