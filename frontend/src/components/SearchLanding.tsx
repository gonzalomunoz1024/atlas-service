import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { ComponentSummary } from '../types/atlas'
import { NodeGlyph } from './NodeGlyph'
import { Icon } from './ui/Icons'
import { cx } from '../lib/cx'

export function SearchLanding({ onOpen }: { onOpen: (name: string) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ComponentSummary[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      api
        .searchComponents(q)
        .then((r) => !cancelled && (setResults(r), setActive(0)))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false))
    }, 140)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  const submit = () => {
    const pick = results[active]?.name ?? q.trim()
    if (pick) onOpen(pick)
  }

  const reveal = (i: number) => ({ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' as const })

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      {/* ambient light — three slow-drifting accent blobs, pure CSS */}
      <div aria-hidden className="ambient-blob ambient-blob-1" />
      <div aria-hidden className="ambient-blob ambient-blob-2" />
      <div aria-hidden className="ambient-blob ambient-blob-3" />

      <div className="relative w-full max-w-2xl text-center">
        <div className="animate-fade-in mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-xl bg-accent-tint" style={reveal(0)}>
          <svg viewBox="0 0 100 100" width="34" height="34" className="text-accent">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.35" />
            <circle cx="50" cy="50" r="9" fill="currentColor" />
            <circle cx="50" cy="10" r="5" fill="currentColor" />
            <circle cx="86" cy="66" r="5" fill="currentColor" />
            <circle cx="14" cy="66" r="5" fill="currentColor" />
            <path d="M50 50L50 10M50 50l36 16M50 50l-36 16" stroke="currentColor" strokeWidth="3" opacity="0.5" />
          </svg>
        </div>
        <h1 className="animate-fade-in text-large-title font-semibold text-primary" style={reveal(1)}>
          Atlas
        </h1>
        <div className="animate-fade-in relative mt-10" style={reveal(2)}>
          <div
            className={cx(
              'flex items-center gap-3 rounded-xl border bg-surface px-5 py-4 transition-all duration-[250ms]',
              'border-stroke shadow-card',
              'focus-within:border-accent/50 focus-within:shadow-[0_0_0_4px_var(--color-neutral-bg),var(--shadow-lg)]',
            )}
          >
            <Icon name="search" size={19} className="shrink-0 text-tertiary" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
                else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
                else if (e.key === 'Enter') submit()
              }}
              placeholder="Search a component (repository name)…"
              className="no-focus-ring flex-1 bg-transparent text-title3 font-normal text-primary outline-none placeholder:text-tertiary"
            />
            {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-stroke border-t-accent" />}
          </div>

          {results.length > 0 && (
            <ul className="material-panel absolute z-10 mt-2 w-full overflow-hidden rounded-lg text-left animate-scale-in origin-top">
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => onOpen(r.name)}
                    className={cx(
                      'flex w-full items-center gap-3 px-4 py-3 transition-colors',
                      i === active && 'bg-surface-secondary',
                    )}
                  >
                    <NodeGlyph kind={r.kind} size={22} />
                    <span className="font-medium text-primary">{r.name}</span>
                    {r.owned && (
                      <span className="ml-auto rounded-full bg-accent-tint px-2 py-0.5 text-caption text-accent">
                        owned
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="animate-fade-in mt-6 text-body text-secondary" style={reveal(3)}>
          The map, the traffic, and the gaps between them.
        </p>

        <p className="animate-fade-in mt-3 text-sm text-tertiary" style={reveal(4)}>
          Try{' '}
          <button
            className="font-medium text-accent transition-opacity hover:opacity-70"
            onClick={() => onOpen('Guardrails Orchestrator')}
          >
            Guardrails Orchestrator
          </button>
        </p>
      </div>
    </div>
  )
}
