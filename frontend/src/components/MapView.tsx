import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { ComponentNode, EndpointFlow, HealthEdge, HealthMap, NodeKind } from '../types/atlas'
import type { ThemeMode } from '../hooks/useTheme'
import { useFlowStream } from '../hooks/useFlowStream'
import { blastRadius } from '../lib/graphAnalysis'
import { AppHeader } from './AppHeader'
import { ErrorBoundary } from './ErrorBoundary'
import { GraphCanvas, type GraphHandle } from './GraphCanvas'
import { NodeModal } from './NodeModal'
import { GraphLegend } from './GraphLegend'
import { MissingLinksPanel } from './MissingLinksPanel'
import { IncomingTracesPanel, toIncoming, type IncomingTrace } from './IncomingTracesPanel'
import { EdgeHealthSettings, type HealthSettings } from './EdgeHealthSettings'
import type { RepoRevisions } from '../types/atlas'
import type { RepoView } from './EnvironmentSelector'
import { CoverageTable } from './CoverageTable'
import { TraceDrawer, type EdgeFix } from './TraceDrawer'
import { SyntheticModal } from './SyntheticModal'
import { EnhancementDrawer } from './EnhancementDrawer'
import { CommandPalette, useCommandK, type PaletteCommand } from './CommandPalette'
import { ObservabilityMenu } from './ObservabilityMenu'
import { CallDetailModal } from './CallDetailModal'
import { EDGE_KIND_LABEL, NODE_LABEL } from '../lib/nodeVisuals'

interface Props {
  component: string
  themeMode: ThemeMode
  onCycleTheme: () => void
  onHome: () => void
  onOpenComponent?: (name: string) => void
}

