import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { LocaleProvider } from './i18n'
import { AppStateProvider } from './state/AppState'
import { runAudit } from './data/audit'
import './styles/global.css'

// The fixtures are re-checked on every dev boot. A number that is wrong but
// plausible is the one defect visual QA cannot catch.
if (import.meta.env.DEV) runAudit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LocaleProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>,
)
