import type {
  ApiOperation,
  ComponentGraph,
  ComponentNode,
  ComponentSummary,
  DependencyEdge,
  EdgeKind,
  EndpointFlow,
  EnhancementPlan,
  FlowEvent,
  FlowRoute,
  HealthEdge,
  HealthMap,
  LogLine,
  NodeKind,
  RepoRevisions,
  NodeMetrics,
  Span,
  SyntheticTest,
  TraceDetail,
  TraceSummary,
  WikiDoc,
} from '../types/atlas'

export const DEMO_MODE: boolean =
  new URLSearchParams(location.search).has('demo') ||
  (import.meta.env.VITE_DEMO_MODE as string | undefined) === 'true'

/* --- deterministic PRNG so the demo looks identical every run ------------- */
function seeded(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const slug = (s: string) => s.toLowerCase().trim().replace(/\s+/g, '-')

/* --- the Guardrails platform topology (fixed) ----------------------------- */
interface NodeSpec {
  id: string
  name: string
  kind: NodeKind
  app: string
  cluster?: string
}

const OUR_APP = 'TAP'
const KAFKA_CLUSTER = 'bpe-events'

const NODES: NodeSpec[] = [
  { id: 'guardrails-orchestrator', name: 'Guardrails Orchestrator', kind: 'service', app: 'TAP' },
  { id: 'guardrails-client', name: 'Guardrails Client', kind: 'service', app: 'TAP' },
  { id: 'guardrails-registry', name: 'Guardrails Registry', kind: 'service', app: 'TAP' },
  { id: 'guardrails-studio', name: 'Guardrails Studio', kind: 'service', app: 'TAP' },
  { id: 'opa-pod', name: 'OPA Pod', kind: 'service', app: 'TAP' },
  { id: 'opa-sandbox', name: 'Sandbox OPA', kind: 'service', app: 'TAP' },
  { id: 'vmforge', name: 'VMForge', kind: 'service', app: 'CLAUT' },
  { id: 'lightspeed', name: 'Lightspeed Platform Service', kind: 'service', app: 'BPE' },
  { id: 'bpe-mongo', name: 'BPE Mongo DB', kind: 'mongo', app: 'BPE' },
  { id: 'evt-request', name: 'GuardrailsEvaluationRequestedEvent', kind: 'kafka', app: 'BPE', cluster: KAFKA_CLUSTER },
  { id: 'evt-response', name: 'GuardrailsEvaluationResponseEvent', kind: 'kafka', app: 'BPE', cluster: KAFKA_CLUSTER },
]

const EDGE_DEFS: [string, string, EdgeKind][] = [
  ['guardrails-client', 'guardrails-orchestrator', 'http'],
  ['guardrails-orchestrator', 'bpe-mongo', 'mongo'],
  ['guardrails-orchestrator', 'opa-pod', 'http'],
  ['lightspeed', 'evt-request', 'kafka'],
  ['evt-request', 'guardrails-client', 'kafka'],
  ['guardrails-client', 'evt-response', 'kafka'],
  ['evt-response', 'lightspeed', 'kafka'],
  ['guardrails-client', 'bpe-mongo', 'mongo'],
  ['guardrails-registry', 'bpe-mongo', 'mongo'],
  ['guardrails-studio', 'guardrails-registry', 'http'],
  ['guardrails-registry', 'opa-sandbox', 'http'],
  ['vmforge', 'guardrails-client', 'http'],
]

const EDGES: DependencyEdge[] = EDGE_DEFS.map(([source, target, kind]) => ({
  id: `${source}->${target}`,
  source,
  target,
  kind,
}))

/** OPA policy-decision calls emit no logs — the missing-link story. */
const MISSING_LOG_EDGES = new Set(['guardrails-orchestrator->opa-pod', 'guardrails-registry->opa-sandbox'])
const SILENT_EDGES = new Set(['guardrails-studio->guardrails-registry'])

// per-revision topology: dev introduced an S3 dependency not yet in test/prod (mirrors backend)
const S3_COMMIT = 'a1b2c3d'
const S3_NODE: NodeSpec = { id: 's3-bucket', name: 'S3', kind: 'external', app: 'AWS' }
const S3_EDGE: DependencyEdge = {
  id: 'guardrails-orchestrator->s3-bucket',
  source: 'guardrails-orchestrator',
  target: 's3-bucket',
  kind: 'http',
}
const hasS3 = (rev?: string) => rev === S3_COMMIT
const nodesFor = (rev?: string): NodeSpec[] => (hasS3(rev) ? [...NODES, S3_NODE] : NODES)
const edgesFor = (rev?: string): DependencyEdge[] => (hasS3(rev) ? [...EDGES, S3_EDGE] : EDGES)

const DEFAULT_CENTER = 'guardrails-orchestrator'
const NODE_IDS = new Set(NODES.map((n) => n.id))

function resolveCenter(center: string): string {
  const s = slug(center)
  return NODE_IDS.has(s) ? s : DEFAULT_CENTER
}

function healthOf(rand: () => number): ComponentNode['health'] {
  return rand() > 0.9 ? 'degraded' : 'healthy'
}

function toNode(spec: NodeSpec, center: string): ComponentNode {
  const rand = seeded(spec.id + ':health')
  const isCenter = spec.id === center
  return {
    id: spec.id,
    name: spec.name,
    kind: spec.kind,
    app: spec.app,
    cluster: spec.cluster,
    owned: spec.app === OUR_APP,
    health: isCenter ? 'healthy' : healthOf(rand),
    center: isCenter,
  }
}

function buildGraph(centerName: string, rev?: string): ComponentGraph {
  const center = resolveCenter(centerName)
  return { center, nodes: nodesFor(rev).map((n) => toNode(n, center)), edges: edgesFor(rev) }
}

function buildHealthMap(centerName: string, rev?: string): HealthMap {
  const center = resolveCenter(centerName)
  const hEdges: HealthEdge[] = edgesFor(rev).map((edge) => {
    // metrics are per-environment: each deployed revision sees its own traffic numbers
    const rand = seeded(edge.id + ':obs' + (rev ?? ''))
    const silent = SILENT_EDGES.has(edge.id)
    const missing = MISSING_LOG_EDGES.has(edge.id)
    const observed = !silent
    const hasLogs = observed && !missing
    return {
      ...edge,
      observed,
      hasLogs,
      // mirrors backend: healthy edges split between the two log-evidence patterns
      logEvidence: !hasLogs ? 'none' : rand() > 0.5 ? 'source_round_trip' : 'trace_correlated',
      linkStatus: !observed ? 'silent' : hasLogs ? 'healthy' : 'missing_logs',
      callsPerMin: observed ? Math.round(40 + rand() * 900) : 0,
      errorRate: observed ? Number((rand() * (missing ? 0.06 : 0.02)).toFixed(4)) : 0,
      p95LatencyMs: observed ? Math.round(12 + rand() * 240) : 0,
    }
  })
  const observedEdges = hEdges.filter((e) => e.observed).length
  const loggedEdges = hEdges.filter((e) => e.hasLogs).length
  const score = observedEdges === 0 ? 0 : Math.round((loggedEdges / observedEdges) * 100)
  return {
    center,
    nodes: nodesFor(rev).map((n) => toNode(n, center)),
    edges: hEdges,
    coverage: { loggedEdges, observedEdges, totalEdges: hEdges.length, score },
  }
}

/* --- traces --------------------------------------------------------------- */
const OPS: Record<string, string> = {
  vmforge: 'POST /guardrails/evaluate',
  lightspeed: 'emit GuardrailsEvaluationRequestedEvent',
  'guardrails-client': 'invoke policy client',
  'bpe-mongo': 'find policy bundle',
  'guardrails-orchestrator': 'orchestrate decision',
  'opa-pod': 'POST /v1/data (decision)',
  'guardrails-registry': 'lookup policy',
  'opa-sandbox': 'sandbox eval',
}

const NAME_BY_ID = new Map(NODES.map((n) => [n.id, n.name]))

// Traffic reaches the platform from more than one entry point — VMForge over HTTP,
// Lightspeed via the event stream — so each trace picks its source.
const TRACE_ENTRIES = ['vmforge', 'lightspeed']
const TRACE_TAIL = [
  'guardrails-client',
  'bpe-mongo',
  'guardrails-orchestrator',
  'opa-pod',
  'guardrails-registry',
  'opa-sandbox',
]

function buildTrace(traceId: string): TraceDetail {
  const rand = seeded(traceId)
  const entry = TRACE_ENTRIES[Math.floor(rand() * TRACE_ENTRIES.length)]
  const path = [entry, ...TRACE_TAIL]
  let offset = 0
  const startedAt = new Date(Date.now() - Math.round(rand() * 3_600_000)).toISOString()
  const errored = rand() > 0.82
  const spans: Span[] = path.map((nodeId, i) => {
    const dur = Math.round(8 + rand() * (nodeId.startsWith('opa') ? 300 : 120))
    const start = offset
    offset += Math.round(dur * (0.3 + rand() * 0.5))
    const hasLogs = !nodeId.startsWith('opa') // OPA policy spans have no logs
    const status: Span['status'] = errored && i === path.length - 1 ? 'error' : 'ok'
    const logs: LogLine[] = hasLogs
      ? [
          { ts: startedAt, level: 'INFO', service: nodeId, message: `${OPS[nodeId] ?? 'handle'} started traceId=${traceId}` },
          {
            ts: startedAt,
            level: status === 'error' ? 'ERROR' : 'INFO',
            service: nodeId,
            message: status === 'error' ? `downstream declined (${dur}ms)` : `${OPS[nodeId] ?? 'handle'} ok (${dur}ms)`,
          },
        ]
      : []
    return {
      spanId: `${traceId}-s${i}`,
      parentSpanId: i === 0 ? undefined : `${traceId}-s${i - 1}`,
      nodeId,
      service: nodeId,
      op: OPS[nodeId] ?? 'handle',
      startOffsetMs: start,
      durationMs: dur,
      status,
      hasLogs,
      logs,
    }
  })
  return {
    traceId,
    startedAt,
    durationMs: offset + 40,
    status: errored ? 'error' : 'ok',
    spans,
  }
}

function buildTraceSummaries(component: string, limit: number): TraceSummary[] {
  const rand = seeded(resolveCenter(component) + ':traces')
  return Array.from({ length: limit }, (_, i) => {
    const traceId = `trc-gr-${(1000 + Math.round(rand() * 8999)).toString(16)}${i}`
    const detail = buildTrace(traceId)
    return {
      traceId,
      entryService: NAME_BY_ID.get(detail.spans[0].nodeId) ?? detail.spans[0].service,
      startedAt: detail.startedAt,
      durationMs: detail.durationMs,
      status: detail.status,
      spanCount: detail.spans.length,
      hasLogGaps: detail.spans.some((s) => !s.hasLogs),
    }
  }).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
}

/* --- live flow feed (used by useFlowStream in demo mode) ------------------- */
type FlowHop = { id: string; source: string; target: string; kind: EdgeKind }
type DemoFlowRoute = { origin: string; hops: FlowHop[] }

/**
 * Coherent flows walked from the topology, mirroring the backend: each route follows real
 * observed edges out of an entry point, and a synchronous request never fans out onto the
 * Kafka event bus — so a VMForge flow never reaches Kafka or Lightspeed.
 */
// Derived, not hardcoded (mirrors backend TopologyFixture.entryPoints): a service that emits calls
// but receives no synchronous inbound is an entry point — it may still get async (Kafka) responses.
const FLOW_ENTRY_POINTS: string[] = (() => {
  const hasOutbound = new Set(EDGE_DEFS.map(([s]) => s))
  const hasSyncInbound = new Set(EDGE_DEFS.filter(([, , k]) => k !== 'kafka').map(([, t]) => t))
  return NODES.filter(
    (n) => n.kind === 'service' && hasOutbound.has(n.id) && !hasSyncInbound.has(n.id),
  ).map((n) => n.id)
})()

const FLOW_ROUTES: DemoFlowRoute[] = (() => {
  const observed = EDGE_DEFS.filter(([s, t]) => !SILENT_EDGES.has(`${s}->${t}`))
  const out = new Map<string, FlowHop[]>()
  observed.forEach(([source, target, kind]) => {
    const hop: FlowHop = { id: `${source}->${target}`, source, target, kind }
    if (out.has(source)) out.get(source)!.push(hop)
    else out.set(source, [hop])
  })
  const walk = (entry: string): FlowHop[] => {
    const ordered: FlowHop[] = []
    const seen = new Set<string>([entry])
    let frontier = [{ id: entry, async: false }]
    let origin = true
    while (frontier.length) {
      const next: { id: string; async: boolean }[] = []
      for (const f of frontier) {
        for (const hop of out.get(f.id) ?? []) {
          const kafka = hop.kind === 'kafka'
          if (!origin && !f.async && kafka) continue
          ordered.push(hop)
          if (!seen.has(hop.target)) {
            seen.add(hop.target)
            next.push({ id: hop.target, async: f.async || kafka })
          }
        }
      }
      frontier = next
      origin = false
    }
    return ordered
  }
  const routes: DemoFlowRoute[] = []
  for (const entry of FLOW_ENTRY_POINTS) {
    const hops = walk(entry)
    if (hops.length) routes.push({ origin: entry, hops })
  }
  return routes
})()

/** Flow membership per origin — mirrors the backend /flows endpoint for demo mode. */
function buildFlows(): FlowRoute[] {
  return FLOW_ROUTES.map((r) => {
    const nodes = new Set<string>([r.origin])
    const edgeIds: string[] = []
    r.hops.forEach((h) => {
      nodes.add(h.source)
      nodes.add(h.target)
      edgeIds.push(h.id)
    })
    return { origin: r.origin, nodes: [...nodes], edgeIds }
  })
}

// REST endpoints per service — mirrors backend TopologyFixture.ENDPOINTS.
const ENDPOINTS: Record<string, string[]> = {
  'guardrails-orchestrator': [
    'POST /v1/evaluate',
    'POST /v1/policies/decide',
    'POST /v1/guardrails/batch-evaluate',
    'GET /v1/health',
  ],
  'guardrails-client': ['POST /v1/guardrails/invoke', 'GET /v1/status'],
  'guardrails-registry': ['GET /v1/policies/{id}', 'PUT /v1/policies', 'GET /v1/health'],
  'guardrails-studio': ['GET /v1/studio/policies'],
  'opa-pod': ['POST /v1/data'],
  'opa-sandbox': ['POST /v1/data/sandbox'],
}

// Per-endpoint downstream edges — mirrors backend TopologyFixture.ENDPOINT_DOWNSTREAM.
const ENDPOINT_DOWNSTREAM: Record<string, Record<string, string[]>> = {
  'guardrails-orchestrator': {
    'POST /v1/evaluate': ['guardrails-orchestrator->opa-pod', 'guardrails-orchestrator->bpe-mongo'],
    'POST /v1/policies/decide': ['guardrails-orchestrator->opa-pod'],
    'POST /v1/guardrails/batch-evaluate': [
      'guardrails-orchestrator->opa-pod',
      'guardrails-orchestrator->bpe-mongo',
    ],
    'GET /v1/health': [],
  },
}

// Request path from each original invoker (entry point) into a node — channel-correct BFS,
// mirrors backend TopologyFixture.upstreamEdges.
function upstreamEdges(target: string): string[] {
  const out = new Map<string, FlowHop[]>()
  EDGE_DEFS.forEach(([source, tgt, kind]) => {
    const hop: FlowHop = { id: `${source}->${tgt}`, source, target: tgt, kind }
    if (out.has(source)) out.get(source)!.push(hop)
    else out.set(source, [hop])
  })
  const collected = new Set<string>()
  for (const entry of FLOW_ENTRY_POINTS) {
    const parent = new Map<string, FlowHop>()
    const seen = new Set<string>([entry])
    const queue: { id: string; async: boolean }[] = [{ id: entry, async: false }]
    while (queue.length) {
      const f = queue.shift()!
      const isOrigin = f.id === entry
      for (const e of out.get(f.id) ?? []) {
        const kafka = e.kind === 'kafka'
        if (!isOrigin && !f.async && kafka) continue
        if (!seen.has(e.target)) {
          seen.add(e.target)
          parent.set(e.target, e)
          queue.push({ id: e.target, async: f.async || kafka })
        }
      }
    }
    let cur = target
    while (parent.has(cur)) {
      const e = parent.get(cur)!
      collected.add(e.id)
      cur = e.source
    }
  }
  return [...collected]
}

function buildEndpointFlows(nodeId: string): EndpointFlow[] {
  const upstream = upstreamEdges(nodeId)
  return (ENDPOINTS[nodeId] ?? []).map((endpoint) => {
    const edgeIds = [...new Set([...upstream, ...(ENDPOINT_DOWNSTREAM[nodeId]?.[endpoint] ?? [])])]
    const nodes = new Set<string>([nodeId])
    edgeIds.forEach((e) => {
      const i = e.indexOf('->')
      if (i >= 0) {
        nodes.add(e.slice(0, i))
        nodes.add(e.slice(i + 2))
      }
    })
    return { endpoint, nodes: [...nodes], edgeIds }
  })
}

// OpenAPI docs per endpoint — mirrors backend TopologyFixture.ENDPOINT_DOCS.
const ENDPOINT_DOCS: Record<string, Record<string, { summary: string; body: string | null }>> = {
  'guardrails-orchestrator': {
    'POST /v1/evaluate': {
      summary: 'Evaluate a policy request end-to-end (bundle lookup + OPA decision).',
      body: '{\n  "subject": "vmforge-deploy-7f3",\n  "action": "deploy",\n  "resource": "cluster/prod-eu1",\n  "policyBundle": "guardrails/base",\n  "context": { "env": "prod", "region": "eu-west-1" }\n}',
    },
    'POST /v1/policies/decide': {
      summary: 'Single policy decision without bundle resolution.',
      body: '{\n  "subject": "lightspeed-batch-42",\n  "action": "publish",\n  "resource": "topic/lightspeed-events"\n}',
    },
    'POST /v1/guardrails/batch-evaluate': {
      summary: 'Evaluate a batch of policy requests in one round-trip.',
      body: '{\n  "requests": [\n    { "subject": "svc-a", "action": "read", "resource": "vault/creds" },\n    { "subject": "svc-b", "action": "write", "resource": "bucket/exports" }\n  ]\n}',
    },
    'GET /v1/health': { summary: 'Liveness/readiness probe.', body: null },
  },
  'guardrails-client': {
    'POST /v1/guardrails/invoke': {
      summary: 'Invoke a guardrails evaluation on behalf of a caller.',
      body: '{\n  "caller": "vmforge",\n  "request": { "subject": "deploy-7f3", "action": "deploy" }\n}',
    },
    'GET /v1/status': { summary: 'Client liveness and queue depth.', body: null },
  },
  'guardrails-registry': {
    'GET /v1/policies/{id}': { summary: 'Fetch a policy bundle by id.', body: null },
    'PUT /v1/policies': {
      summary: 'Create or update a policy bundle.',
      body: '{\n  "id": "guardrails/base",\n  "version": "1.25.0",\n  "rego": "package guardrails\\n\\ndefault allow = false"\n}',
    },
    'GET /v1/health': { summary: 'Liveness/readiness probe.', body: null },
  },
  'opa-pod': {
    'POST /v1/data': {
      summary: 'OPA data API — evaluate the guardrails/allow rule.',
      body: '{\n  "input": { "subject": "vmforge-deploy-7f3", "action": "deploy", "resource": "cluster/prod-eu1" }\n}',
    },
  },
  'opa-sandbox': {
    'POST /v1/data/sandbox': {
      summary: 'Sandboxed OPA evaluation for policy authoring.',
      body: '{\n  "input": { "subject": "studio-preview", "action": "evaluate" }\n}',
    },
  },
  'guardrails-studio': {
    'GET /v1/studio/policies': { summary: 'List policies for the authoring UI.', body: null },
  },
}

function buildOpenApi(nodeId: string): ApiOperation[] {
  return (ENDPOINTS[nodeId] ?? []).map((ep) => {
    const sp = ep.indexOf(' ')
    const doc = ENDPOINT_DOCS[nodeId]?.[ep]
    return {
      method: sp > 0 ? ep.slice(0, sp) : 'GET',
      path: sp > 0 ? ep.slice(sp + 1) : ep,
      summary: doc?.summary ?? '',
      requestBodyExample: doc?.body ?? null,
    }
  })
}

function endpointFor(hop: FlowHop, traceId: string): string | undefined {
  if (hop.kind !== 'http') return undefined
  const eps = ENDPOINTS[hop.target]
  if (!eps || eps.length === 0) return undefined
  let h = 0
  const key = traceId + hop.target
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return eps[Math.abs(h) % eps.length]
}

export function nextFlowEvent(_center: string, seq: number): FlowEvent {
  const route = FLOW_ROUTES[seq % FLOW_ROUTES.length]
  const pass = Math.floor(seq / FLOW_ROUTES.length)
  const hop = route.hops[pass % route.hops.length]
  const rand = seeded('flow:' + seq)
  const error = rand() < 0.04
  const traceId = `trc-live-${route.origin}-${Math.floor(pass / route.hops.length)}`
  return {
    id: `flw-${seq}`,
    traceId,
    origin: route.origin,
    source: hop.source,
    target: hop.target,
    endpoint: endpointFor(hop, traceId),
    edgeKind: hop.kind,
    status: error ? 'error' : 'ok',
    latencyMs: Math.max(4, Math.round(60 * (0.4 + rand()))),
    ts: new Date().toISOString(),
  }
}

/* --- actions -------------------------------------------------------------- */
function buildSynthetic(traceId: string, node?: string, endpoint?: string): SyntheticTest {
  // when the observed call names its endpoint, generate the payload from the OpenAPI spec
  if (node && endpoint) {
    const sp = endpoint.indexOf(' ')
    const method = sp > 0 ? endpoint.slice(0, sp) : 'GET'
    const path = sp > 0 ? endpoint.slice(sp + 1) : endpoint
    const doc = ENDPOINT_DOCS[slug(node)]?.[endpoint]
    const body = doc?.body ?? ''
    const bodyFlag = body ? ` \\\n        -d '${body.replace(/\s+/g, ' ')}'` : ''
    const yaml = [
      'version: 0.1',
      `name: replay-${path.replace(/\//g, '-').replace(/^-/, '')}`,
      'runson: hyperexecute',
      'autosplit: true',
      'testSuites:',
      `  - name: replay-${traceId}`,
      '    command: |',
      `      curl -sS -X ${method} "$BASE_URL${path}" \\`,
      '        -H "Content-Type: application/json" \\',
      `        -H "x-atlas-replay: ${traceId}"${bodyFlag}`,
      '    assert:',
      '      - status == 200',
      '      - responseTime < 800',
    ].join('\n')
    return {
      id: `syn-${traceId}`,
      name: `Replay of ${traceId}`,
      method,
      path,
      headers: { 'Content-Type': 'application/json', 'x-atlas-replay': traceId },
      body,
      summary: doc
        ? `Payload reconstructed from the OpenAPI spec DeepWiki extracted for ${node}. Runs on HyperExecute as an autosplit synthetic that replays the request and asserts a 200 under 800ms.`
        : `Payload reconstructed from the observed call (no OpenAPI spec found for this endpoint).`,
      hyperExecuteYaml: yaml,
    }
  }

  const body = JSON.stringify({ subject: 'vmforge', action: 'deploy', policyBundle: 'guardrails/base' }, null, 2)
  const yaml = [
    'version: 0.1',
    'name: guardrails-evaluate-happy-path',
    'runson: hyperexecute',
    'autosplit: true',
    'testSuites:',
    `  - name: replay-${traceId}`,
    '    command: |',
    '      curl -sS -X POST "$BASE_URL/guardrails/evaluate" \\',
    '        -H "Content-Type: application/json" \\',
    `        -H "x-atlas-replay: ${traceId}" \\`,
    "        -d '{\"subject\":\"vmforge\",\"action\":\"deploy\",\"policyBundle\":\"guardrails/base\"}'",
    '    assert:',
    '      - status == 200',
    '      - responseTime < 800',
  ].join('\n')
  return {
    id: `syn-${traceId}`,
    name: `Replay of ${traceId}`,
    method: 'POST',
    path: '/guardrails/evaluate',
    headers: { 'Content-Type': 'application/json', 'x-atlas-replay': traceId },
    body,
    summary:
      'Reconstructed from the trace entry span. Runs on HyperExecute as an autosplit synthetic that replays the policy-evaluation request and asserts a 200 under 800ms.',
    hyperExecuteYaml: yaml,
  }
}

function buildEnhancement(component: string): EnhancementPlan {
  const s = slug(component)
  const owned = NODES.find((n) => n.id === s)?.app === OUR_APP

  // stay consistent with the map: only propose a fix when this component actually
  // has an outgoing live edge with no logs (the amber dashes in the graph)
  const gapTargets = [...MISSING_LOG_EDGES]
    .filter((id) => id.startsWith(`${s}->`))
    .map((id) => {
      const target = id.slice(id.indexOf('->') + 2)
      return NAME_BY_ID.get(target) ?? target
    })

  if (gapTargets.length === 0) {
    return {
      component,
      owned,
      summary: `No logging gaps detected — every live call edge leaving ${component} already lands in Splunk.`,
      rationale: ['All observed outbound edges have correlated log events.'],
      diff: '',
      suggestedAlerts: [],
    }
  }

  const targets = gapTargets.join(', ')
  const diff = [
    `--- a/src/main/java/com/acme/${s}/OpaPolicyClient.java`,
    `+++ b/src/main/java/com/acme/${s}/OpaPolicyClient.java`,
    '@@ caller: propagate the trace id in the headers and log it',
    ' public Mono<Decision> decide(PolicyRequest req) {',
    '+    String traceparent = tracer.currentTraceparent();',
    '+    log.info("opa.decide.request traceId={} subject={}", tracer.currentTraceId(), req.subject());',
    '     return opaWebClient.post()',
    '         .uri("/v1/data/guardrails/allow")',
    '+        .header("traceparent", traceparent)',
    '         .bodyValue(req)',
    '         .retrieve()',
    '         .bodyToMono(Decision.class)',
    '+        .doOnNext(d -> log.info("opa.decide.response traceId={} allow={}", tracer.currentTraceId(), d.allow()));',
    ' }',
    '',
    '--- a/receiver: log the propagated trace id on arrival',
    '+++ b/src/main/java/.../TraceLogFilter.java',
    '@@ receiver: read traceparent from the headers and log it',
    '+public Mono<Void> filter(ServerWebExchange ex, WebFilterChain chain) {',
    '+    String traceId = TraceContext.from(ex.getRequest().getHeaders().getFirst("traceparent"));',
    '+    log.info("request.received traceId={} path={}", traceId, ex.getRequest().getPath());',
    '+    return chain.filter(ex);',
    '+}',
  ].join('\n')
  return {
    component,
    owned,
    summary: `${component} → ${targets} is missing structured logs on the policy-decision path. Propagate the trace id in the request headers and log it on both sides, so the same id shows up in both services' logs.`,
    rationale: [
      `DeepWiki shows a live call edge to ${targets}, but Splunk has zero correlated log events for it.`,
      'Carrying the trace id in the headers (W3C traceparent) and logging it on both the caller and the receiver makes every call correlate in Splunk — the same evidence Atlas uses to mark a link healthy.',
      'Once both sides log the id, this edge flips from amber to a solid grey hairline.',
    ],
    diff,
    suggestedAlerts: [
      'grafana: p95(opa.decide) > 400ms for 5m → page #guardrails-oncall',
      'grafana: rate(opa.decide.error) > 2% for 10m → warn #guardrails-oncall',
    ],
  }
}

function buildWiki(nodeId: string): WikiDoc {
  const rand = seeded(nodeId + ':wiki')
  const spec = NODES.find((n) => n.id === nodeId)
  const pretty = spec?.name ?? nodeId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const langs = ['Java 21 · Spring WebFlux', 'Kotlin · Ktor', 'Go 1.22', 'Node · NestJS']
  const lang = langs[Math.floor(rand() * langs.length)]
  const lower = pretty.toLowerCase()
  const eps = ENDPOINTS[nodeId] ?? []
  const endpointsBody =
    eps.length === 0
      ? 'No HTTP surface — this component is reached over Kafka / as a data store.'
      : eps.map((e) => `• ${e}`).join('\n')
  return {
    nodeId,
    title: pretty,
    sourceRepo: `github.com/acme/${nodeId}`,
    generatedAt: new Date(Date.now() - Math.round(rand() * 6) * 86_400_000).toISOString(),
    tags: [lang.split(' · ')[0], 'reactive', 'owned by #guardrails'],
    pages: [
      {
        title: 'Overview',
        summary: `${pretty} is a ${lang} component in the Guardrails platform. This wiki was generated by Devin from the repository source, commit history, and runtime traces.`,
        sections: [
          { heading: 'Purpose', body: `Owns the ${lower} bounded context — policy evaluation, bundle management and orchestration of OPA decisions.` },
          { heading: 'Tech Stack', body: `Built with ${lang}. Stateless and horizontally scaled behind the service mesh; configuration via Spring profiles per environment.` },
          { heading: 'Repository Layout', body: 'adapters/{inbound,outbound} · application · domain · ports — a vertical-slice hexagonal structure, one package per capability.' },
        ],
      },
      {
        title: 'Architecture',
        summary: `How ${pretty} is structured internally and how a request flows through it.`,
        sections: [
          { heading: 'Request Lifecycle', body: '1. Inbound adapter validates and maps the request\n2. The use case joins policy state with the OPA decision\n3. Outbound adapters call downstream stores and services\n4. The response is assembled and traced end-to-end' },
          { heading: 'Concurrency Model', body: 'Fully reactive (Project Reactor). No blocking calls on the event loop; downstream I/O is non-blocking and back-pressured.' },
        ],
      },
      {
        title: 'API Reference',
        summary: `HTTP endpoints ${pretty} exposes, extracted from the routing layer.`,
        sections: [
          { heading: 'Endpoints', body: endpointsBody },
          { heading: 'Conventions', body: 'JSON over HTTP/2. W3C traceparent propagated on every call. Errors use RFC-7807 problem+json.' },
        ],
      },
      {
        title: 'Data & Ownership',
        summary: `What state ${pretty} owns and how it persists it.`,
        sections: [
          { heading: 'Owned Data', body: 'Reads and writes policy bundles in BPE Mongo DB. Never writes to another service’s store; policy decisions are delegated to OPA.' },
          { heading: 'Consistency', body: 'Bundle writes are idempotent and versioned; readers tolerate eventual propagation across replicas.' },
        ],
      },
      {
        title: 'Dependencies',
        summary: `Downstream components ${pretty} calls at runtime.`,
        sections: [
          { heading: 'Downstream', body: '• BPE Mongo DB (Mongo) — policy bundle storage\n• OPA Pod / Sandbox OPA (HTTP) — policy decisions\n• Guardrails Client (HTTP) — evaluation chain\n• lightspeed-events (Kafka) — inbound event stream' },
        ],
      },
      {
        title: 'Observability',
        summary: `Signals ${pretty} emits and the known gaps.`,
        sections: [
          { heading: 'Telemetry', body: 'Metrics to Grafana, traces to SPLOC, logs to Splunk — correlated by trace id.' },
          { heading: 'Known Gaps', body: 'NOTE: the OPA policy-decision call path is missing structured logs — see the Atlas missing-link finding and the suggested enhancement.' },
        ],
      },
    ],
  }
}

function buildMetrics(nodeId: string): NodeMetrics {
  const rand = seeded(nodeId + ':metrics')
  const now = Date.now()
  const points = (base: number, jitter: number) =>
    Array.from({ length: 30 }, (_, i) => ({
      ts: new Date(now - (29 - i) * 60_000).toISOString(),
      value: Number((base + (rand() - 0.5) * jitter).toFixed(2)),
    }))
  return {
    nodeId,
    requestRate: points(420, 260),
    errorRate: points(0.8, 1.2).map((p) => ({ ...p, value: Math.max(0, p.value) })),
    p95Latency: points(120, 90).map((p) => ({ ...p, value: Math.max(4, p.value) })),
  }
}

/** Searchable components — mirror the backend ALL_COMPONENTS (services, not infra/topics). */
const SEARCHABLE_IDS = new Set([
  'guardrails-orchestrator', 'guardrails-client', 'guardrails-registry',
  'guardrails-studio', 'lightspeed', 'vmforge',
])
const SEARCHABLE = NODES.filter((n) => SEARCHABLE_IDS.has(n.id))

const wait = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 120 + Math.random() * 180))

