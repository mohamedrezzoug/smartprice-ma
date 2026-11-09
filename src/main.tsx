import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
// Service worker only in production builds (npm run build && npm run preview).
// In dev (npm run dev) it would serve stale cached modules, so any old one is removed.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
  else navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {})
}
