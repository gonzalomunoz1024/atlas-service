package com.atlas.dashboard.actions.domain;

import java.util.List;

public record EnhancementPlan(
        String component,
        boolean owned,
        String summary,
        List<String> rationale,
        String diff,
        List<String> suggestedAlerts) {
}
