import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { EnhancementPlan } from '../types/atlas'
import { CopyButton } from './CopyButton'
import { Button } from './ui/Button'
import { Skeleton } from './ui/Skeleton'
import { EmptyState } from './ui/EmptyState'

/**
 * The logging/alerting enhancement plan body — fetches and renders the plan for a
 * component. Shared by EnhancementDrawer and the edge "Fix suggestion" tab.
 */
export function EnhancementContent({ component }: { component: string }) {
  const [plan, setPlan] = useState<EnhancementPlan | null>(null)

  useEffect(() => {
    api.enhancement(component).then(setPlan).catch(() => setPlan(null))
  }, [component])

  if (!plan) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  if (!plan.owned) {
    return (
      <div className="rounded-md bg-surface-secondary p-4 text-sm text-secondary">
        {plan.component} isn’t owned by your org, so Atlas can’t open a PR. Share the missing-link
        finding with the owning team instead.
      </div>
    )
  }

  if (!plan.diff) {
    return (
      <EmptyState icon="check" iconClassName="text-healthy" title="Logging Looks Complete" message={plan.summary} />
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-secondary">{plan.summary}</p>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary">Why</h3>
        <ul className="space-y-1.5">
          {plan.rationale.map((r, i) => (
            <li key={i} className="flex gap-2 text-sm text-secondary">
              <span className="text-accent">•</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary">Suggested Diff</h3>
          <CopyButton text={plan.diff} />
        </div>
        <pre className="overflow-x-auto rounded-md bg-surface-secondary p-4 font-mono text-caption leading-relaxed">
          {plan.diff.split('\n').map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('#')
                  ? 'font-semibold text-primary'
                  : line.startsWith('+')
                    ? 'text-healthy'
                    : line.startsWith('-') && !line.startsWith('---')
                      ? 'text-critical'
                      : 'text-secondary'
              }
            >
              {line || ' '}
            </div>
          ))}
        </pre>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary">Suggested Alerts</h3>
        <ul className="space-y-1.5">
          {plan.suggestedAlerts.map((a, i) => (
            <li key={i} className="rounded-sm bg-surface-secondary p-2 font-mono text-caption text-secondary">
              {a}
            </li>
          ))}
        </ul>
      </div>

      <Button variant="primary" className="w-full py-2.5">
        Open Pull Request
      </Button>
    </div>
  )
}
