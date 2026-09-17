import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'capsule' | 'warning-outline'
type Size = 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  primary: 'rounded-md bg-accent font-medium text-white shadow-sm hover:brightness-110',
  secondary: 'rounded-md bg-surface-secondary font-medium text-primary hover:bg-stroke-light',
  ghost: 'rounded-full text-secondary hover:bg-surface-secondary hover:text-primary',
  capsule:
    'rounded-full border border-stroke-light text-secondary hover:bg-surface-secondary hover:text-primary',
  'warning-outline': 'rounded-md border border-warning font-medium text-warning hover:bg-warning-tint',
}

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-caption',
  md: 'px-4 py-2 text-sm',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

/** The one button. Press feedback via active scale; variants cover every current style. */
export function Button({ variant = 'secondary', size = 'md', className, ...rest }: Props) {
  return (
    <button
      className={cx(
        'inline-flex select-none items-center justify-center gap-1.5 transition-all duration-150',
        'active:scale-[0.97] disabled:active:scale-100',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  )
}

/** Round icon-only button (header actions, close buttons). */
export function IconButton({
  className,
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'flex h-9 w-9 items-center justify-center rounded-full text-tertiary',
        'transition-all duration-150 hover:bg-surface-secondary hover:text-primary active:scale-[0.94]',
        className,
      )}
      {...rest}
    />
  )
}
