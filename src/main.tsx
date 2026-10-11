import React from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import './styles.css';
import { App } from './App';
setupIonicReact();
// Uma página restaurada do back/forward cache deve reler a sessão atual.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