export const demo = {
  searchComponents: (q: string): Promise<ComponentSummary[]> =>
    wait(
      SEARCHABLE.filter((n) => n.name.toLowerCase().includes(q.toLowerCase())).map((n) => ({
        id: n.id,
        name: n.name,
        kind: n.kind,
        app: n.app,
        owned: n.app === OUR_APP,
      })),
    ),
  graph: (name: string, rev?: string) => wait(buildGraph(name, rev)),
  healthMap: (name: string, rev?: string) => wait(buildHealthMap(name, rev)),
  nodeMetrics: (nodeId: string) => wait(buildMetrics(nodeId)),
  nodeWiki: (nodeId: string) => wait(buildWiki(nodeId)),
  nodeEndpoints: (nodeId: string) => wait(buildEndpointFlows(nodeId)),
  nodeOpenApi: (nodeId: string): Promise<ApiOperation[]> => wait(buildOpenApi(nodeId)),
  traces: (component: string, limit: number) => wait(buildTraceSummaries(component, limit)),
  trace: (traceId: string) => wait(buildTrace(traceId)),
  flows: (_component: string, _rev?: string) => wait(buildFlows()),
  revisions: (component: string): Promise<RepoRevisions> => {
    const repo = `registry.internal/${slug(component)}`
    return wait({
      environments: [
        { env: 'prod', commitHash: '9f8e7d6', image: `${repo}:1.24.0` },
        { env: 'test', commitHash: 'e4f5a6b', image: `${repo}:test-e4f5a6b` },
        { env: 'dev', commitHash: 'a1b2c3d', image: `${repo}:dev-a1b2c3d` },
      ],
      commits: [
        { hash: '3c1aa90', message: 'wip: batch-evaluate concurrency', deployedEnv: null },
        { hash: 'a1b2c3d', message: 'feat: sandbox OPA policy cache', deployedEnv: 'dev' },
        { hash: 'e4f5a6b', message: 'fix: null policy-bundle handling', deployedEnv: 'test' },
        { hash: '9f8e7d6', message: 'release: guardrails 1.24.0', deployedEnv: 'prod' },
        { hash: '77d0c12', message: 'chore: bump spring-boot 3.4.1', deployedEnv: null },
      ],
    })
  },
  syntheticFromTrace: (traceId: string, node?: string, endpoint?: string) =>
    wait(buildSynthetic(traceId, node, endpoint)),
  enhancement: (component: string) => wait(buildEnhancement(component)),
}
