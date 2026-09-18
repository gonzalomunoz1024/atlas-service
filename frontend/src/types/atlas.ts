/* ============================================================================
   Atlas domain contract — kept in lockstep with the backend DTOs
   (com.atlas.dashboard.*.domain.dto).
   ========================================================================== */

export type NodeKind = 'service' | 'kafka' | 'database' | 'store' | 'cache' | 'external'
export type Health = 'healthy' | 'degraded' | 'critical' | 'unknown'
export type EdgeKind = 'http' | 'grpc' | 'kafka' | 'db' | 'mongo' | 'cache'

/** How a link behaves once topology is joined with observed traffic + logs. */
export type LinkStatus = 'healthy' | 'missing_logs' | 'silent'

/**
 * How Splunk logs prove observed traffic: the source logged the request+response
 * round trip, or the source's trace id appears in the receiver's logs.
 */
export type LogEvidence = 'source_round_trip' | 'trace_correlated' | 'none'

export interface ComponentSummary {
  id: string
  name: string
  kind: NodeKind
  app?: string
  owned: boolean
}

export interface ComponentNode {
  id: string
  name: string
  kind: NodeKind
  /** Owning application id (TAP = ours; CLAUT, BPE = external). */
  app?: string
  /** For Kafka topics, the cluster the topic lives on. */
  cluster?: string
  owned: boolean
  health: Health
  center?: boolean
}

export interface DependencyEdge {
  id: string
  source: string
  target: string
  kind: EdgeKind
}

export interface ComponentGraph {
  center: string
  nodes: ComponentNode[]
  edges: DependencyEdge[]
}

export interface HealthEdge extends DependencyEdge {
  observed: boolean
  hasLogs: boolean
  logEvidence: LogEvidence
  linkStatus: LinkStatus
  callsPerMin: number
  errorRate: number
  p95LatencyMs: number
}

export interface CoverageScore {
  loggedEdges: number
  observedEdges: number
  totalEdges: number
  /** 0..100 — share of observed edges that also have logs. */
  score: number
}

export interface HealthMap {
  center: string
  nodes: ComponentNode[]
  edges: HealthEdge[]
  coverage: CoverageScore
}

export type FlowStatus = 'ok' | 'error'

/** A coherent flow's membership: which nodes/edges belong to the flow from `origin`. */
export interface FlowRoute {
  origin: string
  nodes: string[]
  edgeIds: string[]
}

/** One operation from a service's OpenAPI spec (via DeepWiki). */
export interface ApiOperation {
  method: string
  path: string
  summary: string
  requestBodyExample?: string | null
}

/** A REST endpoint plus the downstream sub-flow it triggers (from DeepWiki). */
export interface EndpointFlow {
  endpoint: string
  nodes: string[]
  edgeIds: string[]
}

/** A deployed environment: the commit + container image currently running there. */
export interface DeployEnvironment {
  env: string
  commitHash: string
  image: string
}

/** A recent commit; `deployedEnv` names the environment running it, or null if none. */
export interface CommitRef {
  hash: string
  message: string
  deployedEnv: string | null
}

/** Revisions a repo's map can be viewed at: deployed environments + recent commits. */
export interface RepoRevisions {
  environments: DeployEnvironment[]
  commits: CommitRef[]
}

export interface FlowEvent {
  id: string
  traceId: string
  /** entry node the flow originated from (used to filter the live overlay by source) */
  origin?: string
  source: string
  target: string
  /** REST endpoint invoked on the target service, when the call is HTTP */
  endpoint?: string
  edgeKind: EdgeKind
  status: FlowStatus
  latencyMs: number
  ts: string
}

export type SpanStatus = 'ok' | 'error'

export interface LogLine {
  ts: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  service: string
  message: string
}

export interface Span {
  spanId: string
  parentSpanId?: string
  nodeId: string
  service: string
  op: string
  startOffsetMs: number
  durationMs: number
  status: SpanStatus
  hasLogs: boolean
  logs: LogLine[]
}

export interface TraceSummary {
  traceId: string
  entryService: string
  startedAt: string
  durationMs: number
  status: SpanStatus
  spanCount: number
  hasLogGaps: boolean
}

export interface TraceDetail {
  traceId: string
  startedAt: string
  durationMs: number
  status: SpanStatus
  spans: Span[]
}

export interface SyntheticTest {
  id: string
  name: string
  method: string
  path: string
  headers: Record<string, string>
  body: string
  summary: string
  hyperExecuteYaml: string
}

export interface EnhancementPlan {
  component: string
  owned: boolean
  summary: string
  rationale: string[]
  diff: string
  suggestedAlerts: string[]
}

/** DeepWiki-generated documentation for a node (rendered in the node modal). */
export interface WikiSection {
  heading: string
  body: string
}

export interface WikiDoc {
  nodeId: string
  title: string
  sourceRepo: string
  generatedAt: string
  pages: WikiPage[]
  tags: string[]
}

export interface WikiPage {
  title: string
  summary: string
  sections: WikiSection[]
}

export interface MetricPoint {
  ts: string
  value: number
}

export interface NodeMetrics {
  nodeId: string
  requestRate: MetricPoint[]
  errorRate: MetricPoint[]
  p95Latency: MetricPoint[]
}
