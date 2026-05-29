import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Snippet de tracking (antes de renderizar el layout principal en React)
;(() => {
  const existing = document.querySelector('script[data-campaign-token="ct_167e3fe722ba9ef7fc0b11cf"]')
  if (existing) return

  const s = document.createElement('script')
  s.src = 'http://127.0.0.1:4000/track/v1.js'
  s.setAttribute('data-campaign-token', 'ct_167e3fe722ba9ef7fc0b11cf')
  s.defer = true
  document.body.appendChild(s)
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
