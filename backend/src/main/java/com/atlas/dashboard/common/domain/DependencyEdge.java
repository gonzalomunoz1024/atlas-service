package com.atlas.dashboard.common.domain;

/** A directed dependency edge from {@code source} to {@code target}. */
public record DependencyEdge(String id, String source, String target, EdgeKind kind) {

    public static DependencyEdge of(String source, String target, EdgeKind kind) {
        return new DependencyEdge(source + "->" + target, source, target, kind);
    }
}
