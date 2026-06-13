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

;(window as any).authStore = useAuthStore

if (import.meta.env.DEV) {
  // @ts-ignore
  window.showTempMessage = showTempMessage;
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered:', registration)

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('sw-update', { detail: { version: 'new' } }))
              showTempMessage(
                'info',
                'Доступна новая версия приложения. Обновите страницу.',
                10000
              )
            }
          })
        }
      })
    }).catch(err => {
      console.error('SW registration failed:', err)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);