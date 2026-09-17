import { useState } from 'react'
import { useTheme } from './hooks/useTheme'
import { SearchLanding } from './components/SearchLanding'
import { MapView } from './components/MapView'
import { ThemeToggle } from './components/ThemeToggle'

export default function App() {
  const { mode, cycle } = useTheme()
  const [component, setComponent] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-surface">
      {component ? (
        <MapView
          key={component}
          component={component}
          themeMode={mode}
          onCycleTheme={cycle}
          onHome={() => setComponent(null)}
          onOpenComponent={setComponent}
        />
      ) : (
        <>
          <div className="absolute right-4 top-4 z-40">
            <ThemeToggle mode={mode} onCycle={cycle} />
          </div>
          <SearchLanding onOpen={setComponent} />
        </>
      )}
    </div>
  )
}
