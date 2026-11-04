import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

// A page's code that can't be fetched after a deploy (the file names change
// with every build): reload once to get the new version. Once per minute at
// most, so a real outage doesn't loop.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('mb.reloaded-for-update') || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem('mb.reloaded-for-update', String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
