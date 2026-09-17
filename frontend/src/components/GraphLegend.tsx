import type { NodeKind } from '../types/atlas'
import { NODE_COLOR_VAR, NODE_LABEL } from '../lib/nodeVisuals'
import { cx } from '../lib/cx'

const ORDER: NodeKind[] = ['service', 'kafka', 'database', 'mongo', 'cache', 'external']

interface Props {
  hiddenKinds: Set<NodeKind>
  onToggle: (kind: NodeKind) => void
  present?: Set<NodeKind>
}

/** Node-type filter — click a type to toggle it on/off in the map. */
export function GraphLegend({ hiddenKinds, onToggle, present }: Props) {
  const kinds = ORDER.filter((k) => !present || present.has(k))
  return (
    <div className="glass flex flex-wrap gap-1.5 rounded-full border border-stroke-light p-1.5 shadow-card">
      {kinds.map((k) => {
        const off = hiddenKinds.has(k)
        return (
          <button
            key={k}
            onClick={() => onToggle(k)}
            title={off ? `Show ${NODE_LABEL[k]}` : `Hide ${NODE_LABEL[k]}`}
            className={cx(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption transition-all duration-150',
              'hover:bg-surface-secondary active:scale-[0.96]',
              off && 'opacity-40',
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: off ? 'var(--color-text-tertiary)' : `var(${NODE_COLOR_VAR[k]})` }}
            />
            <span className={off ? 'text-tertiary line-through' : 'text-secondary'}>{NODE_LABEL[k]}</span>
          </button>
        )
      })}
    </div>
  )
}
