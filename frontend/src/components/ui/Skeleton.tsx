import { cx } from '../../lib/cx'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-md', className)} />
}

/** The standard loading block: n shimmer rows. */
export function SkeletonRows({ n = 3, className }: { n?: number; className?: string }) {
  return (
    <div className={cx('space-y-4', className)}>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  )
}
