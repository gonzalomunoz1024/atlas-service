package com.atlas.dashboard.flow.adapters.outbound;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * Minimal Splunk-style time modifier parser: {@code now}, relative offsets like {@code -15m},
 * {@code -4h}, {@code -7d}, or an absolute ISO-8601 instant. Snap-to suffixes ({@code @h}) are
 * accepted and ignored — the mock stands in for Splunk, so the UI can speak earliest/latest
 * natively and a real Splunk adapter would pass the strings straight through.
 */
final class SplunkTime {

    private SplunkTime() {
    }

    static Instant resolve(String modifier, Instant now, Instant fallback) {
        if (modifier == null || modifier.isBlank() || modifier.equals("0")) {
            return fallback;
        }
        String m = modifier.trim();
        int at = m.indexOf('@');
        if (at >= 0) {
            m = m.substring(0, at);
        }
        if (m.equals("now")) {
            return now;
        }
        if (m.startsWith("-") || m.startsWith("+")) {
            try {
                long n = Long.parseLong(m.substring(1, m.length() - 1));
                Duration d = switch (Character.toLowerCase(m.charAt(m.length() - 1))) {
                    case 's' -> Duration.ofSeconds(n);
                    case 'm' -> Duration.ofMinutes(n);
                    case 'h' -> Duration.ofHours(n);
                    case 'd' -> Duration.ofDays(n);
                    case 'w' -> Duration.ofDays(7 * n);
                    default -> null;
                };
                if (d == null) {
                    return fallback;
                }
                return m.startsWith("-") ? now.minus(d) : now.plus(d);
            } catch (NumberFormatException | StringIndexOutOfBoundsException e) {
                return fallback;
            }
        }
        try {
            return Instant.parse(m);
        } catch (DateTimeParseException e) {
            return fallback;
        }
    }
}
