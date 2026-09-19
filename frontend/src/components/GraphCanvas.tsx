import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ComponentNode, HealthEdge, NodeKind } from '../types/atlas'
import { withAlpha } from '../lib/nodeVisuals'
import {
  COMET_TRAVEL_MS,
  clamp01,
  clearGradientCache,
  drawComet,
  easeOutBack,
  easeOutQuint,
  haloGradient,
  pointOnLink,
  resolvePalette,
  smoothstep,
  traceLinkPath,
  type Comet,
  type GraphPalette,
} from '../lib/graphRender'

export interface GraphHandle {
  /** Launch a comet travelling the given edge (live-flow overlay). */
  pulse: (edgeId: string, error?: boolean) => void
  zoomToFit: () => void
  /** Camera flight to a node (used by the command palette). */
  focusNode: (id: string) => void
}

interface GNode extends ComponentNode {
  x?: number
  y?: number
  /** spawn delay in ms for the staggered entrance */
  _spawn?: number
  /** smoothed draw alpha (dim transitions) */
  _a?: number
}
type GLink = Omit<HealthEdge, 'source' | 'target'> & {
  source: string | GNode
  target: string | GNode
  curvature?: number
  /** smoothed emphasis 0..1 (hover transitions) */
  _e?: number
}

const endpointId = (v: string | GNode): string => (typeof v === 'string' ? v : v.id)

interface Props {
  nodes: ComponentNode[]
  edges: HealthEdge[]
  selectedId?: string
  highlightIds?: Set<string>
  dimUnhighlighted?: boolean
  hiddenKinds?: Set<NodeKind>
  /** Rolling health per edge id from observed error rate: 'error' → red. */
  edgeHealth?: Map<string, 'ok' | 'error'>
  /** while now < this timestamp, missing-log edges swell softly (insight moment) */
  shimmerMissingUntil?: number
  /** viewing an undeployed commit: topology only, no observability — every edge is a plain hairline */
  staticTopology?: boolean
  onNodeInspect?: (node: ComponentNode) => void
  onNodeFlow?: (node: ComponentNode) => void
  onEdgeClick?: (edge: HealthEdge) => void
  /** click on empty canvas — used to dismiss transient views (flow filter, highlights) */
  onBackgroundClick?: () => void
}

const BADGE_LOD = 0.8 // hide type badges below this zoom
const LABEL_LOD = 0.7 // labels fade in above this zoom

