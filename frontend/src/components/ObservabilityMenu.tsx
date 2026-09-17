import { useCallback, useRef, useState } from 'react'
import type { CoverageScore } from '../types/atlas'
import { useDismiss } from '../hooks/useDismiss'
import { PopoverPanel } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { CoverageRing } from './CoverageRing'
import { cx } from '../lib/cx'

interface Props {
  coverage?: CoverageScore
  onCoverage?: () => void
  onTraces?: () => void
  onWiki?: () => void
}

/**
 * The observability entry point — an eye in the bottom-left cluster. Opens
 * upward with the logging-coverage ring, traces, and DeepWiki.
 */
export function ObservabilityMenu({ coverage, onCoverage, onTraces, onWiki }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  const pick = (fn?: () => void) => () => {
    close()
    fn?.()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Observability"
        aria-expanded={open}
        title="Observability"
        className={cx(
          'glass flex h-9 w-9 items-center justify-center rounded-full border border-stroke-light shadow-card',
          'text-secondary transition-all duration-150 hover:text-primary active:scale-[0.94]',
          open && 'text-primary',
        )}
      >
        <Icon name="eye" size={18} />
      </button>

      {open && (
        <PopoverPanel className="absolute bottom-11 left-0 w-60 origin-bottom-left py-1.5">
          {coverage && (
            <button
              onClick={pick(onCoverage)}
              className="flex w-full items-center gap-2.5 border-b border-stroke-light px-4 py-2.5 text-left transition-colors hover:bg-surface-secondary"
            >
              <CoverageRing score={coverage.score} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-primary">Logging coverage</span>
                <span className="block text-caption2 text-tertiary">
                  {coverage.loggedEdges} of {coverage.observedEdges} live links logged
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-secondary">{coverage.score}%</span>
            </button>
          )}
          {onTraces && (
            <button
              onClick={pick(onTraces)}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-secondary transition-colors hover:bg-surface-secondary hover:text-primary"
            >
              <Icon name="pulse" size={15} className="text-tertiary" />
              Traces
            </button>
          )}
          {onWiki && (
            <button
              onClick={pick(onWiki)}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-secondary transition-colors hover:bg-surface-secondary hover:text-primary"
            >
              <Icon name="doc" size={15} className="text-tertiary" />
              DeepWiki
            </button>
          )}
        </PopoverPanel>
      )}
    </div>
  )
}
