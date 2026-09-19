import type {
  AlertPlan,
  ApiOperation,
  BlastRadius,
  EndpointStat,
  SafeguardOption,
  SilentEdgeFinding,
  TraceInvocation,
  ClusterDeployment,
  EdgeHealthStatus,
  ComponentGraph,
  ComponentSummary,
  EndpointFlow,
  EnhancementPlan,
  FlowRoute,
  HealthMap,
  RepoRevisions,
  NodeMetrics,
  GeneratedTest,
  TestType,
  TraceDetail,
  TraceSummary,
  WikiDoc,
} from '../types/atlas'
import { DEMO_MODE, demo } from './demo'

const revQuery = (rev?: string) => (rev ? `?rev=${encodeURIComponent(rev)}` : '')

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`)
  return (await res.json()) as T
}

async function post<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`)
  return (await res.json()) as T
}

/**
 * Every call routes through the mock generator when running in demo mode (?demo or
 * VITE_DEMO_MODE), so the whole app works standalone with the backend down — a
 * funder-safe fallback. Otherwise it hits the real WebFlux API via the Vite proxy.
 */
export const api = {
  searchComponents: (q: string): Promise<ComponentSummary[]> =>
    DEMO_MODE ? demo.searchComponents(q) : get(`/v1/components/search?q=${encodeURIComponent(q)}`),

  graph: (name: string, rev?: string): Promise<ComponentGraph> =>
    DEMO_MODE ? demo.graph(name, rev) : get(`/v1/components/${encodeURIComponent(name)}/graph${revQuery(rev)}`),

  /** Windowed error rate per edge, judged against the threshold server-side. */
  edgeHealth: (
    component: string,
    rev?: string,
    windowMin = 15,
    thresholdPct = 10,
  ): Promise<EdgeHealthStatus[]> =>
    DEMO_MODE
      ? demo.edgeHealth(component, rev, windowMin, thresholdPct)
      : get(
          `/v1/components/${encodeURIComponent(component)}/edge-health?windowMin=${windowMin}&thresholdPct=${thresholdPct}` +
            (rev ? `&rev=${encodeURIComponent(rev)}` : ''),
        ),

  /** maxDepth limits the map to N hops from the center — scoped & re-scored server-side. */
  healthMap: (name: string, rev?: string, maxDepth?: number): Promise<HealthMap> => {
    if (DEMO_MODE) return demo.healthMap(name, rev, maxDepth)
    const params = new URLSearchParams()
    if (rev) params.set('rev', rev)
    if (maxDepth != null) params.set('maxDepth', String(maxDepth))
    const q = params.toString()
    return get(`/v1/components/${encodeURIComponent(name)}/health-map${q ? `?${q}` : ''}`)
  },

  nodeMetrics: (name: string, nodeId: string): Promise<NodeMetrics> =>
    DEMO_MODE
      ? demo.nodeMetrics(nodeId)
      : get(`/v1/components/${encodeURIComponent(name)}/nodes/${encodeURIComponent(nodeId)}/metrics`),

  nodeWiki: (name: string, nodeId: string): Promise<WikiDoc> =>
    DEMO_MODE
      ? demo.nodeWiki(nodeId)
      : get(`/v1/components/${encodeURIComponent(name)}/nodes/${encodeURIComponent(nodeId)}/wiki`),

  nodeEndpoints: (name: string, nodeId: string): Promise<EndpointFlow[]> =>
    DEMO_MODE
      ? demo.nodeEndpoints(nodeId)
      : get(`/v1/components/${encodeURIComponent(name)}/nodes/${encodeURIComponent(nodeId)}/endpoints`),

  /** earliest/latest are Splunk time modifiers; edge scopes to traces crossing that hop (server rule). */
  traces: (component: string, limit = 12, rev?: string, earliest?: string, latest?: string, edge?: string): Promise<TraceSummary[]> =>
    DEMO_MODE
      ? demo.traces(component, limit, rev, earliest, latest, edge)
      : get(
          `/v1/traces?component=${encodeURIComponent(component)}&limit=${limit}` +
            (rev ? `&rev=${encodeURIComponent(rev)}` : '') +
            (earliest ? `&earliest=${encodeURIComponent(earliest)}` : '') +
            (latest ? `&latest=${encodeURIComponent(latest)}` : '') +
            (edge ? `&edge=${encodeURIComponent(edge)}` : ''),
        ),

  /** Whether a trace's call path passes through a node — the safeguard eligibility fact. */
  traceInvokes: (traceId: string, nodeId: string): Promise<TraceInvocation> =>
    DEMO_MODE
      ? demo.traceInvokes(traceId, nodeId)
      : get(`/v1/traces/${encodeURIComponent(traceId)}/invokes/${encodeURIComponent(nodeId)}`),

  /** Transitive callers a failure at the node would hurt, scoped to the viewed depth. */
  blastRadius: (component: string, nodeId: string, rev?: string, maxDepth?: number): Promise<BlastRadius> => {
    if (DEMO_MODE) return demo.blastRadius(component, nodeId, rev, maxDepth)
    const params = new URLSearchParams()
    if (rev) params.set('rev', rev)
    if (maxDepth != null) params.set('maxDepth', String(maxDepth))
    const q = params.toString()
    return get(
      `/v1/components/${encodeURIComponent(component)}/nodes/${encodeURIComponent(nodeId)}/blast-radius${q ? `?${q}` : ''}`,
    )
  },

  /** Windowed per-endpoint traffic stats for a node — served, never client-derived. */
  endpointStats: (component: string, nodeId: string, windowMin = 15): Promise<EndpointStat[]> =>
    DEMO_MODE
      ? demo.endpointStats(nodeId, windowMin)
      : get(
          `/v1/components/${encodeURIComponent(component)}/nodes/${encodeURIComponent(nodeId)}/endpoint-stats?windowMin=${windowMin}`,
        ),

  /** The case file for a mapped-but-silent link. */
  silentEdgeFinding: (component: string, sourceId: string, targetId: string): Promise<SilentEdgeFinding> =>
    DEMO_MODE
      ? demo.silentEdgeFinding(component, sourceId, targetId)
      : post(
          `/v1/enhancements/${encodeURIComponent(component)}/silent-edge?source=${encodeURIComponent(sourceId)}&target=${encodeURIComponent(targetId)}`,
        ),

  /** Which safeguard kinds the platform can generate today (and which are coming). */
  safeguardCatalog: (): Promise<SafeguardOption[]> =>
    DEMO_MODE ? demo.safeguardCatalog() : get('/v1/safeguards/catalog'),

  trace: (traceId: string): Promise<TraceDetail> =>
    DEMO_MODE ? demo.trace(traceId) : get(`/v1/traces/${encodeURIComponent(traceId)}`),

  flows: (component: string, rev?: string): Promise<FlowRoute[]> =>
    DEMO_MODE
      ? demo.flows(component, rev)
      : get(`/v1/components/${encodeURIComponent(component)}/flows${revQuery(rev)}`),

  revisions: (component: string): Promise<RepoRevisions> =>
    DEMO_MODE ? demo.revisions(component) : get(`/v1/components/${encodeURIComponent(component)}/revisions`),

  /** Generate a test from a trace — `type` picks the kind (synthetic today, performance later). */
  testFromTrace: (
    traceId: string,
    opts?: { node?: string; endpoint?: string; type?: TestType },
  ): Promise<GeneratedTest> =>
    DEMO_MODE
      ? demo.testFromTrace(traceId, opts?.node, opts?.endpoint, opts?.type ?? 'synthetic')
      : post(
          `/v1/tests/from-trace/${encodeURIComponent(traceId)}?type=${opts?.type ?? 'synthetic'}` +
            (opts?.node && opts?.endpoint
              ? `&node=${encodeURIComponent(opts.node)}&endpoint=${encodeURIComponent(opts.endpoint)}`
              : ''),
        ),

  nodeOpenApi: (name: string, nodeId: string): Promise<ApiOperation[]> =>
    DEMO_MODE
      ? demo.nodeOpenApi(nodeId)
      : get(`/v1/components/${encodeURIComponent(name)}/nodes/${encodeURIComponent(nodeId)}/openapi`),

  /** OpenShift cluster deployments for an app node (empty for non-app nodes). */
  nodeDeployments: (name: string, nodeId: string): Promise<ClusterDeployment[]> =>
    DEMO_MODE
      ? demo.nodeDeployments(nodeId)
      : get(`/v1/components/${encodeURIComponent(name)}/nodes/${encodeURIComponent(nodeId)}/deployments`),

  enhancement: (component: string): Promise<EnhancementPlan> =>
    DEMO_MODE ? demo.enhancement(component) : post(`/v1/enhancements/${encodeURIComponent(component)}`),

  /** Alert rules for Splunk/SPLOC derived from a trace's call path. */
  alertsFromTrace: (component: string, traceId: string): Promise<AlertPlan> =>
    DEMO_MODE
      ? demo.alertsFromTrace(component, traceId)
      : post(
          `/v1/alerts/from-trace/${encodeURIComponent(traceId)}?component=${encodeURIComponent(component)}`,
        ),

  errorRateEnhancement: (component: string, target: string): Promise<EnhancementPlan> =>
    DEMO_MODE
      ? demo.errorRateEnhancement(component, target)
      : post(
          `/v1/enhancements/${encodeURIComponent(component)}/error-rate?target=${encodeURIComponent(target)}`,
        ),
}
