import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { error: null }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[keebdrill] render error:', error, info.componentStack)
  }

  public render(): ReactNode {
    if (this.state.error === null) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback
    return (
      <section role="alert" className="grid gap-2">
        <h2>Something went wrong</h2>
        <p className="text-muted">Reload the page to continue. Your history is stored locally.</p>
      </section>
    )
  }
}
