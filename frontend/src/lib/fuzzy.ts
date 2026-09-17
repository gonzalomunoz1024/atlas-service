/**
 * Tiny fuzzy subsequence matcher for the command palette. Scores higher for
 * consecutive runs, word-boundary hits, and early matches; returns the matched
 * character indices for highlighting. No dependency needed for ~30 lines.
 */
export interface FuzzyResult {
  score: number
  indices: number[]
}

export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (!q) return { score: 0, indices: [] }

  const indices: number[] = []
  let score = 0
  let ti = 0
  let lastMatch = -2

  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]
    let found = -1
    while (ti < t.length) {
      if (t[ti] === c) {
        found = ti
        break
      }
      ti++
    }
    if (found === -1) return null
    // consecutive-run bonus, word-boundary bonus, early-match bonus
    score += 1
    if (found === lastMatch + 1) score += 4
    if (found === 0 || t[found - 1] === ' ' || t[found - 1] === '-' || t[found - 1] === '/') score += 6
    score -= found * 0.01
    indices.push(found)
    lastMatch = found
    ti = found + 1
  }
  return { score, indices }
}
