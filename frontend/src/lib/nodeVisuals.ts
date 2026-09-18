import type { EdgeKind, Health, LinkStatus, LogEvidence, NodeKind } from '../types/atlas'

/** CSS variable name driving each node type's color. */
export const NODE_COLOR_VAR: Record<NodeKind, string> = {
  service: '--node-service',
  queue: '--node-queue',
  database: '--node-database',
  store: '--node-store',
  cache: '--node-cache',
  external: '--node-external',
}

export const NODE_LABEL: Record<NodeKind, string> = {
  service: 'Service',
  queue: 'Message Queue',
  database: 'Database',
  store: 'Data Store',
  cache: 'Cache',
  external: 'External',
}

export const HEALTH_COLOR_VAR: Record<Health, string> = {
  healthy: '--color-healthy',
  degraded: '--color-warning',
  critical: '--color-critical',
  unknown: '--color-text-tertiary',
}

export const LINK_COLOR_VAR: Record<LinkStatus, string> = {
  healthy: '--link-healthy',
  missing_logs: '--link-missing',
  silent: '--link-silent',
}

export const LINK_LABEL: Record<LinkStatus, string> = {
  healthy: 'Logged & flowing',
  missing_logs: 'Missing logs',
  silent: 'No traffic observed',
}

/** Human wording for how the logs prove an edge's traffic. */
export const EVIDENCE_LABEL: Record<LogEvidence, string> = {
  source_round_trip: 'Source logged request + response',
  trace_correlated: 'Trace id found in receiver logs',
  none: '—',
}

export const EDGE_KIND_LABEL: Record<EdgeKind, string> = {
  http: 'HTTP',
  grpc: 'gRPC',
  kafka: 'Kafka',
  db: 'SQL',
  mongo: 'Mongo',
  cache: 'Cache',
}

/** Resolve a CSS custom property to its current value (respects light/dark). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

/** Apply an alpha to a #rrggbb color (used by canvas gradients/halos). */
export function withAlpha(color: string, alpha: number): string {
  const m = color.match(/^#?([0-9a-f]{6})$/i)
  if (!m) return color
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
