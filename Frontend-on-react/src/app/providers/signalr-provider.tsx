import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/shared/store/auth.store'
import { signalRService } from '@/shared/lib/signalr/signalr.service'

export function SignalRProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const prevTokenRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    // INIT после hydrate
    if (!initializedRef.current && isAuthenticated && token) {
      initializedRef.current = true
      prevTokenRef.current = token

      signalRService.connect()
      return
    }

    // LOGOUT
    if (!isAuthenticated) {
      prevTokenRef.current = null
      initializedRef.current = false

      signalRService.disconnect()
      return
    }

    // REFRESH TOKEN (ключевой кейс)
    if (prevTokenRef.current && token && prevTokenRef.current !== token) {
      prevTokenRef.current = token

      console.log('[SignalR] token refreshed → reconnect')

      signalRService.reconnect()
    }
  }, [token, isAuthenticated])

  return <>{children}</>
}