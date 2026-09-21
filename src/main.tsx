import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { App, ErrorBoundary, FluidProviders, syncColorScheme } from './app'
import { warnIfNonAnsiLayout } from './platform/layout'

syncColorScheme()
void warnIfNonAnsiLayout()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluidProviders>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </FluidProviders>
  </StrictMode>,
)
