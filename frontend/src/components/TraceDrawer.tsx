import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { TraceDetail, TraceSummary, WikiDoc } from '../types/atlas'
import { Drawer, useOverlayClose } from './ui/Overlay'
import { TraceWaterfall } from './TraceWaterfall'
import { Icon } from './ui/Icons'
import { Button, IconButton } from './ui/Button'
import { Select } from './ui/Select'
import { StatusDot } from './ui/StatusDot'
import { Skeleton } from './ui/Skeleton'
import { EmptyState } from './ui/EmptyState'
import { EnhancementContent } from './EnhancementContent'
import { CopyButton } from './CopyButton'
import { cx } from '../lib/cx'

/** Context for the "Fix suggestion" tab when the drawer was opened from a problem edge. */
export type EdgeFix =
  | { kind: 'missing_logs'; sourceName: string }
  | {
      kind: 'error_rate'
      sourceName: string
      targetName: string
      ratePct: number
      windowMin: number
      thresholdPct: number
    }
  | {
      kind: 'silent'
      sourceName: string
      targetName: string
      sourceId: string
      edgeKindLabel: string
    }

interface Props {
  component: string
  /** revision (commit) the map is viewed at — traces are per-environment */
  rev?: string
  /** false when viewing an undeployed commit — no traces exist */
  running?: boolean
  title?: string
  initialSource?: string
  /** present when opened from a red/amber edge — adds the Fix suggestion tab */
  fix?: EdgeFix
  /** how logs prove this edge's traffic (healthy grey edges) */
  evidenceNote?: string
  /** Restrict the list to these entry-service names (e.g. traces crossing a clicked edge). */
  restrictSources?: string[]
  onClose: () => void
  onSynthetic: (traceId: string) => void
}

const RANGES: { id: string; label: string; ms: number }[] = [
  { id: 'all', label: 'All Time', ms: Infinity },
  { id: '15m', label: 'Last 15 Minutes', ms: 15 * 60_000 },
  { id: '1h', label: 'Last 1 Hour', ms: 60 * 60_000 },
  { id: '6h', label: 'Last 6 Hours', ms: 6 * 60 * 60_000 },
]