export const GraphCanvas = forwardRef<GraphHandle, Props>(function GraphCanvas(
  {
    nodes,
    edges,
    selectedId,
    highlightIds,
    dimUnhighlighted,
    hiddenKinds,
    edgeHealth,
    shimmerMissingUntil,
    staticTopology,
    onNodeInspect,
    onNodeFlow,
    onEdgeClick,
    onBackgroundClick,
  },
  ref,
) {
  const fgRef = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [, forceTheme] = useState(0)

  const palRef = useRef<GraphPalette>(null as unknown as GraphPalette)
  if (!palRef.current) palRef.current = resolvePalette()

  // honor the OS reduced-motion preference: no stagger, no comet tails, instant camera
  const reducedMotion = useRef(
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  // frame clock + smoothing dt, shared by every per-node/per-link callback
  const frameNow = useRef(performance.now())
  const frameDt = useRef(16)
  const frameStats = useRef({ acc: 0, n: 0, last: performance.now() })

  // spawn choreography + hover state live in refs — no React re-renders per frame
  const spawnBase = useRef(performance.now())
  const hoverNode = useRef<GNode | null>(null)
  const hoverLink = useRef<GLink | null>(null)
  const selectedAt = useRef(0)
  const comets = useRef<Comet[]>([])

  const visibleNodeIds = useMemo(() => {
    const hidden = hiddenKinds ?? new Set<NodeKind>()
    return new Set(nodes.filter((n) => n.center || !hidden.has(n.kind)).map((n) => n.id))
  }, [nodes, hiddenKinds])

  // rebuild data only when topology / filter changes (react-force-graph mutates these objects)
  const data = useMemo(() => {
    const gNodes = nodes.filter((n) => visibleNodeIds.has(n.id)).map((n) => ({ ...n })) as GNode[]
    const gLinks = edges
      .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((e) => ({ ...e })) as GLink[]

    // antiparallel pairs (the Kafka request/response loop) curve apart
    const ids = new Set(gLinks.map((l) => l.id))
    gLinks.forEach((l) => {
      l.curvature = ids.has(`${l.target}->${l.source}`) ? 0.22 : 0
    })

    // staggered entrance: BFS depth from the center node
    const center = gNodes.find((n) => n.center)?.id
    const adj = new Map<string, string[]>()
    gLinks.forEach((l) => {
      const s = l.source as string
      const t = l.target as string
      adj.set(s, [...(adj.get(s) ?? []), t])
      adj.set(t, [...(adj.get(t) ?? []), s])
    })
    const depth = new Map<string, number>()
    if (center) {
      depth.set(center, 0)
      const q = [center]
      while (q.length) {
        const cur = q.shift()!
        for (const nb of adj.get(cur) ?? []) {
          if (!depth.has(nb)) {
            depth.set(nb, (depth.get(cur) ?? 0) + 1)
            q.push(nb)
          }
        }
      }
    }
    gNodes.forEach((n, i) => {
      n._spawn = (depth.get(n.id) ?? 3) * 130 + i * 24
      n._a = 1
    })
    return { nodes: gNodes, links: gLinks }
  }, [nodes, edges, visibleNodeIds])

  const linkById = useMemo(() => {
    const m = new Map<string, GLink>()
    data.links.forEach((l) => m.set(l.id, l))
    return m
  }, [data])

  // restart the entrance whenever the topology changes
  useEffect(() => {
    spawnBase.current = performance.now()
    comets.current = []
  }, [data])

  useEffect(() => {
    if (selectedId) selectedAt.current = performance.now()
  }, [selectedId])

  useImperativeHandle(ref, () => ({
    pulse: (edgeId, error) => {
      if (!linkById.has(edgeId)) return
      if (comets.current.length > 40) comets.current.shift()
      comets.current.push({ linkId: edgeId, t0: performance.now(), error })
    },
    zoomToFit: () => fgRef.current?.zoomToFit(600, 90),
    focusNode: (id: string) => {
      const n = data.nodes.find((nd) => nd.id === id)
      const fg = fgRef.current
      if (!n || !fg || !Number.isFinite(n.x)) return
      const ms = reducedMotion.current ? 0 : 600
      fg.centerAt(n.x, n.y, ms)
      fg.zoom(2.1, ms)
    },
  }))

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // theme toggles rebuild the cached palette + gradients
  useEffect(() => {
    const obs = new MutationObserver(() => {
      palRef.current = resolvePalette()
      clearGradientCache()
      forceTheme((n) => n + 1)
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // gentle initial layout + fit
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-540)
    fg.d3Force('link')?.distance(96)
    const t = setTimeout(() => fg.zoomToFit(750, 130), 700)
    return () => clearTimeout(t)
  }, [data])

  const nodeRadius = (n: GNode) => (n.center ? 17 : n.kind === 'service' ? 10 : 8)

  /** entrance progress 0..1 for a node */
  const spawnK = useCallback((n: GNode) => {
    if (reducedMotion.current) return 1
    const age = frameNow.current - spawnBase.current - (n._spawn ?? 0)
    return clamp01(age / 420)
  }, [])

  const isConnected = useCallback((l: GLink, n: GNode | null) => {
    if (!n) return false
    return endpointId(l.source) === n.id || endpointId(l.target) === n.id
  }, [])

  const endpointsOf = (l: GLink): { s: { x: number; y: number }; t: { x: number; y: number } } | null => {
    const s = l.source
    const t = l.target
    if (typeof s === 'string' || typeof t === 'string') return null
    if (!Number.isFinite(s.x) || !Number.isFinite(t.x)) return null
    return { s: { x: s.x!, y: s.y! }, t: { x: t.x!, y: t.y! } }
  }

  /* --- our own tap detection ------------------------------------------------
     Both d3-drag (node drag) and d3-zoom (pan) suppress the browser click after
     even 1px of pointer movement, which made users "double click" nodes. We
     capture pointer down/up on the container, treat ≤6px / ≤600ms as a tap, and
     hit-test nodes, badges, and (curved) links ourselves. */
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null)

  const handleTap = useCallback(
    (offsetX: number, offsetY: number) => {
      const fg = fgRef.current
      if (!fg) return
      const p = fg.screen2GraphCoords(offsetX, offsetY)
      const scale = fg.zoom?.() ?? 1
      if (!p) return

      // nodes first (reverse = topmost drawn wins)
      for (let i = data.nodes.length - 1; i >= 0; i--) {
        const n = data.nodes[i]
        if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue
        const r = nodeRadius(n)
        if (Math.hypot(p.x - n.x!, p.y - n.y!) <= r + 4) {
          // small color-coded type badge → inspect (open modal); disc body → live flow
          const dotR = Math.max(2.4, r * 0.36)
          const dcx = n.x! + r * 0.5
          const dcy = n.y! + r * 0.5
          if (scale >= BADGE_LOD && Math.hypot(p.x - dcx, p.y - dcy) <= dotR + 3) onNodeInspect?.(n)
          else onNodeFlow?.(n)
          return
        }
      }

      // then links: sample along each (possibly curved) path
      const threshold = Math.max(6 / scale, 3)
      let best: { link: GLink; d: number } | null = null
      for (const link of data.links) {
        const ends = endpointsOf(link)
        if (!ends) continue
        for (let i = 0; i <= 24; i++) {
          const q = pointOnLink(ends.s, ends.t, link.curvature ?? 0, i / 24)
          const d = Math.hypot(p.x - q.x, p.y - q.y)
          if (d <= threshold && (!best || d < best.d)) best = { link, d }
        }
      }
      if (best) {
        onEdgeClick?.(best.link as unknown as HealthEdge)
        return
      }

      onBackgroundClick?.()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, onNodeInspect, onNodeFlow, onEdgeClick, onBackgroundClick],
  )

  return (
    <div
      ref={wrapRef}
      className="h-full w-full"
      onPointerDownCapture={(e) => {
        tapStart.current = { x: e.clientX, y: e.clientY, t: performance.now() }
      }}
      onPointerUpCapture={(e) => {
        const s = tapStart.current
        tapStart.current = null
        if (!s) return
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 6 || performance.now() - s.t > 600) return
        const rect = wrapRef.current?.getBoundingClientRect()
        if (rect) handleTap(e.clientX - rect.left, e.clientY - rect.top)
      }}
      style={{
        backgroundColor: 'var(--graph-bg-edge)',
        backgroundImage:
          'linear-gradient(to bottom, var(--graph-bg-center), transparent 30%), radial-gradient(ellipse 80% 70% at 50% 46%, var(--graph-bg-center), transparent 72%), radial-gradient(var(--graph-dot) 1px, transparent 1.4px)',
        backgroundSize: 'auto, auto, 26px 26px',
        backgroundPosition: 'center, center, center',
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        cooldownTicks={140}
        autoPauseRedraw={false}
        nodeRelSize={6}
        /* dragging is safe alongside our own tap detection (capture-phase, ≤6px = tap):
           d3-drag suppressing the browser click no longer matters, and a real drag moves
           >6px so it never double-fires as a tap. Dragging reheats the simulation, so a
           node pulls its neighbours along, and it stays pinned where it's dropped. */
        enableNodeDrag={true}
        onRenderFramePre={() => {
          const now = performance.now()
          frameDt.current = Math.min(50, now - frameNow.current)
          frameNow.current = now
          if (import.meta.env.DEV) {
            const st = frameStats.current
            st.acc += frameDt.current
            st.n++
            if (now - st.last > 5000) {
              // eslint-disable-next-line no-console
              console.debug(`[graph] avg frame ${(st.acc / st.n).toFixed(1)}ms over ${st.n} frames`)
              st.acc = 0
              st.n = 0
              st.last = now
            }
          }
        }}
        onNodeHover={(n: any) => {
          hoverNode.current = n ?? null
          if (wrapRef.current) wrapRef.current.style.cursor = n ? 'pointer' : ''
        }}
        onLinkHover={(l: any) => {
          hoverLink.current = l ?? null
          if (wrapRef.current && !hoverNode.current) wrapRef.current.style.cursor = l ? 'pointer' : ''
        }}
        nodeLabel={() => ''}
        linkCurvature="curvature"
        linkWidth={4} /* pointer hit area — visuals are drawn below */
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={(l: any, ctx: CanvasRenderingContext2D) => {
          const link = l as GLink
          const pal = palRef.current
          const ends = endpointsOf(link)
          if (!ends) return
          const { s, t } = ends
          const now = frameNow.current

          // entrance: links appear once both endpoints have spawned
          const spawn =
            typeof link.source !== 'string' && typeof link.target !== 'string'
              ? Math.min(spawnK(link.source), spawnK(link.target))
              : 1
          if (spawn <= 0.02) return

          // emphasis easing: hover on node/edge lifts connected links, others recede
          const hovered =
            hoverLink.current === link || isConnected(link, hoverNode.current)
          const anyHover = !!hoverNode.current || !!hoverLink.current
          const highlighted =
            highlightIds &&
            highlightIds.has(endpointId(link.source)) &&
            highlightIds.has(endpointId(link.target))
          const dimmed = dimUnhighlighted && highlightIds && !highlighted

          let target = 1
          if (dimmed) target = 0.1
          else if (anyHover) target = hovered ? 1.6 : 0.45
          else if (highlighted) target = 1.5
          const k = Math.min(1, frameDt.current / 200)
          link._e = (link._e ?? 1) + ((target - (link._e ?? 1)) * k)
          const e = link._e

          const health =
            !staticTopology && link.linkStatus === 'healthy' && edgeHealth?.get(link.id) === 'error'
          const curv = link.curvature ?? 0

          ctx.save()
          ctx.globalAlpha = spawn

          if (staticTopology) {
            // no observability for this revision — dotted, like any documented-but-unobserved
            // relationship (the silent-edge language, applied to the whole map)
            const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y)
            const base = pal.dark ? '#ebebf5' : '#3c3c43'
            grad.addColorStop(0, withAlpha(base, (pal.dark ? 0.12 : 0.16) * Math.min(1.6, e)))
            grad.addColorStop(1, withAlpha(base, (pal.dark ? 0.3 : 0.34) * Math.min(1.6, e)))
            traceLinkPath(ctx, s, t, curv)
            ctx.strokeStyle = grad
            ctx.lineWidth = highlighted || hovered ? 2 : 1.15
            ctx.setLineDash([2, 4])
            ctx.stroke()
            ctx.setLineDash([])
          } else if (link.linkStatus === 'missing_logs') {
            // insight shimmer: soft swell while the moment is live
            let glow = 0.16
            if (shimmerMissingUntil && now < shimmerMissingUntil) {
              glow = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin((now / 260) % (Math.PI * 2)))
            }
            traceLinkPath(ctx, s, t, curv)
            ctx.strokeStyle = withAlpha(pal.missing, Math.min(0.55, glow * e))
            ctx.lineWidth = 3.6
            ctx.stroke()
            traceLinkPath(ctx, s, t, curv)
            ctx.setLineDash([5, 5])
            ctx.strokeStyle = withAlpha(pal.missing, Math.min(1, 0.95 * e))
            ctx.lineWidth = 1.4
            ctx.stroke()
            ctx.setLineDash([])
          } else if (link.linkStatus === 'silent') {
            traceLinkPath(ctx, s, t, curv)
            ctx.setLineDash([2, 3])
            ctx.strokeStyle = pal.silent
            ctx.globalAlpha = spawn * Math.min(1, 0.9 * e)
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.setLineDash([])
          } else {
            // healthy: directional gradient hairline (source fades toward target)
            const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y)
            if (health) {
              grad.addColorStop(0, withAlpha(pal.critical, 0.35 * Math.min(1, e)))
              grad.addColorStop(1, withAlpha(pal.critical, Math.min(1, 0.85 * e)))
            } else {
              const base = pal.dark ? '#ebebf5' : '#3c3c43'
              grad.addColorStop(0, withAlpha(base, (pal.dark ? 0.1 : 0.13) * Math.min(1.6, e)))
              grad.addColorStop(1, withAlpha(base, (pal.dark ? 0.26 : 0.3) * Math.min(1.6, e)))
            }
            traceLinkPath(ctx, s, t, curv)
            ctx.strokeStyle = grad
            ctx.lineWidth = highlighted || hovered ? 2 : health ? 1.6 : 1.15
            ctx.stroke()
          }
          ctx.restore()
        }}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          const n = node as GNode
          if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return
          const pal = palRef.current
          const now = frameNow.current
          const r0 = nodeRadius(n)

          // entrance pop
          const sk = spawnK(n)
          if (sk <= 0) return
          const pop = easeOutBack(sk)
          const r = r0 * (0.6 + 0.4 * pop)

          // smoothed dim
          const dimTarget = dimUnhighlighted && highlightIds && !highlightIds.has(n.id) ? 0.13 : 1
          const k = Math.min(1, frameDt.current / 200)
          n._a = (n._a ?? 1) + (dimTarget - (n._a ?? 1)) * k
          const alpha = (n._a ?? 1) * sk

          const hovered = hoverNode.current === n
          ctx.globalAlpha = alpha

          // ambient halo: focus node always, hovered nodes softly
          if (n.center || hovered) {
            const hr = r * (n.center ? 3 : 2.3)
            ctx.save()
            ctx.translate(n.x!, n.y!)
            ctx.fillStyle = haloGradient(ctx, pal, hr, n.center ? 0.16 : 0.1)
            ctx.beginPath()
            ctx.arc(0, 0, hr, 0, 2 * Math.PI)
            ctx.fill()
            ctx.restore()
          }

          // clean cut-out so edges stop precisely at the node boundary — ringed nodes
          // (focus/selected/critical) cut wider so lines never cross their ring
          const ringed = n.center || n.id === selectedId || n.health === 'critical'
          ctx.beginPath()
          ctx.arc(n.x!, n.y!, ringed ? r + 6.5 : r + 2.5, 0, 2 * Math.PI)
          ctx.fillStyle = pal.bgEdge
          ctx.fill()

          // flat Apple-grey body, no outline — the original look (gradients/rims read Vista)
          ctx.beginPath()
          ctx.arc(n.x!, n.y!, hovered ? r * 1.04 : r, 0, 2 * Math.PI)
          ctx.fillStyle = n.owned ? pal.nodeGrey : pal.nodeGreyExt
          ctx.fill()

          // color-coded type badge (bottom-right) — hidden when zoomed far out
          if (scale >= BADGE_LOD) {
            const dotR = Math.max(2.4, r * 0.36)
            const dcx = n.x! + r * 0.5
            const dcy = n.y! + r * 0.5
            ctx.beginPath()
            ctx.arc(dcx, dcy, dotR + 1.4, 0, 2 * Math.PI)
            ctx.fillStyle = pal.bgEdge
            ctx.fill()
            ctx.beginPath()
            ctx.arc(dcx, dcy, dotR, 0, 2 * Math.PI)
            ctx.fillStyle = pal.node[n.kind]
            ctx.fill()
          }

          // focus ring
          if (n.center) {
            ctx.lineWidth = 1.5
            ctx.strokeStyle = pal.accent
            ctx.beginPath()
            ctx.arc(n.x!, n.y!, r + 4.5, 0, 2 * Math.PI)
            ctx.stroke()
          }

          // selection: ring settles in with a spring
          if (n.id === selectedId && !n.center) {
            const sel = easeOutQuint((now - selectedAt.current) / 300)
            ctx.globalAlpha = alpha * sel
            ctx.lineWidth = 1.75
            ctx.strokeStyle = pal.accent
            ctx.beginPath()
            ctx.arc(n.x!, n.y!, r + 4.5 + (1 - sel) * 4, 0, 2 * Math.PI)
            ctx.stroke()
            ctx.globalAlpha = alpha
          }

          // reserved for genuine alarm — crisp, unanimated (not for undeployed commits)
          if (n.health === 'critical' && !staticTopology) {
            ctx.lineWidth = 1.75
            ctx.strokeStyle = pal.critical
            ctx.beginPath()
            ctx.arc(n.x!, n.y!, r + 4.5, 0, 2 * Math.PI)
            ctx.stroke()
          }

          // label — LOD fade, Apple tracking, soft knockout so edges never cut glyphs
          const labelAlpha = n.center ? 1 : smoothstep((scale - LABEL_LOD) / 0.35)
          if (labelAlpha > 0.02) {
            const fontSize = (n.center ? 12.5 : 10.5) / Math.sqrt(Math.max(scale, 1))
            ctx.font = `${n.center ? 590 : 480} ${fontSize + (n.center ? 1.5 : 0)}px -apple-system, "SF Pro Text", system-ui, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            try {
              ;(ctx as any).letterSpacing = '-0.2px'
            } catch {
              /* older engines ignore canvas letterSpacing */
            }
            const ly = n.y! + r + 6
            ctx.save()
            ctx.globalAlpha = alpha * labelAlpha
            ctx.shadowColor = pal.bgCenter
            ctx.shadowBlur = 7
            ctx.fillStyle = n.center ? pal.labelCenter : pal.label
            ctx.fillText(n.name, n.x!, ly)
            ctx.fillText(n.name, n.x!, ly) // second pass deepens the knockout
            ctx.restore()
            try {
              ;(ctx as any).letterSpacing = '0px'
            } catch {
              /* no-op */
            }
          }
          ctx.globalAlpha = 1
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const n = node as GNode
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(n.x!, n.y!, nodeRadius(n) + 4, 0, 2 * Math.PI)
          ctx.fill()
        }}
        onRenderFramePost={(ctx: CanvasRenderingContext2D) => {
          // comet-tail particles — our own system, same path math as the drawn links
          const pal = palRef.current
          const now = frameNow.current
          const alive: Comet[] = []
          for (const c of comets.current) {
            const progress = (now - c.t0) / COMET_TRAVEL_MS
            if (progress >= 1) continue
            const link = linkById.get(c.linkId)
            const ends = link && endpointsOf(link)
            if (!link || !ends) continue
            if (reducedMotion.current) {
              // plain travelling dot, no tail
              const p = pointOnLink(ends.s, ends.t, link.curvature ?? 0, progress)
              ctx.beginPath()
              ctx.arc(p.x, p.y, 2.2, 0, 2 * Math.PI)
              ctx.fillStyle = c.error ? pal.critical : pal.particle
              ctx.fill()
            } else {
              drawComet(ctx, ends.s, ends.t, link.curvature ?? 0, progress, c.error ? pal.critical : pal.particle, pal.dark)
            }
            alive.push(c)
          }
          comets.current = alive
        }}
      />
    </div>
  )
})
