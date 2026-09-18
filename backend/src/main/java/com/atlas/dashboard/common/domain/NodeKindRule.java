package com.atlas.dashboard.common.domain;

/**
 * Consistency rule: a service another org owns IS an external service — the legend, the node
 * colour, and the modal must all say so. Applied by the use cases to whatever the topology
 * adapter returns, so mock and real adapters get the same treatment.
 */
public final class NodeKindRule {

    private NodeKindRule() {
    }

    public static NodeKind effective(NodeKind kind, boolean owned) {
        return kind == NodeKind.SERVICE && !owned ? NodeKind.EXTERNAL : kind;
    }

    public static ComponentNode apply(ComponentNode n) {
        NodeKind kind = effective(n.kind(), n.owned());
        if (kind == n.kind()) {
            return n;
        }
        return new ComponentNode(n.id(), n.name(), kind, n.app(), n.cluster(), n.owned(),
                n.health(), n.center());
    }
}
