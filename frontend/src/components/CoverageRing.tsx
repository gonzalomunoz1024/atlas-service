import { useEffect, useState } from 'react'

const R = 8.5
const CIRC = 2 * Math.PI * R

/**
 * Apple-Watch-style activity ring for logging coverage. Pure SVG — the
 * ObservabilityMenu composes it into a row. Animates closed on mount.
 */
export function CoverageRing({ score, size = 22 }: { score: number; size?: number }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setProgress(score), 300)
    return () => clearTimeout(t)
  }, [score])

  const color =
    score >= 90 ? 'var(--color-neutral)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-critical)'

  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      {/* track */}
      <circle cx="11" cy="11" r={R} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="3" />
      {/* progress — animated stroke sweep from 12 o'clock */}
      <circle
        cx="11"
        cy="11"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - progress / 100)}
        transform="rotate(-90 11 11)"
        style={{ transition: 'stroke-dashoffset 900ms var(--ease-out-quint)' }}
      />
    </svg>
  )
}
