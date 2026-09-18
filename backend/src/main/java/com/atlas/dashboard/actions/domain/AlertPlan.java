package com.atlas.dashboard.actions.domain;

import java.util.List;

/** Alert rules derived from a trace's call path — ready to create in Splunk / SPLOC. */
public record AlertPlan(String traceId, String summary, List<AlertRule> rules) {

    /** One proposed rule; {@code system} is the platform it belongs to (splunk | sploc). */
    public record AlertRule(String system, String name, String query, String rationale) {
    }
}
