package com.atlas.dashboard.topology.domain;

import java.util.List;

/** DeepWiki-generated documentation for a node — a multi-page wiki, surfaced in the node modal. */
public record WikiDoc(
        String nodeId,
        String title,
        String sourceRepo,
        String generatedAt,
        List<WikiPage> pages,
        List<String> tags) {

    /** One navigable page in the wiki (shown in the left sidebar). */
    public record WikiPage(String title, String summary, List<WikiSection> sections) {
    }

    public record WikiSection(String heading, String body) {
    }
}
