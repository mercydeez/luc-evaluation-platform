import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { initTheme } from './theme'

// Before the first paint, so a dark-theme viewer never sees a white flash.
initTheme()

// Hash routing: the app is served from GitHub Pages, where a deep link to a
// client-side route would otherwise 404 on the server before React loads.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
