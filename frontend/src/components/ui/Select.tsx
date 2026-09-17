import { useCallback, useEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { useDismiss } from '../../hooks/useDismiss'
import { Icon } from './Icons'
import { PopoverPanel } from './Overlay'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  ariaLabel: string
  className?: string
  /** monospace the trigger/options (endpoint paths) */
  mono?: boolean
}

/** Styled select: capsule trigger + material listbox with keyboard navigation. */
export function Select({ value, onChange, options, ariaLabel, className, mono }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value)
      setActive(idx >= 0 ? idx : 0)
    }
  }, [open, options, value])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const current = options.find((o) => o.value === value)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const o = options[active]
      if (o) {
        onChange(o.value)
        close()
      }
    }
  }

  return (
    <div ref={ref} className={cx('relative', className)} onKeyDown={onKeyDown}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cx(
          'flex w-full items-center justify-between gap-2 rounded-md border border-stroke-light bg-surface-secondary py-2 pl-3 pr-2.5 text-left',
          mono ? 'font-mono text-caption' : 'text-sm',
          'text-primary transition-colors hover:border-stroke focus-visible:border-accent',
        )}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <Icon
          name="chevron-down"
          size={13}
          className={cx('shrink-0 text-tertiary transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <PopoverPanel className="absolute left-0 right-0 top-full mt-1.5 origin-top">
          <div ref={listRef} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto py-1">
            {options.map((o, i) => (
              <button
                key={o.value}
                data-idx={i}
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value)
                  close()
                }}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left',
                  mono ? 'font-mono text-caption' : 'text-sm',
                  i === active ? 'bg-surface-secondary text-primary' : 'text-secondary',
                )}
              >
                <span className="w-3.5 shrink-0">
                  {o.value === value && <Icon name="check" size={13} className="text-accent" />}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </PopoverPanel>
      )}
    </div>
  )
}
