import type { ReactNode } from 'react'

/**
 * The Atlas icon set — one voice for every glyph in the app.
 * SF-Symbols-adjacent: 24 viewBox, 1.7 stroke, round caps and joins.
 * Add glyphs here; never inline one-off SVGs in components.
 */
export type IconName =
  | 'close'
  | 'chevron-down'
  | 'chevron-right'
  | 'search'
  | 'warning'
  | 'gear'
  | 'sun'
  | 'moon'
  | 'copy'
  | 'check'
  | 'arrow-right'
  | 'info'
  | 'sparkle'
  | 'pulse'
  | 'doc'
  | 'flask'
  | 'command'
  | 'ring'
  | 'eye'

const GLYPHS: Record<IconName, ReactNode> = {
  close: <path d="M6 6l12 12M18 6L6 18" />,
  'chevron-down': <path d="M5 9.5l7 7 7-7" />,
  'chevron-right': <path d="M9.5 5l7 7-7 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M19.8 19.8l-4.2-4.2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4.2 21 19.8H3z" strokeLinejoin="round" />
      <path d="M12 10v4.2" />
      <circle cx="12" cy="16.9" r="0.4" fill="currentColor" stroke="none" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinejoin="round" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5.5 14.5A2.5 2.5 0 0 1 4 12.2V6.5A2.5 2.5 0 0 1 6.5 4h5.7a2.5 2.5 0 0 1 2.3 1.5" />
    </>
  ),
  check: <path d="M5 12.8l4.6 4.6L19 7" strokeLinejoin="round" />,
  'arrow-right': <path d="M4 12h15M13.5 6l6 6-6 6" strokeLinejoin="round" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.5v4.5" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  sparkle: (
    <path
      d="M12 3.5c.7 3.9 2.1 5.3 6 6-3.9.7-5.3 2.1-6 6-.7-3.9-2.1-5.3-6-6 3.9-.7 5.3-2.1 6-6zM18.7 14.6c.35 1.95 1.05 2.65 3 3-1.95.35-2.65 1.05-3 3-.35-1.95-1.05-2.65-3-3 1.95-.35 2.65-1.05 3-3z"
      strokeLinejoin="round"
    />
  ),
  pulse: <path d="M3 12.5h4l2.6-6.5 4.2 12 2.6-6.5H21" strokeLinejoin="round" />,
  doc: (
    <>
      <path d="M6.5 3.5h7.6L18.5 8v12.5h-12z" strokeLinejoin="round" />
      <path d="M14 3.8V8h4.3M9 12h6M9 15.5h6" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3.5h5M10.5 3.5v5.2L4.9 18.4a1.8 1.8 0 0 0 1.6 2.6h11a1.8 1.8 0 0 0 1.6-2.6L13.5 8.7V3.5" strokeLinejoin="round" />
      <path d="M7.5 14.5h9" />
    </>
  ),
  command: (
    <path d="M9 9V6a3 3 0 1 0-3 3h3zm0 0v6m0-6h6m-6 6H6a3 3 0 1 0 3 3v-3zm6-6V6a3 3 0 1 1 3 3h-3zm0 0v6m0 0h3a3 3 0 1 1-3 3v-3z" strokeLinejoin="round" />
  ),
  ring: <circle cx="12" cy="12" r="8" />,
  eye: (
    <>
      <path d="M2.8 12S6.5 5.8 12 5.8 21.2 12 21.2 12 17.5 18.2 12 18.2 2.8 12 2.8 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.9" />
    </>
  ),
}

interface IconProps {
  name: IconName
  /** rendered square size in px (default 18) */
  size?: number
  className?: string
  strokeWidth?: number
}

export function Icon({ name, size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {GLYPHS[name]}
    </svg>
  )
}
