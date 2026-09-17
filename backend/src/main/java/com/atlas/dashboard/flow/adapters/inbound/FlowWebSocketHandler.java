package com.atlas.dashboard.flow.adapters.inbound;

import java.util.Map;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.util.UriComponentsBuilder;

import com.atlas.dashboard.flow.application.FlowUseCase;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;

/**
 * Streams live {@link com.atlas.dashboard.flow.domain.FlowEvent}s as JSON text frames over
 * {@code /ws/flow?component=<name>}. Drives the graph's travelling particles.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FlowWebSocketHandler implements WebSocketHandler {

    private final FlowUseCase useCase;
    private final ObjectMapper objectMapper;

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        Map<String, String> q = UriComponentsBuilder.fromUri(session.getHandshakeInfo().getUri())
                .build().getQueryParams().toSingleValueMap();
        String component = q.getOrDefault("component", "checkout-service");
        String rev = q.get("rev");
        var messages = useCase.liveFlow(component, rev)
                .map(this::toJson)
                .map(session::textMessage);
        return session.send(messages)
                .doOnSubscribe(s -> log.info("flow ws open component={} rev={}", component, rev))
                .doFinally(sig -> log.info("flow ws close component={} signal={}", component, sig));
    }

    private String toJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            return "{}";
        }
    }
}
