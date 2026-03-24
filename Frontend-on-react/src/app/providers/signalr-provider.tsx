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
  NotificationResolvedDto,
} from '@/shared/lib/signalr/signalr.types'

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

      const handleBadge = (badge: NotificationBadgeDto) => {
        useNotificationsStore
          .getState()
          .handleBadgeUpdate(badge)
      }

      const handleInitial = (state: InitialNotificationStateDto) => {
        useNotificationsStore
          .getState()
          .handleInitialState(state)
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
      signalRService.onBadgeUpdated(handleBadge)
      signalRService.onInitialState(handleInitial)

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
