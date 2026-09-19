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
import { DEFAULT_MAX_DEPTH, EdgeHealthSettings, type HealthSettings } from './EdgeHealthSettings'
import type { RepoRevisions } from '../types/atlas'
import type { RepoView } from './EnvironmentSelector'
import { CoverageTable } from './CoverageTable'
import { TraceDrawer, type EdgeFix } from './TraceDrawer'
import { SyntheticModal } from './SyntheticModal'
import { AlertRulesModal } from './AlertRulesModal'
import { SafeguardsModal } from './SafeguardsModal'
import { EnhancementDrawer } from './EnhancementDrawer'
import { CommandPalette, useCommandK, type PaletteCommand } from './CommandPalette'
import { ObservabilityMenu } from './ObservabilityMenu'
import { CallDetailModal } from './CallDetailModal'
import { EDGE_KIND_LABEL, EVIDENCE_LABEL, NODE_LABEL } from '../lib/nodeVisuals'

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
  const [traceCtx, setTraceCtx] = useState<{ title?: string; source?: string; restrictSources?: string[]; fix?: EdgeFix; evidenceNote?: string; safeguards?: boolean } | null>(null)
  const [syntheticTrace, setSyntheticTrace] = useState<{ traceId: string; node?: string; endpoint?: string; fromChooser?: boolean } | null>(null)
  const [callDetail, setCallDetail] = useState<IncomingTrace | null>(null)
  const [alertTrace, setAlertTrace] = useState<string | null>(null)
  const [safeguardTrace, setSafeguardTrace] = useState<string | null>(null)
  const [enhanceComponent, setEnhanceComponent] = useState<string | null>(null)
  const graphRef = useRef<GraphHandle>(null)

  // link health from observed error rate over a rolling window (gear-configurable)
  const [healthSettings, setHealthSettings] = useState<HealthSettings>({ errorThreshold: 0.1, windowMin: 15 })
  // how many hops out from the source repository the map reaches (gear-configurable, 1–8)
  const [maxDepth, setMaxDepth] = useState(DEFAULT_MAX_DEPTH)
  // gear popover open → freeze the legend chip set so slider drags don't reflow the cluster
  const [settingsOpen, setSettingsOpen] = useState(false)
  // per-edge windowed error rates, computed & judged server-side (polled every few seconds)
  const [edgeRates, setEdgeRates] = useState<Map<string, { ratePct: number; status: 'ok' | 'error' }>>(new Map())
  const edgeHealth = useMemo(
    () => new Map(Array.from(edgeRates, ([id, r]) => [id, r.status] as const)),
    [edgeRates],
  )

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
    setEdgeRates(new Map())
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

  // depth changes are debounced so slider drags don't fire a request per pixel
  const [depthQuery, setDepthQuery] = useState(maxDepth)
  useEffect(() => {
    const t = setTimeout(() => setDepthQuery(maxDepth), 250)
    return () => clearTimeout(t)
  }, [maxDepth])

  // revision change (or first load): reset live-health state, load flow membership + the full
  // topology's node kinds (the legend's frozen chip set while the gear popover is open)
  const [fullKinds, setFullKinds] = useState<Set<NodeKind> | null>(null)
  useEffect(() => {
    let cancelled = false
    setMap(null)
    setError(null)
    setEdgeRates(new Map())
    setFullKinds(null)
    api
      .graph(component, revCommit)
      .then((g) => !cancelled && setFullKinds(new Set(g.nodes.map((n) => n.kind))))
      .catch(() => {})
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

  // the map itself is depth-scoped SERVER-side (BFS + coverage re-scoring in one place, the
  // backend) — on a depth change the old map stays up until the scoped one arrives
  useEffect(() => {
    let cancelled = false
    api
      .healthMap(component, revCommit, depthQuery)
      .then((m) => !cancelled && setMap(m))
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [component, revCommit, depthQuery])

  // insight moment: when the map in view has logging gaps, draw the eye — once, softly
  useEffect(() => {
    if (!map || !(repoView?.running ?? true)) return
    const key = `${component}@${revCommit ?? ''}`
    if (insightShown.current === key) return
    if (map.edges.some((e) => e.linkStatus === 'missing_logs')) {
      insightShown.current = key
      setShimmerUntil(performance.now() + 2600)
      setInsightPulse(true)
      const t = setTimeout(() => setInsightPulse(false), 2600)
      return () => clearTimeout(t)
    }
  }, [map, component, revCommit, repoView])

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

  // windowed error rates come from the observability backend — the window and threshold are
  // parameters of the query, and the ok/error verdict is made server-side (one rule, no drift)
  useEffect(() => {
    if (!running) {
      setEdgeRates(new Map())
      return
    }
    let cancelled = false
    const load = () =>
      api
        .edgeHealth(component, revCommit, healthSettings.windowMin, Math.round(healthSettings.errorThreshold * 100))
        .then((rows) => {
          if (!cancelled) setEdgeRates(new Map(rows.map((r) => [r.edgeId, { ratePct: r.ratePct, status: r.status }])))
        })
        .catch(() => {})
    load()
    const id = window.setInterval(load, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [component, revCommit, running, healthSettings])

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
      // problem edges (amber missing-logs / red error-rate) get a Fix suggestion tab —
      // but an undeployed commit has no observability, so there's nothing to diagnose
      let fix: EdgeFix | undefined
      if (!(repoView?.running ?? true)) {
        fix = undefined
      } else if (edge.linkStatus === 'missing_logs') {
        fix = { kind: 'missing_logs', sourceName: nameOf(src) }
      } else if (edge.linkStatus === 'silent') {
        fix = {
          kind: 'silent',
          sourceName: nameOf(src),
          targetName: nameOf(tgt),
          sourceId: src,
          edgeKindLabel: EDGE_KIND_LABEL[edge.kind],
        }
      } else if (edgeRates.get(edgeId)?.status === 'error') {
        fix = {
          kind: 'error_rate',
          sourceName: nameOf(src),
          targetName: nameOf(tgt),
          ratePct: edgeRates.get(edgeId)!.ratePct,
          windowMin: healthSettings.windowMin,
          thresholdPct: Math.round(healthSettings.errorThreshold * 100),
        }
      }
      const evidenceNote =
        (repoView?.running ?? true) && edge.linkStatus === 'healthy' && edge.logEvidence !== 'none'
          ? EVIDENCE_LABEL[edge.logEvidence].toLowerCase()
          : undefined
      // safeguards protect the root — only offer them when this edge invokes (or is) the root
      const center = map?.nodes.find((n) => n.center)?.id
      setTraceCtx({
        title: `${nameOf(src)} → ${nameOf(tgt)}`,
        restrictSources: originNames,
        fix,
        evidenceNote,
        safeguards: src === center || tgt === center,
      })
    },
    [flowEdgesByOrigin, nameOf, edgeRates, healthSettings, repoView],
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
      // over the links in view, so the count always matches what the map shows
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

  const openRootModal = (tab: 'overview' | 'wiki') => {
    const center = map?.nodes.find((n) => n.center)
    if (center) {
      setModalTab(tab)
      setSelected(center)
    }
  }

  // ⌘K commands: jump to any node, run the headline actions, switch components
  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    if (!map) return []
    const center = map.nodes.find((n) => n.center)
    // only nodes within the configured depth are on the map, so only those are jumpable
    const nodeCmds: PaletteCommand[] = map.nodes.map((n) => ({
      id: `node-${n.id}`,
      group: 'Nodes',
      label: n.name,
      hint: NODE_LABEL[n.kind],
      icon: 'ring',
      run: () => graphRef.current?.focusNode(n.id),
    }))
    const isRunning = repoView?.running ?? true
    const actions: PaletteCommand[] = [
      ...(isRunning
        ? [
            {
              id: 'act-traces',
              group: 'Actions' as const,
              label: 'Open Traces',
              icon: 'pulse' as const,
              run: () => setTraceCtx({ title: `${component} · all traces`, safeguards: true }),
            },
            {
              id: 'act-coverage',
              group: 'Actions' as const,
              label: 'Logging Coverage',
              icon: 'ring' as const,
              run: () => setShowTable(true),
            },
          ]
        : []),
      {
        id: 'act-wiki',
        group: 'Actions',
        label: 'Open DeepWiki',
        icon: 'doc',
        run: () => openRootModal('wiki'),
      },
      // only offered when the map actually shows a logging gap leaving the root service,
      // so the enhancement popup can never contradict the graph
      ...(center && map.edges.some((e) => e.linkStatus === 'missing_logs' && e.source === center.id)
        ? [
            {
              id: 'act-enhance',
              group: 'Actions' as const,
              label: 'Observability Fix',
              icon: 'sparkle' as const,
              run: () => setEnhanceComponent(center.name),
            },
          ]
        : []),
      {
        id: 'act-fit',
        group: 'Actions',
        label: 'Fit Map to Screen',
        icon: 'search',
        run: () => graphRef.current?.zoomToFit(),
      },
    ]
    return [...actions, ...nodeCmds]
  }, [map, component, repoView])

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
            staticTopology={!running}
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
          {/* while the gear popover is up the chip set stays frozen so the depth slider never
              reflows this cluster (chips popping in/out shoved the popover around); on click-off
              the chips prune to the kinds actually on the map */}
          <GraphLegend
            hiddenKinds={hiddenKinds}
            onToggle={toggleKind}
            present={
              settingsOpen ? fullKinds ?? new Set(map.nodes.map((n) => n.kind)) : new Set(map.nodes.map((n) => n.kind))
            }
          />
          <ObservabilityMenu
            coverage={running ? map.coverage : undefined}
            onCoverage={() => setShowTable(true)}
            onTraces={running ? () => setTraceCtx({ title: `${component} · all traces`, safeguards: true }) : undefined}
            onOverview={() => openRootModal('overview')}
          />
          <EdgeHealthSettings
            settings={healthSettings}
            onChange={setHealthSettings}
            maxDepth={maxDepth}
            onMaxDepth={setMaxDepth}
            onOpenChange={setSettingsOpen}
          />
        </div>

        {/* missing links — the actual job, top-right (hidden for undeployed commits: no data) */}
        {running && (
          <div className="absolute right-4 top-4">
            <MissingLinksPanel edges={map.edges} onFocus={focusEdge} pulse={insightPulse} />
          </div>
        )}

        {selected && (
          <NodeModal
            key={selected.id}
            component={component}
            node={selected}
            edges={map.edges}
            running={running}
            initialTab={modalTab}
            onClose={() => setSelected(null)}
            onViewTraces={() => {
              setTraceCtx({ title: `${selected.name} · traces`, safeguards: !!selected.center })
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
            rev={revCommit}
            running={running}
            title={traceCtx.title}
            initialSource={traceCtx.source}
            restrictSources={traceCtx.restrictSources}
            visibleSources={map.nodes.map((n) => n.name)}
            rootId={map.nodes.find((n) => n.center)?.id}
            safeguardsEnabled={traceCtx.safeguards ?? false}
            fix={traceCtx.fix}
            evidenceNote={traceCtx.evidenceNote}
            onClose={() => setTraceCtx(null)}
            onSafeguards={setSafeguardTrace}
          />
        )}

        {showTable && (
          <CoverageTable
            map={map}
            onClose={() => setShowTable(false)}
          />
        )}
        {safeguardTrace && (
          <SafeguardsModal
            traceId={safeguardTrace}
            onPick={(kind) => {
              const traceId = safeguardTrace
              setSafeguardTrace(null)
              if (kind === 'synthetic') setSyntheticTrace({ traceId, fromChooser: true })
              else setAlertTrace(traceId)
            }}
            onClose={() => setSafeguardTrace(null)}
          />
        )}

        {alertTrace && (
          <AlertRulesModal
            component={component}
            traceId={alertTrace}
            onBack={() => {
              setSafeguardTrace(alertTrace)
              setAlertTrace(null)
            }}
            onClose={() => setAlertTrace(null)}
          />
        )}

        {syntheticTrace && (
          <SyntheticModal
            traceId={syntheticTrace.traceId}
            node={syntheticTrace.node}
            endpoint={syntheticTrace.endpoint}
            onBack={
              syntheticTrace.fromChooser
                ? () => {
                    setSafeguardTrace(syntheticTrace.traceId)
                    setSyntheticTrace(null)
                  }
                : undefined
            }
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
