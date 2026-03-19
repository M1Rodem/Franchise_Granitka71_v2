import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'

import { queryClient } from '@/app/providers/query-client'
import { AuthRefreshProvider } from '@/app/providers/auth-refresh-provider'
import { SignalRProvider } from '@/app/providers/signalr-provider'

import { useAuthStore } from '@/shared/store/auth.store'
import { TempMessageProvider } from '@/shared/ui/TempMessageProvider'

interface AppProvidersProps {
  children: React.ReactNode
}

function SessionBootstrap({ children }: AppProvidersProps) {
  const hydrateSession = useAuthStore((state) => state.hydrateSession)
  const clearSession = useAuthStore((state) => state.clearSession)
  const sessionExpiresAt = useAuthStore((state) => state.sessionExpiresAt)

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

  return <>{children}</>
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthRefreshProvider>
        <SignalRProvider> 
          <SessionBootstrap>
            {children}
            <TempMessageProvider />
          </SessionBootstrap>
        </SignalRProvider>
      </AuthRefreshProvider>
    </QueryClientProvider>
  )
}