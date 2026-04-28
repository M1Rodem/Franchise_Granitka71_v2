import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import { env } from '@/shared/config/env'
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
    this.registeredHandlers.clear()
  }

  registerHandler<K extends keyof NotificationEvents>(
    event: K,
    handler: NotificationEvents[K]
  ): void {
    const key = event as string

    if (this.registeredHandlers.has(key)) {
      return
    }

    const wrapped = (...args: unknown[]) => {
      ; (handler as (...args: unknown[]) => void)(...args)
    }

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
    const raw = localStorage.getItem('auth-session')
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw)
      return parsed.token
    } catch {
      return null
    }
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
      .configureLogging(LogLevel.None)
      .build()
  }

  async connect(): Promise<void> {
    if (!this.isAuthenticated()) return
    await this.waitForValidToken()
    if (this.connection?.state === HubConnectionState.Connected) return
    if (this.isConnecting) return

    this.setStatus('connecting')
    this.isConnecting = true

    try {
      if (this.connection) {
        try {
          await this.connection.stop()
        } catch (error) {
          console.error('[SignalR] Error stopping existing connection', error)
        }

        this.connection = null
      }

      const connection = this.buildConnection()
      this.connection = connection

      this.registeredHandlers.forEach(({ wrapped }, event) => {
        connection.on(event, wrapped)
      })

      this.registerLifecycleHandlers(connection)
      await connection.start()

      if (this.connection === connection) {
        this.setStatus('connected')
      }
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
    if (this.isConnecting) return

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
    } catch {
      // silent fail
    }
  }

  private registerLifecycleHandlers(connection: HubConnection) {
    let reconnectAttempt = 0

    connection.onreconnecting(async (_) => {
      await this.waitForValidToken()
      if (this.connection !== connection) return

      reconnectAttempt += 1
      this.setStatus('connecting')
    })

    connection.onreconnected((_) => {
      if (this.connection !== connection) return

      reconnectAttempt = 0
      this.setStatus('connected')
    })

    connection.onclose((_) => {
      if (this.connection !== connection) return

      this.setStatus('disconnected')
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

  onNotificationCountsUpdated(handler: NotificationEvents['updatenotificationcounts']) {
    this.registerHandler('updatenotificationcounts', handler)
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
}

export const signalRService = new SignalRService()