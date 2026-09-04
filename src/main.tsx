import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './ui/App'
import { warnIfNonAnsiLayout } from './platform/layout'

// Fire-and-forget — never awaited, never blocks first paint (D-17).
void warnIfNonAnsiLayout()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