export function MapView({ component, themeMode, onCycleTheme, onHome, onOpenComponent }: Props) {
  const [map, setMap] = useState<HealthMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ComponentNode | null>(null)
  const [modalTab, setModalTab] = useState<'overview' | 'wiki'>('overview')
  const [highlight, setHighlight] = useState<Set<string> | null>(null)
  const [blast, setBlast] = useState<{ node: string; count: number } | null>(null)
  const [flowSource, setFlowSource] = useState<{ id: string; name: string } | null>(null)
  const flowSourceId = flowSource?.id ?? null
  const [flowNodesByOrigin, setFlowNodesByOrigin] = useState<Map<string, Set<string>>>(new Map())
  const [flowEdgesByOrigin, setFlowEdgesByOrigin] = useState<Map<string, Set<string>>>(new Map())
  // inspecting the repository/root node opens the split incoming-traces view
  const [inspect, setInspect] = useState<{ id: string; name: string } | null>(null)
  const inspectId = inspect?.id ?? null
  const [incoming, setIncoming] = useState<IncomingTrace[]>([])
  const [inspectEndpoints, setInspectEndpoints] = useState<EndpointFlow[]>([])
  const [endpointFilter, setEndpointFilter] = useState<string>('all')
  const [showTable, setShowTable] = useState(false)
  const [hiddenKinds, setHiddenKinds] = useState<Set<NodeKind>>(new Set())
  const [traceCtx, setTraceCtx] = useState<{ title?: string; source?: string; restrictSources?: string[]; fix?: EdgeFix } | null>(null)
  const [syntheticTrace, setSyntheticTrace] = useState<{ traceId: string; node?: string; endpoint?: string } | null>(null)
  const [callDetail, setCallDetail] = useState<IncomingTrace | null>(null)
  const [enhanceComponent, setEnhanceComponent] = useState<string | null>(null)
  const graphRef = useRef<GraphHandle>(null)

  // link health from observed error rate over a rolling window (gear-configurable)
  const [healthSettings, setHealthSettings] = useState<HealthSettings>({ errorThreshold: 0.1, windowMin: 15 })
  const [edgeHealth, setEdgeHealth] = useState<Map<string, 'ok' | 'error'>>(new Map())
  const errWindow = useRef<Map<string, { ts: number; err: boolean }[]>>(new Map())

  // which revision (environment / commit) the repo is viewed at; undeployed commit → map only
  const [revisions, setRevisions] = useState<RepoRevisions | null>(null)
  const [repoView, setRepoView] = useState<RepoView | null>(null)

  // ⌘K command palette
  const [paletteOpen, setPaletteOpen] = useState(false)
  useCommandK(useCallback(() => setPaletteOpen(true), []))

  // the missing-link insight moment: one soft shimmer per component visit
  const [shimmerUntil, setShimmerUntil] = useState(0)
  const [insightPulse, setInsightPulse] = useState(false)
  const insightShown = useRef<string | null>(null)

  const revCommit = repoView?.commitHash

  // component change: reset transient state and load the revisions (default view → prod)
  useEffect(() => {
    let cancelled = false
    setFlowSource(null)
    setInspect(null)
    setIncoming([])
    setEndpointFilter('all')
    errWindow.current.clear()
    setEdgeHealth(new Map())
    setRevisions(null)
    setRepoView(null)
    api
      .revisions(component)
      .then((rev) => {
        if (cancelled) return
        setRevisions(rev)
        const prod = rev.environments.find((e) => e.env === 'prod') ?? rev.environments[0]
        if (prod) {
          setRepoView({ label: prod.env, commitHash: prod.commitHash, image: prod.image, running: true })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [component])

  // revision change (or first load): (re)load the map + flow membership for that commit
  useEffect(() => {
    let cancelled = false
    setMap(null)
    setError(null)
    api
      .healthMap(component, revCommit)
      .then((m) => !cancelled && setMap(m))
      .catch((e) => !cancelled && setError(String(e)))
    // flow membership per origin — the rule lives server-side, we just consume it to dim the map
    api
      .flows(component, revCommit)
      .then((routes) => {
        if (cancelled) return
        setFlowNodesByOrigin(new Map(routes.map((r) => [r.origin, new Set(r.nodes)])))
        setFlowEdgesByOrigin(new Map(routes.map((r) => [r.origin, new Set(r.edgeIds)])))
      })
      .catch(() => {
        if (cancelled) return
        setFlowNodesByOrigin(new Map())
        setFlowEdgesByOrigin(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [component, revCommit])

  // insight moment: when the loaded map has logging gaps, draw the eye — once, softly
  useEffect(() => {
    if (!map) return
    const key = `${component}@${revCommit ?? ''}`
    if (insightShown.current === key) return
    if (map.edges.some((e) => e.linkStatus === 'missing_logs')) {
      insightShown.current = key
      setShimmerUntil(performance.now() + 2600)
      setInsightPulse(true)
      const t = setTimeout(() => setInsightPulse(false), 2600)
      return () => clearTimeout(t)
    }
  }, [map, component, revCommit])

  // the endpoint selected in the inspect panel resolves to its downstream sub-flow (from DeepWiki)
  const endpointFlow = useMemo(
    () => (endpointFilter === 'all' ? null : inspectEndpoints.find((e) => e.endpoint === endpointFilter) ?? null),
    [endpointFilter, inspectEndpoints],
  )
  const endpointEdges = useMemo(
    () => (endpointFlow ? new Set(endpointFlow.edgeIds) : null),
    [endpointFlow],
  )

  const onFlow = useCallback(
    (e: import('../types/atlas').FlowEvent) => {
      // record every observed call for the rolling per-edge error rate (independent of the view)
      const edgeId = `${e.source}->${e.target}`
      const buf = errWindow.current.get(edgeId) ?? []
      buf.push({ ts: Date.now(), err: e.status === 'error' })
      errWindow.current.set(edgeId, buf)
      // when inspecting the root node, collect the live requests arriving at it (before any filter)
      if (inspectId && e.target === inspectId) {
        setIncoming((cur) => [toIncoming(e), ...cur].slice(0, 60))
      }
      // when a source node is selected, only animate flows originating there
      if (flowSourceId && e.origin && e.origin !== flowSourceId) return
      // when an endpoint is selected, only animate that endpoint's downstream edges
      if (endpointEdges && !endpointEdges.has(`${e.source}->${e.target}`)) return
      graphRef.current?.pulse(`${e.source}->${e.target}`, e.status === 'error')
    },
    [flowSourceId, inspectId, endpointEdges],
  )

  // only stream live data when the viewed revision is actually running somewhere
  const running = repoView?.running ?? true
  const { live } = useFlowStream(component, onFlow, running, revCommit)

  // recompute per-edge health every couple of seconds from the rolling window
  useEffect(() => {
    const recompute = () => {
      const now = Date.now()
      const windowMs = healthSettings.windowMin * 60_000
      const next = new Map<string, 'ok' | 'error'>()
      errWindow.current.forEach((events, edgeId) => {
        const recent = events.filter((ev) => now - ev.ts <= windowMs)
        errWindow.current.set(edgeId, recent)
        if (recent.length === 0) return
        const rate = recent.filter((ev) => ev.err).length / recent.length
        next.set(edgeId, rate > healthSettings.errorThreshold ? 'error' : 'ok')
      })
      setEdgeHealth(next)
    }
    recompute()
    const id = window.setInterval(recompute, 2000)
    return () => window.clearInterval(id)
  }, [healthSettings])

  // fetch the inspected root node's full endpoint list from DeepWiki (pre-populates the filter)
  useEffect(() => {
    if (!inspectId) {
      setInspectEndpoints([])
      return
    }
    let cancelled = false
    api
      .nodeEndpoints(component, inspectId)
      .then((eps) => !cancelled && setInspectEndpoints(eps))
      .catch(() => !cancelled && setInspectEndpoints([]))
    return () => {
      cancelled = true
    }
  }, [component, inspectId])

  // react-force-graph replaces edge source/target with node objects; normalize back to ids
  const idOf = (v: unknown): string => (typeof v === 'string' ? v : (v as { id: string }).id)
  const nameOf = useCallback(
    (id: string) => map?.nodes.find((n) => n.id === id)?.name ?? id,
    [map],
  )

  // used by the missing-links list: briefly locate an edge by highlighting its two endpoints
  const focusEdge = useCallback((edge: HealthEdge) => {
    const src = idOf(edge.source)
    const tgt = idOf(edge.target)
    setBlast(null)
    setFlowSource(null)
    setInspect(null)
    setHighlight(new Set([src, tgt]))
    graphRef.current?.pulse(`${src}->${tgt}`)
    setTimeout(() => setHighlight((h) => (h && h.size === 2 ? null : h)), 2600)
  }, [])

  // click a line on the graph → open the traces flowing across that connection
  const showEdgeTraces = useCallback(
    (edge: HealthEdge) => {
      const src = idOf(edge.source)
      const tgt = idOf(edge.target)
      const edgeId = `${src}->${tgt}`
      graphRef.current?.pulse(edgeId)
      // which flows (by origin) traverse this edge → restrict the trace list to those sources
      const originNames: string[] = []
      flowEdgesByOrigin.forEach((edges, origin) => {
        if (edges.has(edgeId)) originNames.push(nameOf(origin))
      })
      // problem edges (amber missing-logs / red error-rate) get a Fix suggestion tab
      let fix: EdgeFix | undefined
      if (edge.linkStatus === 'missing_logs') {
        fix = { kind: 'missing_logs', sourceName: nameOf(src) }
      } else if (edge.linkStatus === 'silent') {
        fix = {
          kind: 'silent',
          sourceName: nameOf(src),
          targetName: nameOf(tgt),
          sourceId: src,
          edgeKindLabel: EDGE_KIND_LABEL[edge.kind],
        }
      } else if (edgeHealth.get(edgeId) === 'error') {
        const windowMs = healthSettings.windowMin * 60_000
        const now = Date.now()
        const recent = (errWindow.current.get(edgeId) ?? []).filter((ev) => now - ev.ts <= windowMs)
        const rate = recent.length ? recent.filter((ev) => ev.err).length / recent.length : 0
        fix = {
          kind: 'error_rate',
          sourceName: nameOf(src),
          targetName: nameOf(tgt),
          ratePct: rate * 100,
          windowMin: healthSettings.windowMin,
          thresholdPct: Math.round(healthSettings.errorThreshold * 100),
        }
      }
      setTraceCtx({ title: `${nameOf(src)} → ${nameOf(tgt)}`, restrictSources: originNames, fix })
    },
    [flowEdgesByOrigin, nameOf, edgeHealth, healthSettings],
  )

  // grey-body click on a non-root node: focus the live flow originating from it (toggles off)
  const toggleFlowSource = useCallback((node: ComponentNode) => {
    setBlast(null)
    setHighlight(null)
    setInspect(null)
    setFlowSource((cur) => (cur?.id === node.id ? null : { id: node.id, name: node.name }))
  }, [])

  // grey-body click on the repository/root node: open the split incoming-traces view
  const toggleInspect = useCallback((node: ComponentNode) => {
    setBlast(null)
    setHighlight(null)
    setFlowSource(null)
    setIncoming([])
    setEndpointFilter('all')
    setInspect((cur) => (cur?.id === node.id ? null : { id: node.id, name: node.name }))
  }, [])

  // route the grey-body click: only the root/repository node opens the split view
  const onNodeFlow = useCallback(
    (node: ComponentNode) => (node.center ? toggleInspect(node) : toggleFlowSource(node)),
    [toggleInspect, toggleFlowSource],
  )

  const showBlast = useCallback(
    (node: ComponentNode) => {
      if (!map) return
      const affected = blastRadius(node.id, map.edges)
      setFlowSource(null)
      setHighlight(affected)
      setBlast({ node: node.name, count: affected.size - 1 })
    },
    [map],
  )

  const clearHighlight = useCallback(() => {
    setHighlight(null)
    setBlast(null)
  }, [])

  // click on empty canvas → dismiss transient views (live-flow filter, highlights, blast)
  const onBackgroundClick = useCallback(() => {
    setFlowSource(null)
    setHighlight(null)
    setBlast(null)
  }, [])

  const toggleKind = useCallback((kind: NodeKind) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  // ⌘K commands: jump to any node, run the headline actions, switch components
  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    if (!map) return []
    const center = map.nodes.find((n) => n.center)
    const nodeCmds: PaletteCommand[] = map.nodes.map((n) => ({
      id: `node-${n.id}`,
      group: 'Nodes',
      label: n.name,
      hint: NODE_LABEL[n.kind],
      icon: 'ring',
      run: () => graphRef.current?.focusNode(n.id),
    }))
    const actions: PaletteCommand[] = [
      {
        id: 'act-traces',
        group: 'Actions',
        label: 'Open traces',
        icon: 'pulse',
        run: () => setTraceCtx({ title: `${component} · all traces` }),
      },
      {
        id: 'act-coverage',
        group: 'Actions',
        label: 'Logging coverage',
        icon: 'ring',
        run: () => setShowTable(true),
      },
      {
        id: 'act-wiki',
        group: 'Actions',
        label: 'Open DeepWiki',
        icon: 'doc',
        run: () => {
          if (center) {
            setModalTab('wiki')
            setSelected(center)
          }
        },
      },
      // only offered when the map actually shows a logging gap leaving the root service,
      // so the enhancement popup can never contradict the graph
      ...(center && map.edges.some((e) => e.linkStatus === 'missing_logs' && e.source === center.id)
        ? [
            {
              id: 'act-enhance',
              group: 'Actions' as const,
              label: 'Enhance logging',
              icon: 'sparkle' as const,
              run: () => setEnhanceComponent(center.name),
            },
          ]
        : []),
      {
        id: 'act-fit',
        group: 'Actions',
        label: 'Fit map to screen',
        icon: 'search',
        run: () => graphRef.current?.zoomToFit(),
      },
    ]
    return [...actions, ...nodeCmds]
  }, [map, component])

  const openWiki = () => {
    const center = map?.nodes.find((n) => n.center)
    if (center) {
      setModalTab('wiki')
      setSelected(center)
    }
  }

  const header = (
    <AppHeader
      component={component}
      live={live}
      revisions={revisions}
      repoView={repoView}
      onRepoViewChange={setRepoView}
      themeMode={themeMode}
      onCycleTheme={onCycleTheme}
      onHome={onHome}
    />
  )

  if (error) {
    return (
      <>
        {header}
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center p-6 text-center">
          <div>
            <p className="text-lg font-medium text-critical">Couldn’t load {component}</p>
            <p className="mt-1 font-mono text-sm text-secondary">{error}</p>
            <p className="mt-3 text-sm text-tertiary">
              Tip: append <span className="font-mono">?demo</span> to run without the backend.
            </p>
          </div>
        </div>
      </>
    )
  }

  if (!map) {
    return (
      <>
        {header}
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-stroke border-t-accent" />
            <p className="mt-4 text-sm text-secondary">Mapping {component}…</p>
          </div>
        </div>
      </>
    )
  }

  // a selected endpoint dims to its sub-flow; a selected flow source dims to that flow's nodes
  const endpointHighlight = endpointFlow ? new Set(endpointFlow.nodes) : null
  const flowHighlight = flowSource
    ? flowNodesByOrigin.get(flowSource.id) ?? new Set([flowSource.id])
    : null
  const effectiveHighlight = endpointHighlight ?? flowHighlight ?? highlight
  const effectiveDim = !!endpointHighlight || !!flowHighlight || !!highlight

  return (
    <>
      {header}
      <div className="flex h-[calc(100vh-3.5rem)] w-full">
        {/* left panel: only for the repository/root node — live incoming requests */}
        {inspect && (
          <div className="w-[360px] shrink-0">
            <IncomingTracesPanel
              key={inspect.id}
              nodeName={inspect.name}
              endpoints={inspectEndpoints}
              traces={incoming}
              onEndpointChange={setEndpointFilter}
              onSelect={setCallDetail}
              onClose={() => {
                setInspect(null)
                setIncoming([])
                setEndpointFilter('all')
              }}
            />
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
        <ErrorBoundary label="The graph">
          <GraphCanvas
            ref={graphRef}
            nodes={map.nodes}
            edges={map.edges}
            selectedId={selected?.id ?? inspectId ?? undefined}
            highlightIds={effectiveHighlight ?? undefined}
            dimUnhighlighted={effectiveDim}
            hiddenKinds={hiddenKinds}
            edgeHealth={edgeHealth}
            shimmerMissingUntil={shimmerUntil}
            onNodeInspect={(node) => {
              setModalTab('overview')
              setSelected(node)
            }}
            onNodeFlow={onNodeFlow}
            onEdgeClick={showEdgeTraces}
            onBackgroundClick={onBackgroundClick}
          />
        </ErrorBoundary>

        {/* undeployed commit: topology only, no live data */}
        {repoView && !repoView.running && (
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-warning-tint px-4 py-2 text-xs font-medium text-warning shadow-card animate-fade-in">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.515 2.625H3.72c-1.345 0-2.188-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 0010 6zm0 8a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
            Commit {repoView.commitHash} isn’t deployed — showing the map only, no live data
          </div>
        )}

        {/* live-flow source filter indicator */}
        {flowSource && (
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full bg-surface px-4 py-2 text-sm font-medium text-primary shadow-lg ring-1 ring-stroke-light animate-fade-in">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--link-particle)' }} />
              Live flow from {flowSource.name}
            </span>
            <button
              onClick={() => setFlowSource(null)}
              className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-secondary"
            >
              Show all
            </button>
          </div>
        )}

        {/* blast-radius banner */}
        {blast && (
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full bg-critical px-4 py-2 text-sm font-medium text-white shadow-lg animate-fade-in">
            <span>
              Blast radius of {blast.node}: {blast.count} component{blast.count === 1 ? '' : 's'} affected
            </span>
            <button onClick={clearHighlight} className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
              Clear
            </button>
          </div>
        )}

        {/* filter chips + observability eye + health settings gear */}
        <div className="absolute bottom-4 left-4 flex items-end gap-2">
          <GraphLegend
            hiddenKinds={hiddenKinds}
            onToggle={toggleKind}
            present={new Set(map.nodes.map((n) => n.kind))}
          />
          <ObservabilityMenu
            coverage={map.coverage}
            onCoverage={() => setShowTable(true)}
            onTraces={() => setTraceCtx({ title: `${component} · all traces` })}
            onWiki={openWiki}
          />
          <EdgeHealthSettings settings={healthSettings} onChange={setHealthSettings} />
        </div>

        {/* missing links — the actual job, top-right */}
        <div className="absolute right-4 top-4">
          <MissingLinksPanel edges={map.edges} onFocus={focusEdge} pulse={insightPulse} />
        </div>

        {selected && (
          <NodeModal
            key={selected.id}
            component={component}
            node={selected}
            edges={map.edges}
            initialTab={modalTab}
            onClose={() => setSelected(null)}
            onViewTraces={() => {
              setTraceCtx({ title: `${selected.name} · traces` })
              setSelected(null)
            }}
            onEnhance={() => {
              setEnhanceComponent(selected.name)
              setSelected(null)
            }}
            onBlast={() => {
              showBlast(selected)
              setSelected(null)
            }}
          />
        )}

        {traceCtx && (
          <TraceDrawer
            component={component}
            title={traceCtx.title}
            initialSource={traceCtx.source}
            restrictSources={traceCtx.restrictSources}
            fix={traceCtx.fix}
            onClose={() => setTraceCtx(null)}
            onSynthetic={(traceId) => setSyntheticTrace({ traceId })}
          />
        )}

        {showTable && <CoverageTable map={map} onClose={() => setShowTable(false)} />}
        {syntheticTrace && (
          <SyntheticModal
            traceId={syntheticTrace.traceId}
            node={syntheticTrace.node}
            endpoint={syntheticTrace.endpoint}
            onClose={() => setSyntheticTrace(null)}
          />
        )}
        {callDetail && inspect && (
          <CallDetailModal
            call={callDetail}
            recent={incoming}
            onClose={() => setCallDetail(null)}
            onSynthetic={(traceId, endpoint) => {
              setCallDetail(null)
              setSyntheticTrace({ traceId, node: inspect.name, endpoint })
            }}
          />
        )}
        {enhanceComponent && <EnhancementDrawer component={enhanceComponent} onClose={() => setEnhanceComponent(null)} />}
        {paletteOpen && (
          <CommandPalette
            onClose={() => setPaletteOpen(false)}
            commands={paletteCommands}
            onOpenComponent={onOpenComponent}
          />
        )}
        </div>
      </div>
    </>
  )
}
