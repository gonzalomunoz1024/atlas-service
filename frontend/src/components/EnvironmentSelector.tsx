import { useCallback, useRef, useState } from 'react'
import type { RepoRevisions } from '../types/atlas'
import { useDismiss } from '../hooks/useDismiss'
import { PopoverPanel } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { StatusDot } from './ui/StatusDot'
import { cx } from '../lib/cx'

/** The revision currently being viewed. `running` is false for an undeployed commit (map only). */
export interface RepoView {
  label: string
  commitHash: string
  image: string | null
  running: boolean
}

interface Props {
  revisions: RepoRevisions | null
  view: RepoView | null
  onChange: (v: RepoView) => void
}

/** Picks the environment (dev/test/prod) or a specific commit to view the repo's map at. */
export function EnvironmentSelector({ revisions, view, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  if (!revisions || !view) return null

  const pickEnv = (env: RepoRevisions['environments'][number]) => {
    onChange({ label: env.env, commitHash: env.commitHash, image: env.image, running: env.running })
    close()
  }
  const pickCommit = (c: RepoRevisions['commits'][number]) => {
    const deployed = c.deployedEnv
      ? revisions.environments.find((e) => e.env === c.deployedEnv)
      : undefined
    onChange({
      label: deployed ? deployed.env : c.hash,
      commitHash: c.hash,
      image: deployed?.image ?? null,
      running: c.running,
    })
    close()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-caption transition-colors hover:bg-surface-secondary"
      >
        <StatusDot kind={view.running ? 'ok' : 'muted'} className="h-1.5 w-1.5" />
        <span className="font-medium uppercase tracking-wide text-primary">{view.label}</span>
        <span className="font-mono text-tertiary">{view.commitHash}</span>
        <Icon
          name="chevron-down"
          size={12}
          className={cx('text-tertiary transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <PopoverPanel className="absolute left-0 top-10 z-50 w-80 origin-top-left">
          <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-tertiary">
            Environments
          </div>
          {revisions.environments.map((env) => (
            <button
              key={env.env}
              onClick={() => pickEnv(env)}
              className={cx(
                'flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-surface-secondary',
                view.commitHash === env.commitHash && 'bg-surface-secondary',
              )}
            >
              <StatusDot kind="ok" className="h-1.5 w-1.5" />
              <span className="w-12 text-caption font-medium uppercase text-primary">{env.env}</span>
              <span className="font-mono text-caption2 text-secondary">{env.commitHash}</span>
              <span className="ml-auto max-w-[9rem] truncate font-mono text-[10px] text-tertiary">
                {env.image.split('/').pop()}
              </span>
            </button>
          ))}

          <div className="border-t border-stroke-light px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-tertiary">
            Recent commits
          </div>
          {revisions.commits.map((c) => (
            <button
              key={c.hash}
              onClick={() => pickCommit(c)}
              className={cx(
                'flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-surface-secondary',
                view.commitHash === c.hash && 'bg-surface-secondary',
              )}
            >
              <span className="font-mono text-caption2 text-primary">{c.hash}</span>
              <span className="min-w-0 flex-1 truncate text-caption2 text-secondary">{c.message}</span>
              {c.deployedEnv ? (
                <span className="shrink-0 rounded-full bg-healthy-tint px-1.5 text-[10px] font-medium uppercase text-healthy">
                  {c.deployedEnv}
                </span>
              ) : (
                <span className="shrink-0 text-[10px] text-tertiary">map only</span>
              )}
            </button>
          ))}
        </PopoverPanel>
      )}
    </div>
  )
}
