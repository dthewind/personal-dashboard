import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Tab crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-lg mx-auto mt-12 p-4 rounded border border-red-900 bg-red-950/40 text-gray-200">
          <p className="font-medium text-red-300">This tab hit an error and couldn't render.</p>
          <p className="text-sm text-gray-400 mt-1">
            Switch to another tab and back, or click retry. Details are in the browser console.
          </p>
          <p className="text-xs text-gray-500 mt-2 font-mono break-all">{this.state.error.message}</p>
          <button
            className="mt-3 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
