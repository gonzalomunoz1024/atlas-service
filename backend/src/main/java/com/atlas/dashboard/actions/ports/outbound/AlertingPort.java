package com.atlas.dashboard.actions.ports.outbound;

import com.atlas.dashboard.actions.domain.AlertPlan;

import reactor.core.publisher.Mono;

/**
 * Proposes alert rules for the observability platforms, derived from a trace's call path.
 * Backed by the Splunk/SPLOC alerting APIs in production; the mock derives rules from
 * fixture observations.
 */
public interface AlertingPort {

    Mono<AlertPlan> planFromTrace(String component, String traceId);
}
