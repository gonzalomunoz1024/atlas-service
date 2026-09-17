import type { ThemeMode } from '../hooks/useTheme'
import { Icon } from './ui/Icons'
import { IconButton } from './ui/Button'

/** Sun in light mode, moon in dark mode; click flips between them. */
export function ThemeToggle({ mode, onCycle }: { mode: ThemeMode; onCycle: () => void }) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <IconButton
      label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={onCycle}
      className="text-secondary"
    >
      <Icon name={dark ? 'moon' : 'sun'} size={18} />
    </IconButton>
  )
}
