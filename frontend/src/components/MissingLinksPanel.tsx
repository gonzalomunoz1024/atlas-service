import { useCallback, useRef, useState } from 'react'
import type { HealthEdge } from '../types/atlas'
import { EDGE_KIND_LABEL, LINK_LABEL } from '../lib/nodeVisuals'
import { useDismiss } from '../hooks/useDismiss'
import { PopoverPanel } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { IconButton } from './ui/Button'
import { StatusDot } from './ui/StatusDot'
import { cx } from '../lib/cx'

interface Props {
  edges: HealthEdge[]
  onFocus: (edge: HealthEdge) => void
  /** plays a one-shot attention pulse (the insight moment) */
  pulse?: boolean
}

export function MissingLinksPanel({ edges, onFocus, pulse }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  const flagged = edges
    .filter((e) => e.linkStatus !== 'healthy')
    .sort((a, b) => rank(a) - rank(b))

  // Healthy state: a quiet, positive pill. Nothing to expand.
  if (flagged.length === 0) {
    return (
      <div className="glass flex items-center gap-2 rounded-full border border-stroke-light px-3.5 py-2 shadow-card">
        <Icon name="check" size={13} className="text-healthy" />
        <span className="text-caption font-medium text-secondary">All Links Logged</span>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      {/* minimized: just the hazard sign — clean, non-blocking. Click to expand. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${flagged.length} missing link${flagged.length === 1 ? '' : 's'}`}
        title={`${flagged.length} missing link${flagged.length === 1 ? '' : 's'}`}
        className={cx(
          'glass relative flex h-10 w-10 items-center justify-center rounded-full border border-stroke-light shadow-card',
          'transition-all duration-150 hover:brightness-[0.98] active:scale-[0.94]',
          pulse && 'animate-pulse-once',
        )}
      >
        <Icon name="warning" size={19} className="text-warning" />
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold leading-none text-white shadow-sm">
          {flagged.length}
        </span>
      </button>

      {/* expandable popup — opens downward from the top-right, overlays the graph */}
      {open && (
        <PopoverPanel className="absolute right-0 top-full mt-2 w-72 origin-top-right">
          <div className="flex items-center justify-between border-b border-stroke-light px-4 py-3">
            <div>
              <span className="text-sm font-semibold text-primary">Missing Links</span>
              <p className="mt-0.5 text-caption2 text-tertiary">
                Traffic is flowing, but no logs land in Splunk
              </p>
            </div>
            <IconButton label="Collapse" onClick={close} className="h-7 w-7">
              <Icon name="close" size={14} />
            </IconButton>
          </div>
          <ul className="max-h-[46vh] overflow-y-auto">
            {flagged.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => onFocus(e)}
                  className="flex w-full flex-col gap-0.5 border-b border-stroke-light px-4 py-2.5 text-left transition-colors hover:bg-surface-secondary"
                >
                  <span className="font-mono text-caption text-primary">
                    {e.source} → {e.target}
                  </span>
                  <span className="flex items-center gap-2 text-caption text-tertiary">
                    <StatusDot kind={e.linkStatus === 'missing_logs' ? 'warning' : 'muted'} className="h-1.5 w-1.5" />
                    <span>{EDGE_KIND_LABEL[e.kind]}</span>
                    <span>·</span>
                    <span className={cx(e.linkStatus === 'missing_logs' && 'text-warning')}>
                      {LINK_LABEL[e.linkStatus]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverPanel>
      )}
    </div>
  )
}

function rank(e: HealthEdge): number {
  return e.linkStatus === 'missing_logs' ? 0 : e.linkStatus === 'silent' ? 1 : 2
}
