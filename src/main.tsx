import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// After a deploy, a page left open still asks for the old page files, which are gone.
// Reload once to pick up the new version; if that happened in the last minute, let the
// error screen offer a reload instead of reloading in a loop.
const RELOADED_AT = 'marketix.reloadedForUpdate'
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch {
    return // no storage: can't guard against a loop, so don't reload
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
