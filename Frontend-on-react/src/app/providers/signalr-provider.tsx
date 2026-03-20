import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/shared/store/auth.store'
import { signalRService } from '@/shared/lib/signalr/signalr.service'
import { useNotificationsStore } from '@/modules/notifications/store/notifications.store'
import { mapNotificationToStore } from '@/modules/notifications/utils/map-notification'

import type {
  NotificationUpdateDto,
  NotificationBadgeDto,
  InitialNotificationStateDto,
  NotificationPostponedDto,
  NotificationResolvedDto
} from '@/shared/lib/signalr/signalr.types'

export function SignalRProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const prevTokenRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  // ================= CONNECT =================

  useEffect(() => {
    if (!initializedRef.current && isAuthenticated && token) {
      initializedRef.current = true
      prevTokenRef.current = token

      signalRService.connect()
      return
    }

    if (!isAuthenticated) {
      prevTokenRef.current = null
      initializedRef.current = false

      signalRService.disconnect()
      return
    }

    if (prevTokenRef.current && token && prevTokenRef.current !== token) {
      prevTokenRef.current = token

      console.log('[SignalR] token refreshed → reconnect')

      signalRService.reconnect()
    }
  }, [token, isAuthenticated])

  // ================= SUBSCRIPTIONS =================

  useEffect(() => {
    if (!isAuthenticated) return

    const store = useNotificationsStore.getState()

    const handleReceive = (n: NotificationUpdateDto) => {
      const mapped = mapNotificationToStore(n)
      store.handleNewNotification(mapped)
    }

    const handleUpdate = (n: NotificationUpdateDto) => {
      const mapped = mapNotificationToStore(n)
      store.handleUpdateNotification(mapped)
    }

    const handleBadge = (b: NotificationBadgeDto) => {
      store.handleBadgeUpdate(b)
    }

    const handleInitial = (s: InitialNotificationStateDto) => {
      store.handleInitialState(s.unreadCount)
    }
    const handleResolved = (r: NotificationResolvedDto) => {
      store.handleResolved({
        notificationId: r.notificationId,
        status: r.status,
      })
    }

    const handlePostponed = (p: NotificationPostponedDto) => {
      store.handlePostponed({
        notificationId: p.notificationId,
        returnsAt: p.returnsAt,
      })
    }

    const unsubReceive = signalRService.onNotificationReceived(handleReceive)
    const unsubUpdate = signalRService.onNotificationUpdated(handleUpdate)
    const unsubResolved = signalRService.onNotificationResolved(handleResolved)
    const unsubPostponed = signalRService.onNotificationPostponed(handlePostponed)
    const unsubBadge = signalRService.onBadgeUpdated(handleBadge)
    const unsubInitial = signalRService.onInitialState(handleInitial)

    return () => {
      unsubReceive()
      unsubUpdate()
      unsubBadge()
      unsubInitial()
      unsubResolved()
      unsubPostponed()
    }
  }, [isAuthenticated])

  return <>{children}</>
}