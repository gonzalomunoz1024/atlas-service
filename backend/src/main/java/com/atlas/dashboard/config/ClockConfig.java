package com.atlas.dashboard.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * A single injectable {@link Clock} so time-dependent logic stays deterministic in tests.
 * Mirrors the streak convention of injecting a Clock into use cases rather than calling
 * {@code Instant.now()} directly.
 */
@Configuration
public class ClockConfig {
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
