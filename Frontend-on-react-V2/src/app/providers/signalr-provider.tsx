import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/shared/store/auth.store'
import { signalRService } from '@/shared/lib/signalr/signalr.service'
import { useNotificationsStore } from '@/modules/notifications/store/notifications.store'
import { mapNotificationToStore } from '@/modules/notifications/utils/map-notification'
import type {
  NotificationUpdateDto,
  NotificationPostponedDto,
  NotificationResolvedDto,
} from '@/shared/lib/signalr/signalr.types'

import type { NotificationCountsDto } from '@/modules/notifications/store/notifications.store'

export function SignalRProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const prevTokenRef = useRef<string | null>(null)
  const handlersRegisteredRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      prevTokenRef.current = null
      handlersRegisteredRef.current = false
      signalRService.disconnect()
      return
    }

    if (!handlersRegisteredRef.current) {
      const handleReceive = (notification: NotificationUpdateDto) => {
        useNotificationsStore
          .getState()
          .handleNewNotification(mapNotificationToStore(notification))
      }

      const handleUpdate = (notification: NotificationUpdateDto) => {
        useNotificationsStore
          .getState()
          .handleUpdateNotification(mapNotificationToStore(notification))
      }

      const handleCounts = (counts: NotificationCountsDto) => {
        console.debug('[SignalR DEBUG][COUNTS_EVENT]', counts)

        useNotificationsStore
          .getState()
          .setCounts(counts)
      }

      const handleResolved = (resolution: NotificationResolvedDto) => {
        useNotificationsStore
          .getState()
          .handleResolved({
            notificationId: resolution.notificationId,
            status: resolution.status,
          })
      }

      const handlePostponed = (postponement: NotificationPostponedDto) => {
        useNotificationsStore
          .getState()
          .handlePostponed({
            notificationId: postponement.notificationId,
            returnsAt: postponement.returnsAt,
          })
      }

      signalRService.onNotificationReceived(handleReceive)
      signalRService.onNotificationUpdated(handleUpdate)
      signalRService.onNotificationResolved(handleResolved)
      signalRService.onNotificationPostponed(handlePostponed)
      signalRService.onNotificationCountsUpdated(handleCounts)

      handlersRegisteredRef.current = true
    }

    if (prevTokenRef.current !== token) {
      prevTokenRef.current = token

      if (!signalRService.isConnected()) {
        signalRService.connect()
      }
    }
  }, [isAuthenticated, token])

  return <>{children}</>
}
