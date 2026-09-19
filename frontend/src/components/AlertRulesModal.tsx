import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { AlertPlan } from '../types/atlas'
import { Modal, useOverlayClose } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { IconButton } from './ui/Button'
import { Skeleton } from './ui/Skeleton'
import { CopyButton } from './CopyButton'
import { cx } from '../lib/cx'

interface Props {
  component: string
  traceId: string
  /** present when opened from the safeguard chooser — returns to it */
  onBack?: () => void
  onClose: () => void
}

/** Alert rules for Splunk/SPLOC derived from a trace's call path (opens over the trace drawer). */
export function AlertRulesModal({ component, traceId, onBack, onClose }: Props) {
  const [plan, setPlan] = useState<AlertPlan | null>(null)

  useEffect(() => {
    api.alertsFromTrace(component, traceId).then(setPlan).catch(() => setPlan(null))
  }, [component, traceId])

  return (
    <Modal onClose={onClose} raised width="max-w-2xl">
      <Header traceId={traceId} onBack={onBack} />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {!plan ? (
          <>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <p className="text-sm text-secondary">{plan.summary}</p>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Manifest</h3>
                <CopyButton text={plan.manifestYaml} />
              </div>
              <pre className="max-h-64 overflow-auto rounded-md bg-surface-secondary p-4 font-mono text-caption leading-relaxed text-secondary">
                {plan.manifestYaml}
              </pre>
            </div>

            <h3 className="text-sm font-semibold text-primary">Rules Explained</h3>
            {plan.rules.map((r, i) => (
              <div key={i} className="rounded-md border border-stroke-light p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cx(
                      'rounded-full px-2 py-0.5 font-mono text-caption2 font-medium uppercase',
                      r.system === 'splunk' ? 'bg-warning-tint text-warning' : 'bg-accent-tint text-accent',
                    )}
                  >
                    {r.system}
                  </span>
                  <span className="text-sm font-semibold text-primary">{r.name}</span>
                  <span className="ml-auto">
                    <CopyButton text={r.query} />
                  </span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded-sm bg-surface-secondary p-2.5 font-mono text-caption leading-relaxed text-secondary">
                  {r.query}
                </pre>
                <p className="mt-1.5 text-caption text-tertiary">{r.rationale}</p>
              </div>
            ))}

            <p className="rounded-md bg-surface-secondary p-3 text-center text-caption text-tertiary">
              Copy the manifest into your repo. Creating rules directly via the Splunk/SPLOC
              alerting APIs isn’t available against mock data.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}

function Header({ traceId, onBack }: { traceId: string; onBack?: () => void }) {
  const close = useOverlayClose()
  return (
    <div className="flex items-center justify-between border-b border-stroke-light p-5">
      <div className="flex items-center gap-3">
        {onBack && (
          <IconButton label="Back to safeguards" onClick={onBack} className="-ml-1.5">
            <Icon name="chevron-right" size={16} className="rotate-180" />
          </IconButton>
        )}
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-tint text-accent">
          <Icon name="doc" size={19} />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-title3 font-semibold text-primary">Alert Manifest</h2>
            <span className="rounded-sm bg-accent-tint px-2 py-0.5 text-caption font-semibold text-accent">
              Observability as Code
            </span>
          </div>
          <p className="font-mono text-caption text-secondary">{traceId}</p>
        </div>
      </div>
      <IconButton label="Close" onClick={close}>
        <Icon name="close" size={18} />
      </IconButton>
    </div>
  )
}
