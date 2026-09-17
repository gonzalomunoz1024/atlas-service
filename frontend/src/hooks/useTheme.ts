import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'atlas-theme'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

/**
 * Tri-state light/dark/system theme, persisted to localStorage and reactive to the OS
 * preference while in "system" mode. Mirrors the TradingService useTheme pattern.
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'system'
  })

  useEffect(() => {
    applyTheme(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  // simple sun/moon toggle: resolve the current appearance and flip to the explicit opposite
  const cycle = useCallback(() => {
    setMode((m) => {
      const dark = m === 'dark' || (m === 'system' && systemPrefersDark())
      return dark ? 'light' : 'dark'
    })
  }, [])

  return { mode, setMode, cycle }
}
