import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { fuzzyMatch } from '../lib/fuzzy'
import { Modal } from './ui/Overlay'
import { Icon, type IconName } from './ui/Icons'
import { cx } from '../lib/cx'

export interface PaletteCommand {
  id: string
  group: 'Actions' | 'Nodes' | 'Components'
  label: string
  hint?: string
  icon: IconName
  run: () => void
}

interface Props {
  onClose: () => void
  /** synchronous commands (map nodes + actions); already contextual */
  commands: PaletteCommand[]
  /** navigate to another component (feeds the async Components group) */
  onOpenComponent?: (name: string) => void
}

/** Global ⌘K / Ctrl-K (and `/` outside inputs) opener. */
export function useCommandK(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpen()
      } else if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen])
}

const GROUP_ORDER: PaletteCommand['group'][] = ['Actions', 'Nodes', 'Components']

/** Spotlight-style command palette: jump to nodes, run actions, switch components. */
export function CommandPalette({ onClose, commands, onOpenComponent }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [componentResults, setComponentResults] = useState<PaletteCommand[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  // async Components group
  useEffect(() => {
    if (!query.trim() || !onOpenComponent) {
      setComponentResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      api
        .searchComponents(query)
        .then((rs) => {
          if (cancelled) return
          setComponentResults(
            rs.map((r) => ({
              id: `component-${r.id}`,
              group: 'Components' as const,
              label: r.name,
              hint: 'open map',
              icon: 'search' as const,
              run: () => onOpenComponent(r.name),
            })),
          )
        })
        .catch(() => !cancelled && setComponentResults([]))
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, onOpenComponent])

  const results = useMemo(() => {
    const q = query.trim()
    const scored = commands
      .map((c) => ({ cmd: c, m: fuzzyMatch(q, c.label) }))
      .filter((x): x is { cmd: PaletteCommand; m: NonNullable<ReturnType<typeof fuzzyMatch>> } => !!x.m)
      .sort((a, b) => b.m.score - a.m.score)
    const dedupe = new Set(scored.map((s) => s.cmd.label.toLowerCase()))
    const extra = componentResults
      .filter((c) => !dedupe.has(c.label.toLowerCase()))
      .map((cmd) => ({ cmd, m: { score: 0, indices: [] as number[] } }))
    const all = [...scored, ...extra]
    // no query → stable group order; with a query → best-matching group first,
    // so "opa" surfaces the OPA Pod node above a scattered "OPen trAces" match
    const groups = q
      ? [...GROUP_ORDER].sort(
          (a, b) =>
            Math.max(...all.filter((x) => x.cmd.group === b).map((x) => x.m.score), -1) -
            Math.max(...all.filter((x) => x.cmd.group === a).map((x) => x.m.score), -1),
        )
      : GROUP_ORDER
    return { list: groups.flatMap((g) => all.filter((x) => x.cmd.group === g)), groups }
  }, [commands, componentResults, query])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (i: number) => {
    const r = results.list[i]
    if (!r) return
    onClose()
    r.cmd.run()
  }

  return (
    <Modal onClose={onClose} align="top" width="max-w-xl" panelClassName="!max-h-[60vh]">
      <div className="flex items-center gap-3 border-b border-stroke-light px-4 py-3.5">
        <Icon name="search" size={17} className="shrink-0 text-tertiary" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, results.list.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(active)
            }
          }}
          placeholder="Search nodes, actions, components…"
          className="no-focus-ring flex-1 bg-transparent text-body text-primary outline-none placeholder:text-tertiary"
        />
        <kbd className="rounded-[5px] border border-stroke-light px-1.5 py-0.5 font-mono text-[10px] text-tertiary">
          esc
        </kbd>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1.5">
        {results.list.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-tertiary">No matches.</p>
        ) : (
          results.groups.map((group) => {
            const grouped = results.list
              .map((r, i) => ({ ...r, i }))
              .filter((r) => r.cmd.group === group)
            if (grouped.length === 0) return null
            return (
              <div key={group}>
                <div className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-tertiary">
                  {group}
                </div>
                {grouped.map((r) => (
                  <button
                    key={r.cmd.id}
                    data-idx={r.i}
                    onClick={() => run(r.i)}
                    onMouseEnter={() => setActive(r.i)}
                    className={cx(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      r.i === active ? 'bg-surface-secondary' : '',
                    )}
                  >
                    <Icon name={r.cmd.icon} size={15} className="shrink-0 text-tertiary" />
                    <span className="min-w-0 flex-1 truncate text-sm text-primary">
                      <Highlighted label={r.cmd.label} indices={r.m.indices} />
                    </span>
                    {r.cmd.hint && <span className="shrink-0 text-caption text-tertiary">{r.cmd.hint}</span>}
                    {r.i === active && (
                      <kbd className="shrink-0 rounded-[5px] border border-stroke-light px-1.5 font-mono text-[10px] text-tertiary">
                        ↩
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            )
          })
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-stroke-light px-4 py-2 text-[10px] text-tertiary">
        <span>↑↓ navigate</span>
        <span>↩ open</span>
        <span className="ml-auto flex items-center gap-1">
          <Icon name="command" size={10} />K anywhere
        </span>
      </div>
    </Modal>
  )
}

function Highlighted({ label, indices }: { label: string; indices: number[] }) {
  if (indices.length === 0) return <>{label}</>
  const set = new Set(indices)
  return (
    <>
      {label.split('').map((ch, i) =>
        set.has(i) ? (
          <span key={i} className="font-semibold text-accent">
            {ch}
          </span>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  )
}
