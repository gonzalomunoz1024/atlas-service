import { useCallback, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { PopoverPanel } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { cx } from '../lib/cx'

export interface HealthSettings {
  /** error-rate fraction above which a link turns red (default 0.10) */
  errorThreshold: number
  /** rolling window in minutes over which the rate is measured (default 15) */
  windowMin: number
}

/** how far the map reaches from the source repository, in hops (default 3, max 8) */
export const DEFAULT_MAX_DEPTH = 3
export const MAX_DEPTH_LIMIT = 8

interface Props {
  settings: HealthSettings
  onChange: (s: HealthSettings) => void
  maxDepth: number
  onMaxDepth: (n: number) => void
  /** fires on open/close — the legend keeps its chip set stable while the popover is up */
  onOpenChange?: (open: boolean) => void
}

/** Gear with two panes: link health (threshold + window) and node settings (graph depth). */
export function EdgeHealthSettings({ settings, onChange, maxDepth, onMaxDepth, onOpenChange }: Props) {
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<'health' | 'nodes'>('health')
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    onOpenChange?.(false)
  }, [onOpenChange])
  useDismiss(ref, open, close)

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggleOpen}
        aria-label="Map settings"
        aria-expanded={open}
        className={cx(
          'glass flex h-9 w-9 items-center justify-center rounded-full border border-stroke-light shadow-card',
          'text-secondary transition-all duration-150 hover:text-primary active:scale-[0.94]',
          open && 'text-primary',
        )}
      >
        <Icon name="gear" size={17} />
      </button>

      {open && (
        <PopoverPanel className="absolute bottom-11 left-0 w-64 origin-bottom-left p-4">
          <div className="flex gap-1">
            {(['health', 'nodes'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPane(p)}
                className={cx(
                  'rounded-sm px-2.5 py-1 text-caption font-medium transition-colors',
                  pane === p ? 'bg-surface-secondary text-primary' : 'text-secondary hover:text-primary',
                )}
              >
                {p === 'health' ? 'Link Health' : 'Node Settings'}
              </button>
            ))}
          </div>

          {pane === 'health' ? (
            <>
              <p className="mt-2 text-caption text-tertiary">
                Links turn <span className="text-critical">red</span> when the error rate exceeds the
                threshold — otherwise they stay neutral.
              </p>

              <label className="mt-4 flex items-center justify-between text-caption text-secondary">
                <span>Error-Rate Threshold</span>
                <span className="font-mono tabular-nums text-primary">
                  {Math.round(settings.errorThreshold * 100)}%
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={Math.round(settings.errorThreshold * 100)}
                onChange={(e) => onChange({ ...settings, errorThreshold: Number(e.target.value) / 100 })}
                className="mt-1 w-full accent-[var(--color-neutral)]"
              />

              <label className="mt-4 flex items-center justify-between text-caption text-secondary">
                <span>Rolling Window</span>
                <span className="font-mono tabular-nums text-primary">{settings.windowMin} min</span>
              </label>
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={settings.windowMin}
                onChange={(e) => onChange({ ...settings, windowMin: Number(e.target.value) })}
                className="mt-1 w-full accent-[var(--color-neutral)]"
              />
            </>
          ) : (
            <>
              <p className="mt-2 text-caption text-tertiary">
                How far the dependency graph reaches from the source repository.
              </p>

              <label className="mt-4 flex items-center justify-between text-caption text-secondary">
                <span>Nodes From Source</span>
                <span className="font-mono tabular-nums text-primary">
                  {maxDepth} hop{maxDepth === 1 ? '' : 's'}
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={MAX_DEPTH_LIMIT}
                step={1}
                value={maxDepth}
                onChange={(e) => onMaxDepth(Number(e.target.value))}
                className="mt-1 w-full accent-[var(--color-neutral)]"
              />
              <div className="mt-1 flex justify-between font-mono text-caption2 tabular-nums text-tertiary">
                <span>1</span>
                <span>{MAX_DEPTH_LIMIT}</span>
              </div>
            </>
          )}
        </PopoverPanel>
      )}
    </div>
  )
}
