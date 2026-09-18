import type {
  ApiOperation,
  ComponentGraph,
  ComponentSummary,
  EndpointFlow,
  EnhancementPlan,
  FlowRoute,
  HealthMap,
  RepoRevisions,
  NodeMetrics,
  SyntheticTest,
  TraceDetail,
  TraceSummary,
  WikiDoc,
} from '../types/atlas'
import { DEMO_MODE, demo } from './demo'

const revQuery = (rev?: string) => (rev ? `?rev=${encodeURIComponent(rev)}` : '')

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return (await res.json()) as T
}

async function post<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
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

  /** earliest/latest are Splunk time modifiers ("-15m", "now", ISO instant) — the query is Splunk's. */
  traces: (component: string, limit = 12, rev?: string, earliest?: string, latest?: string): Promise<TraceSummary[]> =>
    DEMO_MODE
      ? demo.traces(component, limit, rev, earliest, latest)
      : get(
          `/v1/traces?component=${encodeURIComponent(component)}&limit=${limit}` +
            (rev ? `&rev=${encodeURIComponent(rev)}` : '') +
            (earliest ? `&earliest=${encodeURIComponent(earliest)}` : '') +
            (latest ? `&latest=${encodeURIComponent(latest)}` : ''),
        ),

  trace: (traceId: string): Promise<TraceDetail> =>
    DEMO_MODE ? demo.trace(traceId) : get(`/v1/traces/${encodeURIComponent(traceId)}`),

  flows: (component: string, rev?: string): Promise<FlowRoute[]> =>
    DEMO_MODE
      ? demo.flows(component, rev)
      : get(`/v1/components/${encodeURIComponent(component)}/flows${revQuery(rev)}`),

  revisions: (component: string): Promise<RepoRevisions> =>
    DEMO_MODE ? demo.revisions(component) : get(`/v1/components/${encodeURIComponent(component)}/revisions`),

  syntheticFromTrace: (
    traceId: string,
    opts?: { node?: string; endpoint?: string },
  ): Promise<SyntheticTest> =>
    DEMO_MODE
      ? demo.syntheticFromTrace(traceId, opts?.node, opts?.endpoint)
      : post(
          `/v1/synthetics/from-trace/${encodeURIComponent(traceId)}` +
            (opts?.node && opts?.endpoint
              ? `?node=${encodeURIComponent(opts.node)}&endpoint=${encodeURIComponent(opts.endpoint)}`
              : ''),
        ),

  nodeOpenApi: (name: string, nodeId: string): Promise<ApiOperation[]> =>
    DEMO_MODE
      ? demo.nodeOpenApi(nodeId)
      : get(`/v1/components/${encodeURIComponent(name)}/nodes/${encodeURIComponent(nodeId)}/openapi`),

  enhancement: (component: string): Promise<EnhancementPlan> =>
    DEMO_MODE ? demo.enhancement(component) : post(`/v1/enhancements/${encodeURIComponent(component)}`),

  errorRateEnhancement: (component: string, target: string): Promise<EnhancementPlan> =>
    DEMO_MODE
      ? demo.errorRateEnhancement(component, target)
      : post(
          `/v1/enhancements/${encodeURIComponent(component)}/error-rate?target=${encodeURIComponent(target)}`,
        ),
}
