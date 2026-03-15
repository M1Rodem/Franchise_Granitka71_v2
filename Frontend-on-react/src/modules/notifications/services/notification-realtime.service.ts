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
import { authSessionStorage } from '@/shared/lib/auth-session-storage'

const DEBUG_PREFIX = '[SignalR Notifications]'

class NotificationRealtimeService {

  private connection: HubConnection | null = null

  async connect(queryClient: QueryClient): Promise<void> {
    if (import.meta.env.DEV) {
      setInterval(() => {
        if (!this.connection) return

        console.log(
          DEBUG_PREFIX,
          'connection state:',
          this.connection.state
        )
      }, 5000)
    }

    console.log(DEBUG_PREFIX, 'connect() called')

    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      console.log(
        DEBUG_PREFIX,
        'connection already exists. state:',
        this.connection.state
      )
      return
    }

    console.log(DEBUG_PREFIX, 'creating new SignalR connection')

    const connection = new HubConnectionBuilder()

      .withUrl(env.signalRUrl, {
        accessTokenFactory: () => {

          console.log(DEBUG_PREFIX, 'accessTokenFactory called')

          const session = authSessionStorage.read()

          if (!session) {
            console.warn(DEBUG_PREFIX, 'no auth session found')
            return ''
          }

          const token = session.token.replace('Bearer ', '')

          console.log(DEBUG_PREFIX, 'JWT token loaded')

          return token
        }
      })

      .withAutomaticReconnect()

      .configureLogging(LogLevel.Warning)

      .build()

    console.log(DEBUG_PREFIX, 'SignalR hub URL:', env.signalRUrl)

    connection.onclose((error) => {

      console.warn(DEBUG_PREFIX, 'connection closed', error)

      useNotificationBadgeStore
        .getState()
        .setRealtimeConnected(false)

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
      console.log(
        DEBUG_PREFIX,
        'connection state before start:',
        connection.state
      )

      await connection.start()
      console.log(
        DEBUG_PREFIX,
        'SignalR connected successfully. state:',
        connection.state
      )

      console.log(DEBUG_PREFIX, 'SignalR connected successfully')

      useNotificationBadgeStore
        .getState()
        .setRealtimeConnected(true)

    } catch (error) {

      console.error(DEBUG_PREFIX, 'SignalR connection failed', error)

    }

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