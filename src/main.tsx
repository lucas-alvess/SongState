import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { handleSpotifyRedirect } from './lib/spotify';
import { requestPersistence } from './lib/db';
import { runMigrations } from './lib/migrations';

try {
  runMigrations(localStorage);
} catch {
  /* sem localStorage (modo privado restrito): o site segue sem salvar */
}
void requestPersistence();

void handleSpotifyRedirect().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

// service worker: instalável e abre offline (só no site publicado, não no servidor de desenvolvimento)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* sem service worker o site continua funcionando normalmente */
    });
  });
}
