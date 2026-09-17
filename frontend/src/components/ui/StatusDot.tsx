import { cx } from '../../lib/cx'

export type DotKind = 'ok' | 'error' | 'warning' | 'muted'

const KIND_VAR: Record<DotKind, string> = {
  ok: '--color-healthy',
  error: '--color-critical',
  warning: '--color-warning',
  muted: '--color-text-tertiary',
}

interface Props {
  kind?: DotKind
  /** escape hatch: a CSS variable name (e.g. LINK_COLOR_VAR[status]) */
  varName?: string
  /** subtle infinite pulse (live indicators) */
  pulse?: boolean
  className?: string
}

/** The one status dot — replaces every hand-rolled h-2 w-2 rounded-full span. */
export function StatusDot({ kind = 'ok', varName, pulse, className }: Props) {
  return (
    <span
      className={cx('h-2 w-2 shrink-0 rounded-full', pulse && 'animate-pulse-subtle', className)}
      style={{ background: `var(${varName ?? KIND_VAR[kind]})` }}
    />
  )
}
