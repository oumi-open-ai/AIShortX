import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
// Apply dark theme immediately to prevent white flash
document.documentElement.classList.add('dark');
document.documentElement.style.backgroundColor = '#09090b';
document.body.style.backgroundColor = '#09090b';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
