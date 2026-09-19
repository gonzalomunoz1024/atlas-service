import { useState } from 'react'
import type { Span, TraceDetail } from '../types/atlas'
import { Icon } from './ui/Icons'
import { cx } from '../lib/cx'

/** Span waterfall with expandable per-span logs — shared by TraceDrawer and CallDetailModal. */
export function TraceWaterfall({ detail }: { detail: TraceDetail }) {
  const total = detail.durationMs || 1
  return (
    <div className="space-y-1.5">
      {detail.spans.map((s) => (
        <SpanRow key={s.spanId} span={s} total={total} />
      ))}
    </div>
  )
}

function SpanRow({ span, total }: { span: Span; total: number }) {
  const [open, setOpen] = useState(false)
  const left = Math.min(98.5, (span.startOffsetMs / total) * 100)
  // clamp to the track so long, late-starting spans never spill into the ms column
  const width = Math.min(100 - left, Math.max(1.5, (span.durationMs / total) * 100))
  return (
    <div>
      <button
        onClick={() => span.hasLogs && setOpen((o) => !o)}
        className={cx('flex w-full items-center gap-2', !span.hasLogs && 'cursor-default')}
      >
        <span className="w-32 shrink-0 truncate text-right font-mono text-caption2 text-secondary">
          {span.service}
        </span>
        <span className="relative h-4 flex-1 overflow-hidden rounded-[4px] bg-surface-secondary">
          <span
            className={cx(
              'absolute top-0 h-4 rounded-[4px] opacity-85',
              span.status === 'error' ? 'bg-critical' : 'bg-accent',
            )}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        </span>
        <span className="w-12 shrink-0 text-right text-caption2 tabular-nums text-tertiary">
          {span.durationMs}ms
        </span>
        <span className="w-16 shrink-0 text-right">
          {span.hasLogs ? (
            <Icon
              name="chevron-down"
              size={11}
              className={cx('inline text-tertiary transition-transform', !open && '-rotate-90')}
            />
          ) : (
            <span className="rounded-full bg-warning-tint px-1.5 text-[10px] font-medium text-warning">
              no logs
            </span>
          )}
        </span>
      </button>
      {open && span.hasLogs && (
        <div className="ml-[136px] mt-1 rounded-sm bg-surface p-2 font-mono text-caption2 leading-relaxed">
          {span.logs.map((l, i) => (
            <div key={i} className="flex gap-2">
              <span
                className={cx(
                  'shrink-0',
                  l.level === 'ERROR' ? 'text-critical' : l.level === 'WARN' ? 'text-warning' : 'text-tertiary',
                )}
              >
                {l.level}
              </span>
              <span className="text-secondary">{l.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
