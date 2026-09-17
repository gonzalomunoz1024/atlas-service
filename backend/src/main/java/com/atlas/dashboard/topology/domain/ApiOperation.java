package com.atlas.dashboard.topology.domain;

/**
 * One operation from a service's OpenAPI spec, as DeepWiki extracts it from the repo.
 * {@code requestBodyExample} is a JSON example (null for body-less operations) — also used to
 * generate realistic payloads for synthetic transactions.
 */
public record ApiOperation(String method, String path, String summary, String requestBodyExample) {
}
