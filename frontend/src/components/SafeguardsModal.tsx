import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { SafeguardOption } from '../types/atlas'
import { Modal, useOverlayClose } from './ui/Overlay'
import { Icon, type IconName } from './ui/Icons'
import { IconButton } from './ui/Button'
import { cx } from '../lib/cx'

export type SafeguardKind = 'synthetic' | 'alerts'

interface Props {
  traceId: string
  onPick: (kind: SafeguardKind) => void
  onClose: () => void
}

interface Card {
  icon: IconName
  title: string
  description: string
  kind?: SafeguardKind
  soon?: boolean
}

/** Presentation for each catalog id — copy and glyphs are the UI's; availability is the server's. */
const CARD_COPY: Record<string, Omit<Card, 'soon'>> = {
  synthetic: {
    icon: 'pulse',
    title: 'Synthetic Test',
    description: 'Replay this request on HyperExecute and assert a 200 under 800ms.',
    kind: 'synthetic',
  },
  regression: {
    icon: 'flask',
    title: 'Regression Test',
    description: 'Pin today’s behaviour and fail the build the moment this path drifts.',
  },
  performance: {
    icon: 'gauge',
    title: 'Performance Test',
    description: 'Load the path at multiples of live traffic and watch the p95 hold.',
  },
  alerts: {
    icon: 'doc',
    title: 'Alert Manifest',
    description: 'Splunk & SPLOC rules derived from this call path, as reviewable YAML.',
    kind: 'alerts',
  },
}

function toCards(catalog: SafeguardOption[], group: SafeguardOption['group']): Card[] {
  return catalog
    .filter((o) => o.group === group && CARD_COPY[o.id])
    .map((o) => ({ ...CARD_COPY[o.id], soon: !o.available }))
}

/**
 * The safeguard chooser: one trace becomes lasting protection: tests that replay it,
 * alerts that watch it. Picking an available card opens that artifact's generator.
 */
export function SafeguardsModal({ traceId, onPick, onClose }: Props) {
  // which kinds exist and are available is the platform's catalog, not UI knowledge
  const [catalog, setCatalog] = useState<SafeguardOption[] | null>(null)
  useEffect(() => {
    api.safeguardCatalog().then(setCatalog).catch(() => setCatalog([]))
  }, [])

  return (
    <Modal onClose={onClose} raised width="max-w-2xl">
      <Header traceId={traceId} />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        <p className="text-sm leading-relaxed text-secondary">
          Turn this trace into lasting protection: tests that replay this exact call path, and
          alerts that watch it in production.
        </p>

        {catalog && (
          <>
            <Section label="Testing Framework" cards={toCards(catalog, 'testing')} onPick={onPick} />
            <Section label="Observability as Code" cards={toCards(catalog, 'observability')} onPick={onPick} />
          </>
        )}
      </div>
    </Modal>
  )
}

function Section({ label, cards, onPick }: { label: string; cards: Card[]; onPick: (k: SafeguardKind) => void }) {
  return (
    <div>
      <h3 className="mb-2.5 text-caption font-semibold uppercase tracking-wide text-tertiary">{label}</h3>
      <div className="space-y-2">
        {cards.map((c) => (
          <button
            key={c.title}
            disabled={c.soon}
            onClick={() => c.kind && onPick(c.kind)}
            className={cx(
              'group flex w-full items-center gap-4 rounded-lg border border-stroke-light p-4 text-left transition-all duration-150',
              c.soon
                ? 'opacity-55'
                : 'hover:border-accent/40 hover:bg-surface-secondary active:scale-[0.99]',
            )}
          >
            <span
              className={cx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                c.soon ? 'bg-surface-secondary text-tertiary' : 'bg-accent-tint text-accent',
              )}
            >
              <Icon name={c.icon} size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">{c.title}</span>
                {c.soon && (
                  <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-caption2 font-medium text-tertiary">
                    Soon
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-caption leading-relaxed text-secondary">{c.description}</span>
            </span>
            {!c.soon && (
              <Icon
                name="chevron-right"
                size={15}
                className="shrink-0 text-tertiary transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function Header({ traceId }: { traceId: string }) {
  const close = useOverlayClose()
  return (
    <div className="flex items-center justify-between border-b border-stroke-light p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-tint text-accent">
          <Icon name="shield" size={19} />
        </span>
        <div>
          <h2 className="text-title3 font-semibold text-primary">Add Safeguards</h2>
          <p className="font-mono text-caption text-secondary">{traceId}</p>
        </div>
      </div>
      <IconButton label="Close" onClick={close}>
        <Icon name="close" size={18} />
      </IconButton>
    </div>
  )
}
