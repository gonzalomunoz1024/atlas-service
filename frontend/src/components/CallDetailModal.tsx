import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { EndpointStat, TraceDetail } from '../types/atlas'
import type { IncomingTrace } from './IncomingTracesPanel'
import { Modal, useOverlayClose } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { Button, IconButton } from './ui/Button'
import { StatusDot } from './ui/StatusDot'
import { Skeleton } from './ui/Skeleton'
import { TraceWaterfall } from './TraceWaterfall'

interface Props {
  component: string
  /** the node the call arrived at — endpoint stats are served for it, never tab-derived */
  nodeId: string
  call: IncomingTrace
  onClose: () => void
  onSafeguards: (traceId: string, endpoint?: string) => void
}

/** Detail popup for one observed incoming call: metrics, trace waterfall + logs, safeguard action. */
export function CallDetailModal({ component, nodeId, call, onClose, onSafeguards }: Props) {
  const [detail, setDetail] = useState<TraceDetail | null>(null)
  const [stat, setStat] = useState<EndpointStat | null>(null)

  useEffect(() => {
    api.trace(call.traceId).then(setDetail).catch(() => setDetail(null))
  }, [call.traceId])

  // endpoint metrics come from the observability backend's window, not this tab's buffer
  useEffect(() => {
    api
      .endpointStats(component, nodeId)
      .then((rows) => setStat(rows.find((r) => r.endpoint === call.endpoint) ?? null))
      .catch(() => setStat(null))
  }, [component, nodeId, call.endpoint])

  return (
    <Modal onClose={onClose} width="max-w-3xl">
      <Header call={call} />

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {/* this call + endpoint-level metrics over the live window */}
        <div className="grid grid-cols-4 gap-3">
          <Stat label="This Call" value={`${call.latencyMs}ms`} />
          <Stat label="Avg Latency (15m)" value={stat ? `${stat.avgLatencyMs}ms` : '…'} />
          <Stat label="Error Rate (15m)" value={stat ? `${stat.errorRatePct.toFixed(1)}%` : '…'} />
          <Stat label="Received" value={new Date(call.ts).toLocaleTimeString()} />
        </div>
        <p className="mt-1.5 text-caption2 text-tertiary">
          Windowed endpoint stats from SPLOC; only This Call and Received are from this session.
        </p>

        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-primary">Trace &amp; Logs</h3>
          {!detail ? <Skeleton className="h-32" /> : <TraceWaterfall detail={detail} />}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Button variant="primary" onClick={() => onSafeguards(call.traceId, call.endpoint)}>
            <Icon name="shield" size={14} />
            Add Safeguards
          </Button>
          <span className="text-caption text-tertiary">
            Turn this call into tests that replay it and alerts that watch it. Payloads are rebuilt
            from the endpoint’s OpenAPI spec.
          </span>
        </div>
      </div>
    </Modal>
  )
}

function Header({ call }: { call: IncomingTrace }) {
  const close = useOverlayClose()
  return (
    <div className="flex items-start justify-between border-b border-stroke-light p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot kind={call.status === 'error' ? 'error' : 'ok'} />
          <h2 className="truncate font-mono text-title3 font-semibold text-primary">
            {call.endpoint ?? 'Incoming Call'}
          </h2>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-tertiary">
          <span className="font-mono">{call.traceId}</span>
          {call.origin && (
            <>
              <span>·</span>
              <span>from {call.origin}</span>
            </>
          )}
          {call.status === 'error' && <span className="font-medium text-critical">error</span>}
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
