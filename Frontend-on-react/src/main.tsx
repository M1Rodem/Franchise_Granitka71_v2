import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/app-router';
import '@/index.css';
import { showTempMessage } from '@/shared/ui/temp-message.service';

if (import.meta.env.DEV) {
  // @ts-ignore
  window.showTempMessage = showTempMessage;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);
