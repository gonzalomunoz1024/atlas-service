import { useMemo, useState } from 'react'
import type { HealthMap, HealthEdge } from '../types/atlas'
import { EDGE_KIND_LABEL, EVIDENCE_LABEL, LINK_LABEL } from '../lib/nodeVisuals'
import { Modal, useOverlayClose } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { Button, IconButton } from './ui/Button'
import { StatusDot, type DotKind } from './ui/StatusDot'

type SortKey = 'source' | 'target' | 'kind' | 'linkStatus' | 'callsPerMin' | 'errorRate' | 'p95LatencyMs'

const STATUS_DOT: Record<HealthEdge['linkStatus'], DotKind> = {
  healthy: 'ok',
  missing_logs: 'warning',
  silent: 'muted',
}

export function CoverageTable({ map, onClose }: { map: HealthMap; onClose: () => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'linkStatus', dir: 1 })

  const nameById = useMemo(() => new Map(map.nodes.map((n) => [n.id, n.name])), [map.nodes])

  const rows = useMemo(() => {
    const order: Record<HealthEdge['linkStatus'], number> = { missing_logs: 0, silent: 1, healthy: 2 }
    return [...map.edges].sort((a, b) => {
      let av: string | number = a[sort.key]
      let bv: string | number = b[sort.key]
      if (sort.key === 'linkStatus') {
        av = order[a.linkStatus]
        bv = order[b.linkStatus]
      }
      if (av < bv) return -1 * sort.dir
      if (av > bv) return 1 * sort.dir
      return 0
    })
  }, [map.edges, sort])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))

  const { coverage } = map

  return (
    <Modal onClose={onClose} width="max-w-5xl">
      <TableHeader coverage={coverage} />

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface-secondary text-left text-caption text-secondary">
            <tr>
              <Th onClick={() => toggle('source')} active={sort.key === 'source'} dir={sort.dir}>Source</Th>
              <Th onClick={() => toggle('target')} active={sort.key === 'target'} dir={sort.dir}>Target</Th>
              <Th onClick={() => toggle('kind')} active={sort.key === 'kind'} dir={sort.dir}>Type</Th>
              <Th onClick={() => toggle('linkStatus')} active={sort.key === 'linkStatus'} dir={sort.dir}>Status</Th>
              <th className="px-4 py-2.5 font-medium">Log evidence</th>
              <Th onClick={() => toggle('callsPerMin')} active={sort.key === 'callsPerMin'} dir={sort.dir} num>Calls/min</Th>
              <Th onClick={() => toggle('errorRate')} active={sort.key === 'errorRate'} dir={sort.dir} num>Error %</Th>
              <Th onClick={() => toggle('p95LatencyMs')} active={sort.key === 'p95LatencyMs'} dir={sort.dir} num>p95</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-stroke-light transition-colors hover:bg-surface-secondary">
                <td className="px-4 py-2.5 font-mono text-caption text-primary">{nameById.get(e.source) ?? e.source}</td>
                <td className="px-4 py-2.5 font-mono text-caption text-primary">{nameById.get(e.target) ?? e.target}</td>
                <td className="px-4 py-2.5 text-secondary">{EDGE_KIND_LABEL[e.kind]}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot kind={STATUS_DOT[e.linkStatus]} />
                    <span className={e.linkStatus === 'missing_logs' ? 'text-warning' : 'text-secondary'}>
                      {LINK_LABEL[e.linkStatus]}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-caption text-secondary">{EVIDENCE_LABEL[e.logEvidence]}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-secondary">
                  {e.observed ? e.callsPerMin.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-secondary">
                  {e.observed ? (e.errorRate * 100).toFixed(2) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-secondary">
                  {e.observed ? `${e.p95LatencyMs}ms` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-stroke-light px-5 py-3 text-caption text-tertiary">
        <span>{rows.length} links · source: DeepWiki topology ⋈ Splunk/SPLOC</span>
        <Button size="sm" onClick={() => downloadCsv(rows, nameById)}>
          Export CSV
        </Button>
      </div>
    </Modal>
  )
}

function TableHeader({ coverage }: { coverage: HealthMap['coverage'] }) {
  const close = useOverlayClose()
  return (
    <div className="flex items-start justify-between border-b border-stroke-light p-5">
      <div>
        <h2 className="text-title3 font-semibold text-primary">Logging coverage</h2>
        <p className="mt-1 text-sm text-secondary">
          <span className="font-semibold tabular-nums text-primary">{coverage.score}%</span> —{' '}
          {coverage.loggedEdges} of {coverage.observedEdges} live links reach Splunk
          {coverage.observedEdges < coverage.totalEdges && (
            <> · {coverage.totalEdges - coverage.observedEdges} mapped link(s) show no traffic</>
          )}
        </p>
      </div>
      <IconButton label="Close" onClick={close}>
        <Icon name="close" size={18} />
      </IconButton>
    </div>
  )
}

function Th({
  children,
  onClick,
  active,
  dir,
  num,
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  dir: 1 | -1
  num?: boolean
}) {
  return (
    <th className={`px-4 py-2.5 font-medium ${num ? 'text-right' : ''}`}>
      <button onClick={onClick} className="inline-flex items-center gap-1 transition-colors hover:text-primary">
        {children}
        <Icon
          name="chevron-down"
          size={11}
          className={`text-accent transition-all ${active ? (dir === 1 ? 'rotate-180 opacity-100' : 'opacity-100') : 'opacity-0'}`}
        />
      </button>
    </th>
  )
}

function downloadCsv(rows: HealthEdge[], nameById: Map<string, string>) {
  const header = ['source', 'target', 'type', 'status', 'log_evidence', 'observed', 'calls_per_min', 'error_rate', 'p95_ms']
  const lines = rows.map((e) =>
    [
      nameById.get(e.source) ?? e.source,
      nameById.get(e.target) ?? e.target,
      e.kind,
      e.linkStatus,
      e.logEvidence,
      e.observed,
      e.callsPerMin,
      e.errorRate,
      e.p95LatencyMs,
    ].join(','),
  )
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'atlas-logging-coverage.csv'
  a.click()
  URL.revokeObjectURL(url)
}
