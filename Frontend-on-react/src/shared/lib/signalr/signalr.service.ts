import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import { env } from '@/shared/config/env'
import { useAuthStore } from '@/shared/store/auth.store'
import type {
  NotificationEvents,
  SignalRServerMethods,
} from './signalr.types'

export type SignalRConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'

class SignalRService {
  private connection: HubConnection | null = null
  private isConnecting = false
  private registeredHandlers: Map<
    string,
    {
      original: (...args: unknown[]) => void
      wrapped: (...args: unknown[]) => void
    }
  > = new Map()
  private connectionStatus: SignalRConnectionStatus = 'connecting'
  private listeners = new Set<(status: SignalRConnectionStatus) => void>()

  private setStatus(status: SignalRConnectionStatus) {
    this.connectionStatus = status
    this.listeners.forEach((listener) => listener(status))
  }

  clearHandlers(): void {
    console.warn('[SIGNALR][CLEAR_HANDLERS]', {
      count: this.registeredHandlers.size,
    })

    this.registeredHandlers.clear()
  }

  registerHandler<K extends keyof NotificationEvents>(
    event: K,
    handler: NotificationEvents[K]
  ): void {
    const key = event as string

    if (this.registeredHandlers.has(key)) {
      console.warn('[SIGNALR][SKIP_DUPLICATE_HANDLER]', {
        event: key,
      })
      console.warn('[SignalR] handler already registered:', key)
      return
    }

    const wrapped = (...args: unknown[]) => {
      console.debug('[SIGNALR][EVENT]', {
        event: key,
        args,
      })
      ;(handler as (...args: unknown[]) => void)(...args)
    }

    console.info('[SIGNALR][REGISTER]', {
      event: key,
      totalHandlers: this.registeredHandlers.size + 1,
    })

    this.registeredHandlers.set(key, {
      original: handler as (...args: unknown[]) => void,
      wrapped,
    })

    if (this.connection) {
      this.connection.on(key, wrapped)
    }
  }

  subscribeStatus(listener: (status: SignalRConnectionStatus) => void) {
    this.listeners.add(listener)
    listener(this.connectionStatus)

    return () => {
      this.listeners.delete(listener)
    }
  }

  getConnectionStatus(): SignalRConnectionStatus {
    return this.connectionStatus
  }

  isConnected(): boolean {
    return this.connectionStatus === 'connected'
  }

  private getToken(): string | null {
    return useAuthStore.getState().token
  }

  private isAuthenticated(): boolean {
    return !!this.getToken()
  }

