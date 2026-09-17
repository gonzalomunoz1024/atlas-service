package com.atlas.dashboard.flow.domain;

public record LogLine(String ts, LogLevel level, String service, String message) {

    public enum LogLevel {
        INFO, WARN, ERROR, DEBUG
    }
}
