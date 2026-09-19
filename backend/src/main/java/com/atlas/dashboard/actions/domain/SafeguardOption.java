package com.atlas.dashboard.actions.domain;

/** One safeguard kind the platform can (or will) generate from a trace. */
public record SafeguardOption(String id, String group, boolean available) {
}
