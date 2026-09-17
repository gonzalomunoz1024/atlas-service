package com.atlas.dashboard.common.domain;

/**
 * A node in the dependency map.
 * <ul>
 *   <li>{@code app} — owning application id (e.g. TAP, CLAUT, BPE); {@code owned} is true when it
 *       belongs to our app.</li>
 *   <li>{@code cluster} — for Kafka topics, the cluster the topic lives on (null otherwise).</li>
 *   <li>{@code center} — non-null only for the searched component.</li>
 * </ul>
 */
public record ComponentNode(
        String id,
        String name,
        NodeKind kind,
        String app,
        String cluster,
        boolean owned,
        Health health,
        Boolean center) {

    public static ComponentNode center(String id, String name, String app) {
        return new ComponentNode(id, name, NodeKind.SERVICE, app, null, true, Health.HEALTHY, true);
    }

    public static ComponentNode of(String id, String name, NodeKind kind, String app, String cluster,
            boolean owned, Health health) {
        return new ComponentNode(id, name, kind, app, cluster, owned, health, null);
    }

    // --- overloads kept for tests / callers that don't model apps/clusters ---
    public static ComponentNode center(String id, String name) {
        return center(id, name, null);
    }

    public static ComponentNode of(String id, String name, NodeKind kind, boolean owned, Health health) {
        return of(id, name, kind, null, null, owned, health);
    }
}
