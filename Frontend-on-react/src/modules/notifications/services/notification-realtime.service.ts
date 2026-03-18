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
      console.log(DEBUG_PREFIX, 'already connected, skip')
      return
    }

    this.isConnecting = true
    if (import.meta.env.DEV) {
      if (!this.debugInterval) {
        this.debugInterval = setInterval(() => {
          if (!this.connection) return

          console.log(
            DEBUG_PREFIX,
            'connection state:',
            this.connection.state
          )
        }, 5000)
      }
    }

    console.log(DEBUG_PREFIX, 'connect() called')
    // всегда убиваем старое соединение
    if (this.connection) {
      console.log(DEBUG_PREFIX, 'disposing old connection')

      try {
        await this.connection.stop()
      } catch (error) {
        console.warn(DEBUG_PREFIX, 'stop failed (safe ignore)', error)
      }

      await new Promise((r) => setTimeout(r, 300))

      this.connection = null
    }

    console.log(DEBUG_PREFIX, 'creating new SignalR connection')

    const connection = new HubConnectionBuilder()

      .withUrl(env.signalRUrl, {
        accessTokenFactory: () => {
          const token = useAuthStore.getState().token
          return token ? token.replace('Bearer ', '') : ''
        }
      })

      .withAutomaticReconnect([0, 2000, 5000, 10000])

      .configureLogging(LogLevel.Warning)

      .build()

    console.log(DEBUG_PREFIX, 'SignalR hub URL:', env.signalRUrl)

    connection.onclose(async (error) => {

      console.warn(DEBUG_PREFIX, 'connection closed', error)

      useNotificationBadgeStore
        .getState()
        .setRealtimeConnected(false)

      // ❗ только если НЕ идет уже подключение
      if (error && !this.isConnecting) {
        console.log(DEBUG_PREFIX, 'forcing reconnect after close')

        setTimeout(() => {
          this.connect(queryClient)
        }, 1000)
      }

    })

    connection.onreconnecting((error) => {

      console.warn(DEBUG_PREFIX, 'reconnecting...', error)

    })

    connection.onreconnected(() => {

      console.log(DEBUG_PREFIX, 'reconnected successfully')

      useNotificationBadgeStore
        .getState()
        .setRealtimeConnected(true)

      void queryClient.invalidateQueries({
        queryKey: ['notifications']
      })

    })

    /*
    =============================
    SIGNALR EVENTS
    =============================
    */

    connection.on('ReceiveNotification', (notification) => {

      console.log(DEBUG_PREFIX, 'ReceiveNotification event', notification)

      useNotificationBadgeStore
        .getState()
        .incrementUnread()

      void queryClient.invalidateQueries({
        queryKey: ['notifications']
      })

    })

    connection.on('UpdateNotificationCount', (count: number) => {

      console.log(DEBUG_PREFIX, 'UpdateNotificationCount', count)

      useNotificationBadgeStore
        .getState()
        .setUnreadCount(count)

    })

    connection.on('InitialNotificationState', (state: { unreadCount: number }) => {

      console.log(DEBUG_PREFIX, 'InitialNotificationState', state)

      useNotificationBadgeStore
        .getState()
        .setUnreadCount(state.unreadCount)

    })

    connection.on('NotificationResolved', (payload) => {

      console.log(DEBUG_PREFIX, 'NotificationResolved', payload)

      void queryClient.invalidateQueries({
        queryKey: ['notifications']
      })

    })

    connection.on('NotificationPostponed', (payload) => {

      console.log(DEBUG_PREFIX, 'NotificationPostponed', payload)

      void queryClient.invalidateQueries({
        queryKey: ['notifications']
      })

    })

    connection.on('NotificationSeen', (payload) => {

      console.log(DEBUG_PREFIX, 'NotificationSeen', payload)

      useNotificationBadgeStore
        .getState()
        .incrementUnread()

    })

    this.connection = connection

    console.log(DEBUG_PREFIX, 'starting SignalR connection...')

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
    console.log(DEBUG_PREFIX, 'forceReconnect called')

    if (this.connection) {
      try {
        await this.connection.stop()
      } catch (error) {
        console.warn(DEBUG_PREFIX, 'stop failed (safe ignore)', error)
      }

      await new Promise((r) => setTimeout(r, 300))

      this.connection = null
    }

    this.isConnecting = false

    await this.connect(queryClient)
  }

  async disconnect(): Promise<void> {

    console.log(DEBUG_PREFIX, 'disconnect() called')

    if (!this.connection) {
      console.warn(DEBUG_PREFIX, 'no active connection to close')
      return
    }

    try {

      await this.connection.stop()

      console.log(DEBUG_PREFIX, 'SignalR connection stopped')

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