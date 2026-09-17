import { cx } from '../../lib/cx'
import { Icon, type IconName } from './Icons'

interface Props {
  icon: IconName
  title: string
  message?: string
  /** tint the icon (e.g. 'text-healthy' for positive empty states) */
  iconClassName?: string
  className?: string
}

/** Considered empty state: quiet icon, one confident line, optional detail. */
export function EmptyState({ icon, title, message, iconClassName, className }: Props) {
  return (
    <div className={cx('flex h-full flex-col items-center justify-center gap-3 p-10 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary">
        <Icon name={icon} size={22} className={cx('text-tertiary', iconClassName)} />
      </div>
      <div>
        <p className="text-sm font-medium text-primary">{title}</p>
        {message && <p className="mt-1 text-footnote text-tertiary">{message}</p>}
      </div>
    </div>
  )
}
