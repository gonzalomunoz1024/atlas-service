package com.atlas.dashboard.flow.ports.outbound;

import java.util.List;
import java.util.Map;

import com.atlas.dashboard.flow.domain.LogLine;

import reactor.core.publisher.Mono;

/** Splunk: log lines for a trace, keyed by span id. Spans with no logs are simply absent. */
public interface SplunkPort {
    Mono<Map<String, List<LogLine>>> logsBySpan(String traceId);
}
