import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/app-router';
import '@/index.css';
import { showTempMessage } from '@/shared/ui/temp-message.service';
import { useAuthStore } from '@/shared/store/auth.store'
import { tilePrecacheService } from '@/modules/pwa/services/tilePrecache.service'; // ← ДОБАВИТЬ

;(window as any).authStore = useAuthStore

if (import.meta.env.DEV) {
  // @ts-ignore
  window.showTempMessage = showTempMessage;
  // @ts-ignore
  window.tilePrecacheService = tilePrecacheService // ← ТЕПЕРЬ ОПРЕДЕЛЕН
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);