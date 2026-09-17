package com.atlas.dashboard.flow.adapters.outbound;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.common.domain.CallStatus;
import com.atlas.dashboard.flow.adapters.outbound.TraceScaffold.Built;
import com.atlas.dashboard.flow.adapters.outbound.TraceScaffold.SpanSkeleton;
import com.atlas.dashboard.flow.domain.LogLine;
import com.atlas.dashboard.flow.domain.LogLine.LogLevel;
import com.atlas.dashboard.flow.ports.outbound.SplunkPort;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class MockSplunkAdapter implements SplunkPort {

    private final TraceScaffold scaffold;

    @Override
    public Mono<Map<String, List<LogLine>>> logsBySpan(String traceId) {
        return Mono.fromSupplier(() -> {
            Built b = scaffold.build(traceId);
            Map<String, List<LogLine>> out = new LinkedHashMap<>();
            for (SpanSkeleton s : b.spans()) {
                if (!s.shouldHaveLogs()) {
                    continue; // Splunk simply has nothing for this span — the missing link
                }
                String startTs = scaffold.logTimestamp(b.startedAt(), s.startOffsetMs());
                String endTs = scaffold.logTimestamp(b.startedAt(), s.startOffsetMs() + s.durationMs());
                boolean err = s.status() == CallStatus.ERROR;
                out.put(s.spanId(), List.of(
                        new LogLine(startTs, LogLevel.INFO, s.nodeId(),
                                s.op() + " started traceId=" + traceId),
                        new LogLine(endTs, err ? LogLevel.ERROR : LogLevel.INFO, s.nodeId(),
                                err ? "downstream declined (" + s.durationMs() + "ms)"
                                        : s.op() + " ok (" + s.durationMs() + "ms)")));
            }
            return out;
        });
    }
}
