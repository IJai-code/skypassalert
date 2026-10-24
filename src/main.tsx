import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'

const root = document.getElementById('root')
// Browsers that failed the inline support check in index.html see the static
// fallback page instead; don't start the app underneath it.
if (root && !document.documentElement.classList.contains('legacy')) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
