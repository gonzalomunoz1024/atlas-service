package com.atlas.dashboard.actions.adapters.outbound;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.atlas.dashboard.actions.domain.GeneratedTest;
import com.atlas.dashboard.actions.domain.TestType;
import com.atlas.dashboard.actions.ports.outbound.HyperExecutePort;
import com.atlas.dashboard.common.TopologyFixture;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class MockHyperExecuteAdapter implements HyperExecutePort {

    private final TopologyFixture fixture;

    @Override
    public Mono<GeneratedTest> fromTrace(String traceId, String node, String endpoint, TestType type) {
        // one branch per test kind — a future PERFORMANCE type adds its own generator here
        if (type != TestType.SYNTHETIC) {
            return Mono.error(new IllegalArgumentException("Unsupported test type: " + type));
        }
        return Mono.fromSupplier(() -> {
            // when the observed call names its endpoint, generate the payload from the service's
            // OpenAPI spec (via DeepWiki) instead of a canned example
            String method = "POST";
            String path = "/guardrails/evaluate";
            String body = "{\n  \"subject\": \"vmforge\",\n  \"action\": \"deploy\",\n  \"policyBundle\": \"guardrails/base\"\n}";
            String bodySource = "the trace entry span";

            if (node != null && endpoint != null) {
                int sp = endpoint.indexOf(' ');
                if (sp > 0) {
                    method = endpoint.substring(0, sp);
                    path = endpoint.substring(sp + 1);
                }
                TopologyFixture.EndpointDoc doc = fixture.endpointDoc(fixture.slug(node), endpoint);
                body = doc != null && doc.requestBodyExample() != null ? doc.requestBodyExample() : "";
                bodySource = doc != null
                        ? "the OpenAPI spec DeepWiki extracted for " + node
                        : "the observed call (no OpenAPI spec found for this endpoint)";
            }

            Map<String, String> headers = new LinkedHashMap<>();
            headers.put("Content-Type", "application/json");
            headers.put("x-atlas-replay", traceId);

            String bodyFlag = body.isEmpty() ? "" : " \\\n        -d '" + body.replace("\n", " ").replaceAll("\\s+", " ") + "'";
            String yaml = String.join("\n",
                    "version: 0.1",
                    "name: replay-" + fixture.slug(path.replace("/", "-").replaceAll("^-", "")),
                    "runson: hyperexecute",
                    "autosplit: true",
                    "testSuites:",
                    "  - name: replay-" + traceId,
                    "    command: |",
                    "      curl -sS -X " + method + " \"$BASE_URL" + path + "\" \\",
                    "        -H \"Content-Type: application/json\" \\",
                    "        -H \"x-atlas-replay: " + traceId + "\"" + bodyFlag,
                    "    assert:",
                    "      - status == 200",
                    "      - responseTime < 800");

            return new GeneratedTest(
                    type,
                    "syn-" + traceId,
                    "Replay of " + traceId,
                    method,
                    path,
                    headers,
                    body,
                    "Payload reconstructed from " + bodySource + ". Runs on HyperExecute as an autosplit "
                            + "synthetic that replays the request and asserts a 200 under 800ms.",
                    yaml);
        });
    }
}
