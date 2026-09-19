import type { ComponentNode, HealthEdge, HealthMap } from '../types/atlas'

/**
 * What breaks if this node fails: the transitive closure of its CALLERS.
 * Edges point source→target = "source depends on / sends into target", so a
 * failure at X hurts everything that can reach X — we walk edges in reverse
 * (e.g. Orchestrator down → Client fails → VMForge and the Lightspeed event
 * loop are starved).
 */
export function blastRadius(nodeId: string, edges: HealthEdge[]): Set<string> {
  const inTo = new Map<string, string[]>() // target → sources
  edges.forEach((e) => {
    if (!inTo.has(e.target)) inTo.set(e.target, [])
    inTo.get(e.target)!.push(e.source)
  })
  const seen = new Set<string>([nodeId])
  const stack = [nodeId]
  while (stack.length) {
    const cur = stack.pop()!
    for (const caller of inTo.get(cur) ?? []) {
      if (!seen.has(caller)) {
        seen.add(caller)
        stack.push(caller)
      }
    }
  }
  return seen
}

/** A short, plain-language narrative of the map — the "Explain this map" feature. */
export function explainMap(map: HealthMap): string[] {
  const byId = new Map<string, ComponentNode>(map.nodes.map((n) => [n.id, n]))
  const center = byId.get(map.center)
  const callers = map.edges.filter((e) => e.target === map.center)
  const deps = map.edges.filter((e) => e.source === map.center)
  const kinds = new Map<string, number>()
  deps.forEach((e) => {
    const k = byId.get(e.target)?.kind ?? 'service'
    kinds.set(k, (kinds.get(k) ?? 0) + 1)
  })
  const missing = map.edges.filter((e) => e.linkStatus === 'missing_logs')
  const silent = map.edges.filter((e) => e.linkStatus === 'silent')
  const busiest = [...map.edges].sort((a, b) => b.callsPerMin - a.callsPerMin)[0]

  const lines: string[] = []
  lines.push(
    `${center?.name ?? map.center} sits at the centre of a map of ${map.nodes.length} components. ` +
      `${callers.length} callers reach it and it depends on ${deps.length} downstream services and stores.`,
  )
  const kindStr = [...kinds.entries()].map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(', ')
  if (kindStr) lines.push(`Its dependencies span ${kindStr}.`)
  if (busiest) {
    lines.push(
      `The busiest link is ${busiest.source} → ${busiest.target} at ~${busiest.callsPerMin.toLocaleString()} calls/min.`,
    )
  }
  lines.push(
    `Logging coverage is ${map.coverage.score}%: ${map.coverage.loggedEdges} of ${map.coverage.observedEdges} live links reach Splunk.`,
  )
  if (missing.length) {
    lines.push(
      `⚠ ${missing.length} live link${missing.length > 1 ? 's have' : ' has'} no logs: ` +
        missing.map((e) => `${e.source} → ${e.target}`).join(', ') +
        '. These are blind spots: traces flow but nothing lands in Splunk.',
    )
  }
  if (silent.length) {
    lines.push(
      `${silent.length} mapped link${silent.length > 1 ? 's show' : ' shows'} no traffic at all ` +
        `(${silent.map((e) => `${e.source} → ${e.target}`).join(', ')}), likely dead or misrouted.`,
    )
  }
  return lines
}
