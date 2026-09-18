import { useEffect, useState } from 'react'
import type { ApiOperation, ComponentNode, HealthEdge, WikiDoc } from '../types/atlas'
import { api } from '../lib/api'
import { EDGE_KIND_LABEL, EVIDENCE_LABEL, HEALTH_COLOR_VAR, LINK_COLOR_VAR, LINK_LABEL, NODE_LABEL } from '../lib/nodeVisuals'
import { NodeGlyph } from './NodeGlyph'
import { Modal, useOverlayClose } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { Button, IconButton } from './ui/Button'
import { StatusDot } from './ui/StatusDot'
import { SkeletonRows } from './ui/Skeleton'
import { EmptyState } from './ui/EmptyState'
import { cx } from '../lib/cx'

type Tab = 'overview' | 'wiki' | 'api'

interface Props {
  component: string
  node: ComponentNode
  edges: HealthEdge[]
  /** false when viewing an undeployed commit — no observability data exists */
  running?: boolean
  initialTab?: Tab
  onClose: () => void
  onViewTraces: () => void
  onEnhance: () => void
  onBlast: () => void
}

export function NodeModal({ component, node, edges, running = true, initialTab = 'overview', onClose, onViewTraces, onEnhance, onBlast }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [wiki, setWiki] = useState<WikiDoc | null>(null)
  const [wikiError, setWikiError] = useState(false)
  const [wikiPage, setWikiPage] = useState(0)
  const [spec, setSpec] = useState<ApiOperation[] | null>(null)

  // prefetch the OpenAPI spec so the tab only appears when the repo has one
  useEffect(() => {
    api.nodeOpenApi(component, node.id).then(setSpec).catch(() => setSpec([]))
  }, [component, node.id])

  const related = edges.filter((e) => e.source === node.id || e.target === node.id)
  const missingLog = running && related.some((e) => e.linkStatus === 'missing_logs')

  useEffect(() => {
    if (tab === 'wiki' && !wiki) {
      api
        .nodeWiki(component, node.id)
        .then(setWiki)
        .catch(() => setWikiError(true))
    }
  }, [tab, wiki, component, node.id])

  return (
    <Modal onClose={onClose} width="max-w-4xl">
      <Header node={node} running={running} />

      {/* tabs */}
      <div className="flex gap-1 px-5 pt-3">
        {(['overview', 'wiki', ...(spec && spec.length > 0 ? (['api'] as Tab[]) : [])] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              'rounded-sm px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-surface-secondary text-primary' : 'text-secondary hover:text-primary',
            )}
          >
            {t === 'wiki' ? 'DeepWiki' : t === 'api' ? 'OpenAPI' : t}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === 'overview' && (
          <div className="space-y-5">
            {running ? (
              <div>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Connections" value={String(related.length)} />
                  <Stat label="Calls / Min" value={related.reduce((a, e) => a + e.callsPerMin, 0).toLocaleString()} />
                  <Stat label="Max p95" value={`${Math.max(0, ...related.map((e) => e.p95LatencyMs))}ms`} />
                </div>
                <p className="mt-1.5 text-caption2 text-tertiary">
                  Connections from DeepWiki · Calls / Min &amp; Max p95 from SPLOC caller-side spans
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-surface-secondary p-3 text-sm text-secondary">
                This commit isn’t deployed — no live metrics, traces, or logging data exist for it.
                Showing repository knowledge only.
              </div>
            )}

            {missingLog && (
              <div className="rounded-md border border-warning/40 bg-warning-tint p-3 text-sm">
                <p className="font-medium text-warning">Logging Gap Detected</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-secondary">A live call path touching this node has no logs in Splunk.</p>
                  {node.owned && (
                    <Button size="sm" variant="warning-outline" onClick={onEnhance} className="shrink-0">
                      Fix
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-primary">Connections</h3>
              <ul className="space-y-1.5">
                {related.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <StatusDot varName={running ? LINK_COLOR_VAR[e.linkStatus] : '--color-text-tertiary'} />
                    <span className="font-mono text-caption text-secondary">
                      {e.source === node.id ? `→ ${e.target}` : `← ${e.source}`}
                    </span>
                    <span className="rounded-sm bg-surface-secondary px-1.5 text-caption text-tertiary">
                      {EDGE_KIND_LABEL[e.kind]}
                    </span>
                    {running && (
                      <span
                        className="ml-auto text-caption text-tertiary"
                        title={e.logEvidence !== 'none' ? EVIDENCE_LABEL[e.logEvidence] : undefined}
                      >
                        {LINK_LABEL[e.linkStatus]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {running && (
                <Button variant="primary" onClick={onViewTraces}>
                  View Traces
                </Button>
              )}
              <Button onClick={onBlast}>Blast Radius</Button>
            </div>
          </div>
        )}

        {tab === 'api' && spec && (
          <div className="space-y-4">
            <p className="text-caption text-tertiary">
              Extracted by DeepWiki from the repository’s OpenAPI spec — request examples power
              synthetic-transaction payloads.
            </p>
            {spec.map((op) => (
              <ApiOpCard key={`${op.method} ${op.path}`} op={op} />
            ))}
          </div>
        )}

        {tab === 'wiki' &&
          (wikiError ? (
            <EmptyState
              icon="doc"
              title="DeepWiki Unavailable"
              message="Docs for this node haven’t been generated yet."
            />
          ) : !wiki ? (
            <SkeletonRows />
          ) : (
            <div className="flex gap-6">
              {/* left: page navigation */}
              <nav className="sticky top-0 h-fit w-44 shrink-0 self-start">
                <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-tertiary">
                  Pages
                </div>
                <ul className="space-y-0.5">
                  {wiki.pages.map((p, i) => (
                    <li key={p.title}>
                      <button
                        onClick={() => setWikiPage(i)}
                        className={cx(
                          'flex w-full items-baseline gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors',
                          i === wikiPage
                            ? 'bg-surface-secondary font-medium text-primary'
                            : 'text-secondary hover:bg-surface-secondary hover:text-primary',
                        )}
                      >
                        <span className="text-caption tabular-nums text-tertiary">{i + 1}</span>
                        <span className="min-w-0 truncate">{p.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-1.5 px-2.5">
                  {wiki.tags.map((t) => (
                    <span key={t} className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] text-secondary">
                      {t}
                    </span>
                  ))}
                </div>
              </nav>

              {/* right: selected page content */}
              <article className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-caption text-tertiary">
                  <span className="rounded-full bg-surface-secondary px-2 py-0.5 font-mono">{wiki.sourceRepo}</span>
                  <span>generated {new Date(wiki.generatedAt).toLocaleDateString()}</span>
                  <span className="rounded-full bg-accent-tint px-2 py-0.5 text-accent">Devin DeepWiki</span>
                </div>
                {(() => {
                  const page = wiki.pages[wikiPage] ?? wiki.pages[0]
                  return (
                    <>
                      <h2 className="text-title3 font-semibold text-primary">{page.title}</h2>
                      <p className="mt-1 text-sm text-secondary">{page.summary}</p>
                      <div className="mt-5 space-y-5">
                        {page.sections.map((s) => (
                          <div key={s.heading}>
                            <h3 className="mb-1 text-sm font-semibold text-primary">{s.heading}</h3>
                            <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">{s.body}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </article>
            </div>
          ))}
      </div>
    </Modal>
  )
}

function Header({ node, running }: { node: ComponentNode; running: boolean }) {
  const close = useOverlayClose()
  return (
    <div className="flex items-start gap-4 border-b border-stroke-light p-5">
      <NodeGlyph kind={node.kind} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-title2 font-semibold text-primary">{node.name}</h2>
          {node.center && (
            <span className="rounded-full bg-accent-tint px-2 py-0.5 text-caption text-accent">focus</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-secondary">
          <span>{NODE_LABEL[node.kind]}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <StatusDot varName={running ? HEALTH_COLOR_VAR[node.health] : HEALTH_COLOR_VAR.unknown} />
            {running ? node.health : 'unknown'}
          </span>
          {node.app && (
            <>
              <span>·</span>
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-caption font-medium',
                  node.owned ? 'bg-accent-tint text-accent' : 'bg-surface-secondary text-secondary',
                )}
                title={node.owned ? 'Your application' : 'A different application'}
              >
                {node.app}
                {node.owned || node.kind === 'external' ? '' : ' · external'}
              </span>
            </>
          )}
          {node.cluster && (
            <>
              <span>·</span>
              <span className="font-mono text-caption text-tertiary">cluster: {node.cluster}</span>
            </>
          )}
        </div>
      </div>
      <IconButton label="Close" onClick={close}>
        <Icon name="close" size={18} />
      </IconButton>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-secondary p-3">
      <div className="text-title3 font-semibold tabular-nums text-primary">{value}</div>
      <div className="text-caption text-tertiary">{label}</div>
    </div>
  )
}

/** One OpenAPI operation — request body starts collapsed. */
function ApiOpCard({ op }: { op: ApiOperation }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-stroke-light p-4">
      <div className="flex items-center gap-2">
        <span
          className={cx(
            'rounded-sm px-2 py-0.5 font-mono text-caption font-semibold',
            op.method === 'GET' ? 'bg-accent-tint text-accent' : 'bg-healthy-tint text-healthy',
          )}
        >
          {op.method}
        </span>
        <span className="font-mono text-sm text-primary">{op.path}</span>
      </div>
      {op.summary && <p className="mt-2 text-sm text-secondary">{op.summary}</p>}
      {op.requestBodyExample && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-3 flex items-center gap-1.5 text-caption font-medium text-secondary transition-colors hover:text-primary"
          >
            <Icon
              name="chevron-down"
              size={11}
              className={cx('transition-transform duration-150', !open && '-rotate-90')}
            />
            Request body
          </button>
          {open && (
            <pre className="mt-2 overflow-x-auto rounded-sm bg-surface-secondary p-3 font-mono text-caption leading-relaxed text-primary animate-fade-in">
              {op.requestBodyExample}
            </pre>
          )}
        </>
      )}
    </div>
  )
}
