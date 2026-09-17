import type { ThemeMode } from '../hooks/useTheme'
import type { RepoRevisions } from '../types/atlas'
import { ThemeToggle } from './ThemeToggle'
import { EnvironmentSelector, type RepoView } from './EnvironmentSelector'
import { StatusDot } from './ui/StatusDot'

interface Props {
  component?: string
  live?: boolean
  revisions?: RepoRevisions | null
  repoView?: RepoView | null
  onRepoViewChange?: (v: RepoView) => void
  themeMode: ThemeMode
  onCycleTheme: () => void
  onHome: () => void
}

export function AppHeader({
  component,
  live,
  revisions,
  repoView,
  onRepoViewChange,
  themeMode,
  onCycleTheme,
  onHome,
}: Props) {
  return (
    <header className="glass sticky top-0 z-40 border-b border-stroke-light">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <button
          onClick={onHome}
          className="flex items-center gap-2 text-primary transition-opacity hover:opacity-70"
        >
          <svg viewBox="0 0 100 100" width="20" height="20" className="text-accent">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="6" opacity="0.4" />
            <circle cx="50" cy="50" r="12" fill="currentColor" />
          </svg>
          <span className="text-subheadline font-semibold tracking-tight">Atlas</span>
        </button>

        {component && (
          <>
            <span className="text-tertiary">/</span>
            <span className="font-mono text-sm text-secondary">{component}</span>
          </>
        )}

        {/* one capsule, two segments: which revision · whether telemetry streams */}
        {revisions && repoView && onRepoViewChange && (
          <>
            <div className="material-panel flex items-center rounded-full">
              <EnvironmentSelector revisions={revisions} view={repoView} onChange={onRepoViewChange} />
              <span className="flex items-center gap-1.5 border-l border-stroke-light py-1.5 pl-3 pr-3.5 text-caption text-secondary">
                <StatusDot kind={live ? 'ok' : 'muted'} pulse={live} className="h-1.5 w-1.5" />
                {live ? 'Live' : 'Offline'}
              </span>
            </div>
            {repoView.image && (
              <span className="hidden font-mono text-caption text-tertiary lg:inline">{repoView.image}</span>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle mode={themeMode} onCycle={onCycleTheme} />
        </div>
      </div>
    </header>
  )
}