  private buildConnection(): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(env.signalRUrl, {
        accessTokenFactory: () => this.getToken() ?? '',
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build()
  }

  async connect(): Promise<void> {
    if (!this.isAuthenticated()) return
    await this.waitForValidToken()
    if (this.connection?.state === HubConnectionState.Connected) return
    if (this.isConnecting) return
    console.info('[SIGNALR][CONNECT_START]', {
      hasConnection: !!this.connection,
      state: this.connection?.state ?? null,
    })

    this.setStatus('connecting')
    this.isConnecting = true

    try {
      if (this.connection) {
        try {
          await this.connection.stop()
        } catch (error) {
          console.warn('[SignalR] Error stopping existing connection', error)
        }

        this.connection = null
      }

      const connection = this.buildConnection()
      this.connection = connection

      this.registeredHandlers.forEach(({ wrapped }, event) => {
        console.info('[SIGNALR][BIND_HANDLER]', {
          event,
          totalHandlers: this.registeredHandlers.size,
        })
        connection.on(event, wrapped)
      })

      this.registerLifecycleHandlers(connection)
      await connection.start()

      if (this.connection === connection) {
        this.setStatus('connected')
      }

      console.info('[SIGNALR][CONNECTED]', {
        userId: useAuthStore.getState().user?.id ?? null,
      })
    } catch (error) {
      console.error('[SignalR] connect error', error)
      this.setStatus('disconnected')
      this.connection = null
    } finally {
      this.isConnecting = false
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connection) return

    try {
      await this.connection.stop()
    } catch (error) {
      console.error('[SignalR] disconnect error', error)
    } finally {
      this.connection = null
      this.setStatus('disconnected')
    }
  }

  async reconnect(): Promise<void> {
    if (this.isConnecting) {
      console.warn('[SIGNALR][RECONNECT_SKIP_ALREADY_CONNECTING]')
      return
    }

    try {
      await this.disconnect()
      await this.connect()
    } catch (error) {
      console.error('[SignalR] reconnect error', error)
    }
  }

  private async waitForValidToken(): Promise<void> {
    const { checkAndRefreshIfNeeded } = await import('@/shared/lib/silent-refresh.service')

    try {
      await checkAndRefreshIfNeeded()
    } catch (e) {
      console.warn('[SIGNALR][TOKEN_WAIT_FAILED]')
    }
  }

  private registerLifecycleHandlers(connection: HubConnection) {
    let reconnectAttempt = 0

    connection.onreconnecting(async (error) => {
      await this.waitForValidToken()
      if (this.connection !== connection) return

      reconnectAttempt += 1
      console.warn('[SIGNALR][RECONNECTING]', {
        attempt: reconnectAttempt,
        reason: error?.message ?? null,
      })
      this.setStatus('connecting')
    })

    connection.onreconnected((connectionId) => {
      if (this.connection !== connection) return

      reconnectAttempt = 0
      this.setStatus('connected')
      console.info('[SIGNALR][RECONNECTED]', {
        connectionId,
      })
      console.info('[SIGNALR][CONNECTED]', {
        userId: useAuthStore.getState().user?.id ?? null,
        handlers: this.registeredHandlers.size,
      })
    })

    connection.onclose((error) => {
      if (this.connection !== connection) return

      this.setStatus('disconnected')
      console.warn('[SIGNALR][DISCONNECTED]', {
        reason: error?.message ?? null,
        handlers: this.registeredHandlers.size,
      })
    })
  }

  unsubscribe<K extends keyof NotificationEvents>(
    event: K,
    handler: NotificationEvents[K]
  ): void {
    const key = event as string
    const record = this.registeredHandlers.get(key)

    if (!record) return

    if (record.original !== handler) return

    if (this.connection) {
      this.connection.off(key, record.wrapped)
    }
    console.info('[SIGNALR][UNSUBSCRIBE]', {
      event: key,
      remaining: this.registeredHandlers.size - 1,
    })
    this.registeredHandlers.delete(key)
  }

  async invoke<T = void>(
    method: SignalRServerMethods,
    ...args: unknown[]
  ): Promise<T | undefined> {
    if (!this.connection) return

    try {
      return await this.connection.invoke<T>(method, ...args)
    } catch (error) {
      console.error('[SignalR] invoke error', error)
    }
  }

  onInitialState(handler: NotificationEvents['initialnotificationstate']) {
    this.registerHandler('initialnotificationstate', handler)
    return () => {
      this.unsubscribe('initialnotificationstate', handler)
    }
  }

  onNotificationReceived(handler: NotificationEvents['receivenotification']) {
    this.registerHandler('receivenotification', handler)
    return () => this.unsubscribe('receivenotification', handler)
  }

  onNotificationUpdated(handler: NotificationEvents['updatenotification']) {
    this.registerHandler('updatenotification', handler)
    return () => this.unsubscribe('updatenotification', handler)
  }

  onNotificationResolved(handler: NotificationEvents['notificationresolved']) {
    this.registerHandler('notificationresolved', handler)
    return () => this.unsubscribe('notificationresolved', handler)
  }

  onNotificationPostponed(handler: NotificationEvents['notificationpostponed']) {
    this.registerHandler('notificationpostponed', handler)
    return () => this.unsubscribe('notificationpostponed', handler)
  }

  onBadgeUpdated(handler: NotificationEvents['updatenotificationcount']) {
    this.registerHandler('updatenotificationcount', handler)
    return () => this.unsubscribe('updatenotificationcount', handler)
  }
}

export const signalRService = new SignalRService()
