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

interface Props {
  settings: HealthSettings
  onChange: (s: HealthSettings) => void
}

/** Gear that configures the link error-rate threshold and the rolling window. */
export function EdgeHealthSettings({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Link health settings"
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
          <div className="text-sm font-semibold text-primary">Link Health</div>
          <p className="mt-0.5 text-caption text-tertiary">
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
        </PopoverPanel>
      )}
    </div>
  )
}
