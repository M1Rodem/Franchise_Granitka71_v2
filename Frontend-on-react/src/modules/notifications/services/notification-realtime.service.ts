import { useMemo } from 'react'
import {
  HubConnectionBuilder,
  LogLevel,
} from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import type { QueryClient } from '@tanstack/react-query'

import { env } from '@/shared/config/env'
import { useNotificationBadgeStore } from '@/modules/notifications/store/notification-badge.store'
import { useAuthStore } from '@/shared/store/auth.store'

const DEBUG_PREFIX = '[SignalR Notifications]'

class NotificationRealtimeService {
  private isConnecting = false
  private connection: HubConnection | null = null
  private debugInterval: ReturnType<typeof setInterval> | null = null
  
  async connect(queryClient: QueryClient): Promise<void> {
    if (this.connection?.state === 'Connected') {
      return
    }

    this.isConnecting = true
    if (import.meta.env.DEV) {
      if (!this.debugInterval) {
        this.debugInterval = setInterval(() => {
          if (!this.connection) return
        }, 5000)
      }
    }
    // всегда убиваем старое соединение
    if (this.connection) {
      try {
        await this.connection.stop()
      } catch (error) {
        console.warn(DEBUG_PREFIX, 'stop failed (safe ignore)', error)
      }

      await new Promise((r) => setTimeout(r, 300))

      this.connection = null
    }

    const connection = new HubConnectionBuilder()
      .withUrl(env.signalRUrl, {
        accessTokenFactory: () => {
          const token = useAuthStore.getState().token
          return token ? token.replace('Bearer ', '') : ''
        }
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build()

    connection.onclose(async (error) => {
      console.warn(DEBUG_PREFIX, 'connection closed', error)
      useNotificationBadgeStore.getState().setRealtimeConnected(false)
      // ❌ НЕ вызываем connect() - SignalR сам переподключится
    })

    connection.onreconnecting((error) => {
      console.warn(DEBUG_PREFIX, 'reconnecting...', error)
      useNotificationBadgeStore.getState().setRealtimeConnected(false)
    })

    connection.onreconnected(() => {
      useNotificationBadgeStore.getState().setRealtimeConnected(true)
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })

    /*
    =============================
    SIGNALR EVENTS
    =============================
    */

    connection.on('ReceiveNotification', () => {
      void queryClient.invalidateQueries({
        queryKey: ['notifications']
      })
    })

    connection.on('UpdateNotificationCount', (count: number) => {
      useNotificationBadgeStore
        .getState()
        .setUnreadCount(count)

    })

    connection.on('InitialNotificationState', (state: { unreadCount: number }) => {
      useNotificationBadgeStore
        .getState()
        .setUnreadCount(state.unreadCount)

    })

    connection.on('NotificationResolved', () => {
      void queryClient.invalidateQueries({
        queryKey: ['notifications']
      })

    })

    connection.on('NotificationPostponed', () => {
      void queryClient.invalidateQueries({
        queryKey: ['notifications']
      })

    })

    connection.on('UpdateNotification', () => {
      void queryClient.invalidateQueries({
        queryKey: ['notifications']
      })
    })

    connection.on('NotificationSeen', () => {
      
    })

    this.connection = connection

    try {
      await connection.start()

      useNotificationBadgeStore
        .getState()
        .setRealtimeConnected(true)

    } catch (error) {
      console.error(DEBUG_PREFIX, 'SignalR connection failed', error)
    } finally {
      this.isConnecting = false
    }

  }

  async forceReconnect(queryClient: QueryClient): Promise<void> {
    // Отключаем automatic reconnect временно
    if (this.connection) {
      // Убираем обработчики чтобы не было лишних срабатываний
      this.connection.off('close')
      
      try {
        await this.connection.stop()
      } catch (error) {
        console.warn(DEBUG_PREFIX, 'stop failed', error)
      }
      
      this.connection = null
    }

    // Даем время на полное закрытие
    await new Promise(r => setTimeout(r, 100))
    
    // Создаем новое соединение
    await this.connect(queryClient)
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      console.warn(DEBUG_PREFIX, 'no active connection to close')
      return
    }

    try {

      await this.connection.stop()

    } catch (error) {

      console.error(DEBUG_PREFIX, 'error stopping SignalR', error)

    }

    this.connection = null

    useNotificationBadgeStore
      .getState()
      .setRealtimeConnected(false)

  }

}

export const notificationRealtimeService =
  new NotificationRealtimeService()

export function useNotificationRealtimeService() {
  return useMemo(() => notificationRealtimeService, [])
}