export function TraceDrawer({ component, rev, running = true, title, initialSource, restrictSources, fix, evidenceNote, onClose, onSynthetic }: Props) {
  const [view, setView] = useState<'traces' | 'fix'>('traces')
  const [traces, setTraces] = useState<TraceSummary[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TraceDetail | null>(null)

  const [query, setQuery] = useState('')
  const [source, setSource] = useState<string>(initialSource ?? 'all')
  const [range, setRange] = useState<string>('all')

  useEffect(() => {
    if (!running) {
      setTraces([])
      return
    }
    api.traces(component, 14, rev).then(setTraces).catch(() => setTraces([]))
  }, [component, rev, running])

  // when opened for a specific node, pre-select that source
  useEffect(() => {
    setSource(initialSource ?? 'all')
  }, [initialSource])

  useEffect(() => {
    if (!openId) return
    setDetail(null)
    api.trace(openId).then(setDetail).catch(() => setDetail(null))
  }, [openId])

  // scope to the edge's flows when opened from a line click; otherwise all component traces
  const scoped = useMemo(() => {
    if (!traces) return null
    if (!restrictSources) return traces
    const allow = new Set(restrictSources)
    return traces.filter((t) => allow.has(t.entryService))
  }, [traces, restrictSources])

  const sources = useMemo(() => {
    const set = new Set((scoped ?? []).map((t) => t.entryService))
    // keep a pre-selected node's source selectable even if it originates no traces
    if (source !== 'all') set.add(source)
    return Array.from(set).sort()
  }, [scoped, source])

  const filtered = useMemo(() => {
    if (!scoped) return null
    const now = Date.now()
    const rangeMs = RANGES.find((r) => r.id === range)?.ms ?? Infinity
    const q = query.trim().toLowerCase()
    return scoped.filter((t) => {
      if (source !== 'all' && t.entryService !== source) return false
      if (q && !t.traceId.toLowerCase().includes(q)) return false
      if (rangeMs !== Infinity && now - new Date(t.startedAt).getTime() > rangeMs) return false
      return true
    })
  }, [scoped, source, query, range])

  return (
    <Drawer onClose={onClose}>
      <Header title={title ?? component} />

      {!running ? (
        <EmptyState
          icon="pulse"
          title="No Traces for This Commit"
          message="This commit isn’t deployed anywhere, so no traffic — and no traces — exist for it."
        />
      ) : (
        <>
      {evidenceNote && (
        <p className="flex items-center gap-1.5 border-b border-stroke-light px-5 py-2 text-caption text-tertiary">
          <Icon name="check" size={12} className="shrink-0 text-healthy" />
          Logged &amp; flowing — {evidenceNote}
        </p>
      )}

      {/* problem edges get two tabs: the evidence and the fix */}
      {fix && (
        <div className="flex gap-1 border-b border-stroke-light px-5 py-2">
          {(['traces', 'fix'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={
                'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ' +
                (view === v ? 'bg-surface-secondary text-primary' : 'text-secondary hover:text-primary')
              }
            >
              {v === 'traces' ? 'Traces' : fix.kind === 'silent' ? 'Evidence' : 'Observability Fix'}
            </button>
          ))}
        </div>
      )}

      {fix && view === 'fix' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {fix.kind === 'missing_logs' ? (
            <EnhancementContent component={fix.sourceName} />
          ) : fix.kind === 'silent' ? (
            <SilentEdgeEvidence component={component} fix={fix} />
          ) : (
            <ErrorRateFix fix={fix} />
          )}
        </div>
      ) : (
        <>
      {/* triage toolbar: query by id · filter by source · filter by time range */}
      <div className="flex flex-col gap-2.5 border-b border-stroke-light px-5 py-3">
        <div className="relative">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Query by trace ID…"
            className="no-focus-ring w-full rounded-md border border-stroke-light bg-surface-secondary py-2 pl-9 pr-3 text-sm text-primary placeholder:text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <div className="flex gap-2">
          <Select
            className="flex-1"
            value={source}
            onChange={setSource}
            ariaLabel="Filter by source service"
            options={[{ value: 'all', label: 'All Sources' }, ...sources.map((s) => ({ value: s, label: s }))]}
          />
          <Select
            className="flex-1"
            value={range}
            onChange={setRange}
            ariaLabel="Filter by time range"
            options={RANGES.map((r) => ({ value: r.id, label: r.label }))}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!filtered ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="pulse"
            title="No Traces Match These Filters"
            message="Try widening the time range or clearing the source filter."
          />
        ) : (
          <ul>
            {filtered.map((t) => (
              <li key={t.traceId} className="border-b border-stroke-light">
                <button
                  onClick={() => setOpenId(openId === t.traceId ? null : t.traceId)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-secondary"
                >
                  <StatusDot kind={t.status === 'error' ? 'error' : 'ok'} />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 text-caption font-medium text-primary">
                      <Icon name="arrow-right" size={12} className="shrink-0 text-tertiary" />
                      <span className="truncate">{t.entryService}</span>
                    </span>
                    <span className="font-mono text-[10px] text-tertiary">{t.traceId}</span>
                  </span>
                  {t.status === 'error' && (
                    <span className="shrink-0 text-[10px] font-medium text-critical">error</span>
                  )}
                  <span className="ml-auto shrink-0 text-caption tabular-nums text-tertiary">{t.durationMs}ms</span>
                </button>

                {openId === t.traceId && (
                  <div className="bg-surface-tertiary px-5 py-4">
                    {!detail ? (
                      <Skeleton className="h-24" />
                    ) : (
                      <>
                        <TraceWaterfall detail={detail} />
                        <Button variant="primary" className="mt-4" onClick={() => onSynthetic(t.traceId)}>
                          Create Synthetic Test
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
        </>
      )}
        </>
      )}
    </Drawer>
  )
}

/** Contextual fix for an edge whose live error rate crossed the threshold. */
function ErrorRateFix({ fix }: { fix: Extract<EdgeFix, { kind: 'error_rate' }> }) {
  const alert = `grafana: rate(${fix.sourceName} → ${fix.targetName} errors) > ${fix.thresholdPct}% for 5m → page owning team`
  const diff = [
    `--- a/src/main/java/com/acme/${fix.sourceName.toLowerCase().replace(/\s+/g, '-')}/DownstreamClient.java`,
    `+++ b/src/main/java/com/acme/${fix.sourceName.toLowerCase().replace(/\s+/g, '-')}/DownstreamClient.java`,
    '@@',
    ' return webClient.post()',
    '     .retrieve()',
    '     .bodyToMono(Response.class)',
    '+    .retryWhen(Retry.backoff(3, Duration.ofMillis(120))',
    '+        .filter(TransientException.class::isInstance))',
    '+    .timeout(Duration.ofSeconds(2))',
  ].join('\n')
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-critical/30 bg-critical-tint p-3 text-sm">
        <p className="font-medium text-critical">
          Error rate {fix.ratePct.toFixed(1)}% over the last {fix.windowMin} min — threshold is {fix.thresholdPct}%
        </p>
        <p className="mt-1 text-secondary">
          Measured from live traffic on {fix.sourceName} → {fix.targetName}. Adjust the threshold and
          window in the map’s gear settings.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary">Suggested Fix</h3>
        <ul className="space-y-1.5 text-sm text-secondary">
          <li className="flex gap-2"><span className="text-accent">•</span>Add bounded retry with backoff and a hard timeout on the call.</li>
          <li className="flex gap-2"><span className="text-accent">•</span>Alert on the sustained error rate so regressions page the owning team.</li>
          <li className="flex gap-2"><span className="text-accent">•</span>Use the traces tab to find the failing requests and their logs.</li>
        </ul>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary">Suggested Diff</h3>
          <CopyButton text={diff} />
        </div>
        <pre className="overflow-x-auto rounded-md bg-surface-secondary p-4 font-mono text-caption leading-relaxed">
          {diff.split('\n').map((line, i) => (
            <div key={i} className={line.startsWith('+') ? 'text-healthy' : 'text-secondary'}>
              {line || ' '}
            </div>
          ))}
        </pre>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary">Suggested Alert</h3>
        <p className="rounded-sm bg-surface-secondary p-2 font-mono text-caption text-secondary">{alert}</p>
      </div>
    </div>
  )
}

function Header({ title }: { title: string }) {
  const close = useOverlayClose()
  return (
    <div className="flex items-center justify-between border-b border-stroke-light p-5">
      <div>
        <h2 className="text-title3 font-semibold text-primary">Traces</h2>
        <p className="text-sm text-secondary">{title}</p>
      </div>
      <IconButton label="Close" onClick={close}>
        <Icon name="close" size={18} />
      </IconButton>
    </div>
  )
}

/**
 * The case file for a mapped-but-silent link: DeepWiki documents the dependency,
 * observability saw nothing cross it — an instrumentation gap or stale code.
 */
function SilentEdgeEvidence({
  component,
  fix,
}: {
  component: string
  fix: Extract<EdgeFix, { kind: 'silent' }>
}) {
  const [wiki, setWiki] = useState<WikiDoc | null>(null)

  useEffect(() => {
    api.nodeWiki(component, fix.sourceId).then(setWiki).catch(() => setWiki(null))
  }, [component, fix.sourceId])

  const depsPage = wiki?.pages.find((pg) => pg.title === 'Dependencies')

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-stroke bg-surface-secondary p-3 text-sm">
        <p className="font-medium text-primary">Mapped, but No Traffic Observed</p>
        <p className="mt-1 text-secondary">
          DeepWiki documents this dependency, yet SPLOC recorded zero calls across it in the live
          window — either the calls aren’t instrumented, or the code path is stale.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary">Evidence of the Relationship</h3>
        <div className="rounded-md border border-stroke-light p-3">
          <p className="font-mono text-caption text-primary">
            {fix.sourceName} → {fix.targetName}
            <span className="ml-2 rounded-sm bg-surface-secondary px-1.5 text-tertiary">{fix.edgeKindLabel}</span>
          </p>
          <p className="mt-1 text-caption text-tertiary">
            Declared in the DeepWiki topology, generated from {fix.sourceName}’s repository source.
          </p>
        </div>
        {depsPage && (
          <blockquote className="mt-2 rounded-md border-l-2 border-accent bg-surface-secondary p-3">
            <p className="text-caption font-medium text-tertiary">
              {wiki?.sourceRepo} · DeepWiki “Dependencies”
            </p>
            <p className="mt-1 whitespace-pre-line text-caption leading-relaxed text-secondary">
              {depsPage.sections[0]?.body}
            </p>
          </blockquote>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary">What This Usually Means</h3>
        <ul className="space-y-1.5 text-sm text-secondary">
          <li className="flex gap-2">
            <span className="text-accent">•</span>
            <span>
              <span className="font-medium text-primary">Observability gap</span> — the calls happen,
              but {fix.sourceName} isn’t propagating trace context on this path, so SPLOC never sees
              them.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent">•</span>
            <span>
              <span className="font-medium text-primary">Stale code</span> — the dependency exists in
              the repository but the path is never exercised anymore; the code (and the coupling) may
              be removable.
            </span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary">Suggested Next Steps</h3>
        <ul className="space-y-1.5 text-sm text-secondary">
          <li className="flex gap-2"><span className="text-accent">•</span>Verify tracing instrumentation on {fix.sourceName}’s outbound {fix.edgeKindLabel} client.</li>
          <li className="flex gap-2"><span className="text-accent">•</span>Run a synthetic through the path — if it appears on the map, it was an instrumentation gap.</li>
          <li className="flex gap-2"><span className="text-accent">•</span>If genuinely unused, remove the dependency and let the next DeepWiki run clear the edge.</li>
        </ul>
      </div>
    </div>
  )
}
