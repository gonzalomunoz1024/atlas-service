/* ============================================================================
   Atlas domain contract — kept in lockstep with the backend DTOs
   (com.atlas.dashboard.*.domain.dto).
   ========================================================================== */

export type NodeKind = 'service' | 'queue' | 'database' | 'store' | 'cache' | 'external'
export type Health = 'healthy' | 'degraded' | 'critical' | 'unknown'
export type EdgeKind = 'http' | 'kafka' | 'mongo'

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

/** One OpenShift deployment of an application: which OCP cluster it runs on, and where. */
export interface ClusterDeployment {
  cluster: string
  env: string
  region: string
  namespace: string
  replicas: number
  status: string
}

/** One proposed alert rule; system is the platform it belongs to. */
export interface AlertRule {
  system: 'splunk' | 'sploc'
  name: string
  query: string
  rationale: string
}

/** Alert rules derived from a trace's call path — ready to create in Splunk / SPLOC. */
export interface AlertPlan {
  traceId: string
  summary: string
  /** the observability-as-code manifest declaring the rules — the reviewable artifact */
  manifestYaml: string
  rules: AlertRule[]
}

/** What a failure at a node would hurt: its transitive callers (self included). */
export interface BlastRadius {
  nodeId: string
  impactedNodeIds: string[]
}

/** Whether a trace's call path passes through a node (safeguard eligibility). */
export interface TraceInvocation {
  traceId: string
  nodeId: string
  invoked: boolean
}

/** Windowed traffic stats for one REST endpoint of a node. */
export interface EndpointStat {
  endpoint: string
  calls: number
  avgLatencyMs: number
  errorRatePct: number
}

/** The case file for a mapped-but-silent link. */
export interface SilentEdgeFinding {
  summary: string
  meanings: { title: string; body: string }[]
  nextSteps: string[]
}

/** One safeguard kind the platform can (or will) generate from a trace. */
export interface SafeguardOption {
  id: string
  group: 'testing' | 'observability'
  available: boolean
}

/** Server-judged live edge health: windowed error rate vs the configured threshold. */
export interface EdgeHealthStatus {
  edgeId: string
  ratePct: number
  status: 'ok' | 'error'
}

export interface CoverageScore {
  /** server-judged verdict band: good | warn | critical */
  band: 'good' | 'warn' | 'critical'
  loggedEdges: number
  observedEdges: number
  totalEdges: number
  /** 0..100 — share of observed edges that also have logs. */
  score: number
}

/** Server-judged map facts the UI must not re-derive. */
export interface MapInsights {
  gapTouchedNodeIds: string[]
  gapSourceNodeIds: string[]
  centerEdgeIds: string[]
  /** flagged edges, worst first (missing logs before silent) */
  flaggedEdgeIds: string[]
}

export interface HealthMap {
  center: string
  nodes: ComponentNode[]
  edges: HealthEdge[]
  coverage: CoverageScore
  insights: MapInsights
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
  running: boolean
}

/** A recent commit; `deployedEnv` names the environment running it, or null if none. */
export interface CommitRef {
  hash: string
  message: string
  deployedEnv: string | null
  /** server-declared: something is running this commit (drives all live-data gating) */
  running: boolean
}

/** Revisions a repo's map can be viewed at: deployed environments + recent commits. */
/** Server-declared: whether a revision is running anywhere (drives all live-data gating). */
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
  entryNodeId: string
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

/** The kind of test generated from a trace — future kinds (e.g. performance) slot in here. */
export type TestType = 'synthetic'

export interface GeneratedTest {
  type: TestType
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
