import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { AlertPlan } from '../types/atlas'
import { Modal, useOverlayClose } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { Button, IconButton } from './ui/Button'
import { Skeleton } from './ui/Skeleton'
import { CopyButton } from './CopyButton'
import { cx } from '../lib/cx'

interface Props {
  component: string
  traceId: string
  onClose: () => void
}

/** Alert rules for Splunk/SPLOC derived from a trace's call path (opens over the trace drawer). */
export function AlertRulesModal({ component, traceId, onClose }: Props) {
  const [plan, setPlan] = useState<AlertPlan | null>(null)

  useEffect(() => {
    api.alertsFromTrace(component, traceId).then(setPlan).catch(() => setPlan(null))
  }, [component, traceId])

  return (
    <Modal onClose={onClose} raised width="max-w-2xl">
      <Header traceId={traceId} />

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

            <Button
              variant="primary"
              className="w-full py-2.5 disabled:opacity-50"
              disabled
              title="Creates the rules through the Splunk/SPLOC alerting APIs — not available against mock data"
            >
              Create {plan.rules.length} Alert{plan.rules.length === 1 ? '' : 's'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}

function Header({ traceId }: { traceId: string }) {
  const close = useOverlayClose()
  return (
    <div className="flex items-center justify-between border-b border-stroke-light p-5">
      <div>
        <h2 className="text-title3 font-semibold text-primary">Observability as Code</h2>
        <p className="font-mono text-sm text-secondary">{traceId}</p>
      </div>
      <IconButton label="Close" onClick={close}>
        <Icon name="close" size={18} />
      </IconButton>
    </div>
  )
}
