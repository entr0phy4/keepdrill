import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App, ErrorBoundary, FluidProviders, syncColorScheme } from './app'
import { warnIfNonAnsiLayout } from './platform/layout'

syncColorScheme()
void warnIfNonAnsiLayout()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluidProviders>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </FluidProviders>
  </StrictMode>,
)
