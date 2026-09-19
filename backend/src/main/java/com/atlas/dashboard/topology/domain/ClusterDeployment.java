package com.atlas.dashboard.topology.domain;

/** One OpenShift deployment of an application: which OCP cluster it runs on, and where. */
public record ClusterDeployment(
        String cluster,
        String env,
        String region,
        String namespace,
        int replicas,
        String status) {
}
