import { Component, type ReactNode } from 'react'
import { Button } from './ui/Button'

interface Props {
  children: ReactNode
  label?: string
}
interface State {
  error: Error | null
}

/** Per-panel error boundary so one crashing widget never takes down the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-stroke-light bg-surface p-6 text-sm text-secondary">
          <p className="font-medium text-critical">{this.props.label ?? 'This panel'} hit an error.</p>
          <p className="mt-1 font-mono text-caption">{this.state.error.message}</p>
          <Button size="sm" className="mt-3" onClick={() => this.setState({ error: null })}>
            Retry
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
