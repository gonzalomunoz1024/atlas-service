package com.atlas.dashboard.actions.domain;

import java.util.List;

/**
 * Alert rules derived from a trace's call path, plus the observability-as-code manifest that
 * declares them — the manifest is the reviewable artifact; the rules explain it.
 */
public record AlertPlan(String traceId, String summary, String manifestYaml, List<AlertRule> rules) {

    /** One proposed rule; {@code system} is the platform it belongs to (splunk | sploc). */
    public record AlertRule(String system, String name, String query, String rationale) {
    }
}
