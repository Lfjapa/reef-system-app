import type { ReactNode } from 'react'
import { Component } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : 'Erro inesperado' }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 8px' }}>Algo deu errado</h2>
        <div style={{ color: '#666', marginBottom: 12 }}>
          O app encontrou um erro inesperado. Você pode recarregar para tentar novamente.
        </div>
        <div
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            background: '#111',
            color: '#eee',
            padding: 12,
            borderRadius: 8,
            overflowX: 'auto',
            marginBottom: 12,
          }}
        >
          {this.state.message}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #222',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Recarregar
        </button>
      </div>
    )
  }
}

