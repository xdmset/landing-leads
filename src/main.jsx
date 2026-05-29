import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Snippet de tracking (antes de renderizar el layout principal en React)
;(() => {
  const existing = document.querySelector('script[data-campaign-token="ct_8f70821c51259f26fa74aefb"]')
  if (existing) return

  const s = document.createElement('script')
  s.src = 'https://studioback.onrender.com/track/v1.js'
  s.setAttribute('data-campaign-token', 'ct_8f70821c51259f26fa74aefb')
  s.defer = true
  document.body.appendChild(s)
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
