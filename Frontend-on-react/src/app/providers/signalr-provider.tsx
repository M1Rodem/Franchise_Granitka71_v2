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
  const handlersRegisteredRef = useRef(false)

  // ================= ЕДИНЫЙ ЭФФЕКТ ДЛЯ ВСЕГО =================

  useEffect(() => {
    if (!isAuthenticated || !token) {
      prevTokenRef.current = null
      handlersRegisteredRef.current = false
      signalRService.disconnect()
      return
    }

    const store = useNotificationsStore.getState()

    // Регистрируем обработчики (делаем это ДО connect)
    if (!handlersRegisteredRef.current) {
      console.log('[SignalR] Registering all handlers BEFORE connect')

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
        console.log('[SignalR] INITIAL STATE RECEIVED (once)', s)
        store.handleInitialState(s)
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

      // Регистрируем все обработчики
      signalRService.onNotificationReceived(handleReceive)
      signalRService.onNotificationUpdated(handleUpdate)
      signalRService.onNotificationResolved(handleResolved)
      signalRService.onNotificationPostponed(handlePostponed)
      signalRService.onBadgeUpdated(handleBadge)
      signalRService.onInitialState(handleInitial)

      handlersRegisteredRef.current = true
    }

    // Затем подключаемся
    if (prevTokenRef.current !== token) {
      prevTokenRef.current = token
      console.log('[SignalR] Token changed or initial connection')
      
      if (signalRService.isConnected()) {
        signalRService.reconnect()
      } else {
        signalRService.connect()
      }
    }
  }, [isAuthenticated, token])

  return <>{children}</>
}
