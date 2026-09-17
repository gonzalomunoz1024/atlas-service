import { useEffect, useMemo, useState } from 'react'
import type { EndpointFlow, FlowEvent } from '../types/atlas'
import { Icon } from './ui/Icons'
import { IconButton } from './ui/Button'
import { Select } from './ui/Select'
import { StatusDot } from './ui/StatusDot'
import { EmptyState } from './ui/EmptyState'

export interface IncomingTrace {
  key: string
  traceId: string
  origin?: string
  endpoint?: string
  status: 'ok' | 'error'
  latencyMs: number
  ts: string
}

interface Props {
  nodeName: string
  /** Full endpoint list from DeepWiki — pre-populates the filter before any traffic arrives. */
  endpoints: EndpointFlow[]
  traces: IncomingTrace[]
  onClose: () => void
  /** Notified when the endpoint filter changes ('all' = no filter) so the graph can react. */
  onEndpointChange?: (endpoint: string) => void
  onSelect?: (t: IncomingTrace) => void
}

/**
 * Live feed of requests arriving at the core service. Filterable by the REST endpoint the call
 * landed on — selecting one both narrows this list and drives the graph to that endpoint's sub-flow.
 */
export function IncomingTracesPanel({ nodeName, endpoints: known, traces, onClose, onEndpointChange, onSelect }: Props) {
  const [endpoint, setEndpoint] = useState<string>('all')

  useEffect(() => onEndpointChange?.(endpoint), [endpoint, onEndpointChange])

  // DeepWiki's endpoint list is authoritative; fold in anything unexpected seen live, just in case.
  const endpoints = useMemo(() => {
    const set = new Set<string>(known.map((e) => e.endpoint))
    traces.forEach((t) => t.endpoint && set.add(t.endpoint))
    return Array.from(set).sort()
  }, [known, traces])

  const shown = useMemo(
    () => (endpoint === 'all' ? traces : traces.filter((t) => t.endpoint === endpoint)),
    [traces, endpoint],
  )

  return (
    <aside className="flex h-full w-full flex-col border-r border-stroke-light bg-surface">
      <div className="flex items-center justify-between border-b border-stroke-light p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-healthy opacity-70" />
              <StatusDot kind="ok" className="h-2 w-2" />
            </span>
            <h2 className="truncate text-sm font-semibold text-primary">Incoming · {nodeName}</h2>
          </div>
          <p className="mt-0.5 text-caption text-tertiary">Live requests arriving at this service</p>
        </div>
        <IconButton label="Close" onClick={onClose} className="h-8 w-8 shrink-0">
          <Icon name="close" size={16} />
        </IconButton>
      </div>

      {/* endpoint filter */}
      <div className="border-b border-stroke-light px-4 py-3">
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-tertiary">
          REST endpoint
        </label>
        <Select
          mono
          value={endpoint}
          onChange={setEndpoint}
          ariaLabel="Filter by REST endpoint"
          options={[{ value: 'all', label: 'All endpoints' }, ...endpoints.map((ep) => ({ value: ep, label: ep }))]}
        />
        {endpoint !== 'all' && (
          <p className="mt-1.5 flex items-start gap-1.5 text-caption2 text-tertiary animate-fade-in">
            <Icon name="eye" size={12} className="mt-px shrink-0 text-accent" />
            The map now shows only this endpoint’s flow — who calls it and what it triggers downstream.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <EmptyState
            icon="pulse"
            title="Listening for requests…"
            message="Calls hitting this service appear here in real time."
          />
        ) : (
          <ul>
            {shown.map((t) => (
              <li key={t.key}>
                <button
                  onClick={() => onSelect?.(t)}
                  className="flex w-full items-center gap-3 border-b border-stroke-light px-4 py-2.5 text-left transition-colors hover:bg-surface-secondary animate-fade-in"
                >
                  <StatusDot kind={t.status === 'error' ? 'error' : 'ok'} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-mono text-caption text-primary">{t.endpoint ?? '—'}</span>
                    <span className="flex items-center gap-1.5 truncate text-[10px] text-tertiary">
                      <span className="font-mono">{t.traceId}</span>
                      {t.origin && (
                        <>
                          <span>·</span>
                          <span>from {t.origin}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 text-caption tabular-nums text-tertiary">{t.latencyMs}ms</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

/** Map a live flow event that targets the inspected node into an incoming-trace row. */
export function toIncoming(e: FlowEvent): IncomingTrace {
  return {
    key: e.id,
    traceId: e.traceId,
    origin: e.origin,
    endpoint: e.endpoint,
    status: e.status,
    latencyMs: e.latencyMs,
    ts: e.ts,
  }
}
