import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Note: StrictMode removed to prevent double initialization of 3D renderer
// This is common for games/3D apps where double-mounting causes issues
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
