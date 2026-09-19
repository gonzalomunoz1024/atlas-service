package com.atlas.dashboard.topology.adapters.outbound;

import java.util.List;
import java.util.Random;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.common.TopologyFixture;
import com.atlas.dashboard.common.domain.NodeKind;
import com.atlas.dashboard.topology.domain.ClusterDeployment;
import com.atlas.dashboard.topology.ports.outbound.OpenShiftPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class MockOpenShiftAdapter implements OpenShiftPort {

    /** The OCP cluster fleet: {code, region}. */
    private static final String[][] CLUSTERS = {
            { "GAR", "us-east-1" },
            { "STR", "eu-west-1" },
            { "LEW", "us-west-2" },
    };

    private final TopologyFixture fixture;

    @Override
    public Mono<List<ClusterDeployment>> deployments(String nodeId) {
        // Only application nodes run on OCP — topics and stores are managed infra. Placement is
        // deterministic per app: prod runs on two clusters, test and dev each on one.
        return Mono.fromSupplier(() -> {
            var spec = fixture.spec(nodeId);
            if (spec == null || !(spec.kind() == NodeKind.SERVICE || spec.kind() == NodeKind.EXTERNAL)) {
                return List.of();
            }
            Random r = new Random((nodeId + ":ocp").hashCode());
            int first = r.nextInt(CLUSTERS.length);
            String[] prodA = CLUSTERS[first];
            String[] prodB = CLUSTERS[(first + 1 + r.nextInt(CLUSTERS.length - 1)) % CLUSTERS.length];
            String[] test = CLUSTERS[r.nextInt(CLUSTERS.length)];
            String[] dev = CLUSTERS[r.nextInt(CLUSTERS.length)];
            return List.of(
                    deployment(prodA, "prod", nodeId, 4 + r.nextInt(5)),
                    deployment(prodB, "prod", nodeId, 4 + r.nextInt(5)),
                    deployment(test, "test", nodeId, 2),
                    deployment(dev, "dev", nodeId, 1 + r.nextInt(2)));
        });
    }

    private ClusterDeployment deployment(String[] cluster, String env, String nodeId, int replicas) {
        return new ClusterDeployment(
                cluster[0],
                env,
                cluster[1],
                nodeId + "-" + env,
                replicas,
                "Healthy");
    }
}
