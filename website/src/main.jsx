import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto-reload window if a new deployment removed an old chunk hash
window.addEventListener('vite:preloadError', (event) => {
  console.warn('New deployment chunk detected, refreshing application...');
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
