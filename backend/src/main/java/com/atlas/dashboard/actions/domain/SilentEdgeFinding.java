package com.atlas.dashboard.actions.domain;

import java.util.List;

/** The case file for a mapped-but-silent link: what it means and what to do next. */
public record SilentEdgeFinding(String summary, List<Item> meanings, List<String> nextSteps) {

    /** One interpretation, e.g. "Observability gap" / "Stale code". */
    public record Item(String title, String body) {
    }
}
