package com.atlas.dashboard.flow.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.atlas.dashboard.common.TopologyFixture;
import com.atlas.dashboard.common.domain.CallStatus;
import com.atlas.dashboard.flow.domain.LogLine;
import com.atlas.dashboard.flow.domain.LogLine.LogLevel;
import com.atlas.dashboard.flow.domain.Span;
import com.atlas.dashboard.flow.domain.TraceDetail;
import com.atlas.dashboard.flow.ports.outbound.SplocPort;
import com.atlas.dashboard.flow.ports.outbound.SplunkPort;

import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

@ExtendWith(MockitoExtension.class)
class FlowUseCaseTest {

    @Mock private SplocPort sploc;
    @Mock private SplunkPort splunk;

    private FlowUseCase useCase;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-14T00:00:00Z"), ZoneOffset.UTC);
        useCase = new FlowUseCase(sploc, splunk, new TopologyFixture(), clock, 900);
    }

    @Test
    void mergesSplunkLogsIntoSpansAndMarksGaps() {
        Span withLogsSlot = new Span("t-s0", null, "svc", "svc", "op", 0, 10, CallStatus.OK, false, List.of());
        Span gapSpan = new Span("t-s1", "t-s0", "pricing-service", "pricing-service", "quote", 10, 20,
                CallStatus.OK, false, List.of());
        TraceDetail skeleton = new TraceDetail("t", "2026-09-14T00:00:00Z", 40, CallStatus.OK,
                List.of(withLogsSlot, gapSpan));

        Map<String, List<LogLine>> logs = Map.of(
                "t-s0", List.of(new LogLine("2026-09-14T00:00:00Z", LogLevel.INFO, "svc", "op ok")));

        when(sploc.spans("t")).thenReturn(Mono.just(skeleton));
        when(splunk.logsBySpan("t")).thenReturn(Mono.just(logs));

        StepVerifier.create(useCase.trace("t"))
                .assertNext(detail -> {
                    Span s0 = detail.spans().get(0);
                    Span s1 = detail.spans().get(1);
                    assertThat(s0.hasLogs()).isTrue();
                    assertThat(s0.logs()).hasSize(1);
                    assertThat(s1.hasLogs()).isFalse(); // the missing link at trace granularity
                    assertThat(s1.logs()).isEmpty();
                })
                .verifyComplete();
    }
}
