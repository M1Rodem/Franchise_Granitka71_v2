import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryClient } from '@/app/providers/query-client';
import { AuthRefreshProvider } from '@/app/providers/auth-refresh-provider'; // новый импорт

import { useAuthStore } from '@/shared/store/auth.store';
import { TempMessageProvider } from '@/shared/ui/TempMessageProvider';
import { notificationRealtimeService } from '@/modules/notifications/services/notification-realtime.service'

interface AppProvidersProps {
  children: React.ReactNode;
}

function SessionBootstrap({ children }: AppProvidersProps) {
  const hydrateSession = useAuthStore((state) => state.hydrateSession)
  const clearSession = useAuthStore((state) => state.clearSession)
  const sessionExpiresAt = useAuthStore((state) => state.sessionExpiresAt)
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  useEffect(() => {
    hydrateSession()
  }, [hydrateSession])

  useEffect(() => {
    if (!sessionExpiresAt) return

    const timeout = window.setTimeout(
      () => clearSession(),
      Math.max(0, sessionExpiresAt - Date.now())
    )

    return () => window.clearTimeout(timeout)
  }, [sessionExpiresAt, clearSession])

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return

    notificationRealtimeService.connect(queryClient)

    return () => {
      notificationRealtimeService.disconnect()
    }
  }, [isHydrated, isAuthenticated])

  return <>{children}</>
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthRefreshProvider> {/* Добавляем новый провайдер */}
        <SessionBootstrap>
          {children}
          <TempMessageProvider />
        </SessionBootstrap>
      </AuthRefreshProvider>
    </QueryClientProvider>
  )
}