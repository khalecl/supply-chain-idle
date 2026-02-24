import React, { useState } from 'react'
import Game3D from './components/Game3D'
import MainMenu from './components/MainMenu'
import WorldBuilder from './components/WorldBuilder'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', fontFamily: 'monospace', background: '#000' }}>
          <h1>❌ Error in Game</h1>
          <p><strong>{this.state.error?.message}</strong></p>
          <pre style={{ background: '#111', padding: 10, overflow: 'auto' }}>{this.state.error?.stack}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: 20, fontSize: 16 }}>
            🔄 Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [screen, setScreen] = useState('menu');

  return (
    <ErrorBoundary>
      {screen === 'menu' && (
        <MainMenu
          onPlay={() => setScreen('game')}
          onWorldBuilder={() => setScreen('builder')}
        />
      )}
      {screen === 'game' && (
        <Game3D onBack={() => setScreen('menu')} />
      )}
      {screen === 'builder' && (
        <WorldBuilder
          onBack={() => setScreen('menu')}
          onPlay={() => setScreen('game')}
        />
      )}
    </ErrorBoundary>
  )
}
