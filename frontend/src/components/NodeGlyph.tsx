import type { ReactNode } from 'react'
import type { NodeKind } from '../types/atlas'
import { NODE_COLOR_VAR } from '../lib/nodeVisuals'

const PATHS: Record<NodeKind, ReactNode> = {
  service: <circle cx="12" cy="12" r="6" />,
  queue: <path d="M12 5v14M7 8v8M17 8v8" strokeWidth="2.4" strokeLinecap="round" />,
  database: <path d="M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" strokeWidth="1.8" fill="none" />,
  store: <path d="M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" strokeWidth="1.6" fill="none" />,
  cache: <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="2.2" strokeLinecap="round" />,
  external: <path d="M14 4h6v6M20 4l-8 8M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
}

export function NodeGlyph({ kind, size = 24 }: { kind: NodeKind; size?: number }) {
  const color = `var(${NODE_COLOR_VAR[kind]})`
  return (
    <span
      className="inline-flex items-center justify-center rounded-[var(--radius-sm)]"
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill={kind === 'service' ? color : 'none'} stroke={color}>
        {PATHS[kind]}
      </svg>
    </span>
  )
}
