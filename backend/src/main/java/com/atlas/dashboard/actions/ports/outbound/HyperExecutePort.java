package com.atlas.dashboard.actions.ports.outbound;

import com.atlas.dashboard.actions.domain.GeneratedTest;
import com.atlas.dashboard.actions.domain.TestType;

import reactor.core.publisher.Mono;

/** HyperExecute: turns an observed trace into a runnable synthetic test spec. */
public interface HyperExecutePort {
    Mono<GeneratedTest> fromTrace(String traceId, String node, String endpoint, TestType type);
}
