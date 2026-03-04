import { useMemo } from 'react'
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import type { QueryClient } from '@tanstack/react-query'
import { env } from '@/shared/config/env'
import { useNotificationBadgeStore } from '@/modules/notifications/store/notification-badge.store'

class NotificationRealtimeService {
  private connection: HubConnection | null = null

  async connect(queryClient: QueryClient): Promise<void> {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      return
    }

    const connection = new HubConnectionBuilder()
      .withUrl(env.signalRUrl, {
        withCredentials: true, // 🔥 cookie media_auth будет отправляться автоматически
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.onclose(() => {
      useNotificationBadgeStore.getState().setRealtimeConnected(false)
    })

    connection.onreconnected(() => {
      useNotificationBadgeStore.getState().setRealtimeConnected(true)
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })

    connection.on('ReceiveNotification', () => {
      useNotificationBadgeStore.getState().incrementUnread()
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })

    connection.on('UpdateNotificationCount', (count: number) => {
      useNotificationBadgeStore.getState().setUnreadCount(count)
    })

    this.connection = connection

    await connection.start()
    useNotificationBadgeStore.getState().setRealtimeConnected(true)
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      return
    }

    await this.connection.stop()
    this.connection = null
    useNotificationBadgeStore.getState().setRealtimeConnected(false)
  }
}

export const notificationRealtimeService = new NotificationRealtimeService()

export function useNotificationRealtimeService(): NotificationRealtimeService {
  return useMemo(() => notificationRealtimeService, [])
}