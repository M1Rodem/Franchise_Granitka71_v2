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

type EventKey = keyof NotificationEvents

class SignalRService {
  private connection: HubConnection | null = null
  private isConnecting = false
  private manuallyStopped = false

  // ================= TOKEN =================

  private getToken(): string | null {
    return useAuthStore.getState().token
  }

  private isAuthenticated(): boolean {
    return !!this.getToken()
  }

  // ================= BUILD =================

  private buildConnection(): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(env.signalRUrl, {
        accessTokenFactory: () => {
          const token = this.getToken()

          console.log('[SignalR] accessTokenFactory', {
            hasToken: !!token,
            tokenPreview: token?.slice(0, 20),
            time: new Date().toISOString()
          })

          return token ?? ''
        },
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build()
  }

  private registerCoreHandlers() {
    if (!this.connection) return

    // ВАЖНО: регистрируем ДО start()

    this.connection.on('InitialNotificationState', (data) => {
      console.log('Initial state:', data)
    })

    this.connection.on('ReceiveNotification', (data) => {
      console.log('Notification:', data)
    })

    this.connection.on('UpdateNotificationCount', (data) => {
      console.log('Badge:', data)
    })
  }

  // ================= CONNECT =================

  async connect(): Promise<void> {
    console.log('[SignalR] CONNECT ATTEMPT', {
      hasToken: !!this.getToken(),
      tokenPreview: this.getToken()?.slice(0, 20),
      state: this.connection?.state,
      time: new Date().toISOString()
    })
    if (!this.isAuthenticated()) return

    if (this.connection?.state === HubConnectionState.Connected) return
    if (this.isConnecting) return

    this.isConnecting = true
    this.manuallyStopped = false

    try {
      this.connection = this.buildConnection()
      this.registerCoreHandlers()
      this.registerLifecycleHandlers()

      console.log('[SignalR] starting connection...')

      await this.connection.start()

      console.log('[SignalR] connection started')

      await this.invoke('RequestCurrentState')
    } catch (error) {
      console.error('[SignalR] connect error', error)
    } finally {
      this.isConnecting = false
    }
  }

  // ================= DISCONNECT =================

  async disconnect(): Promise<void> {
    this.manuallyStopped = true

    if (!this.connection) return

    try {
      await this.connection.stop()
      console.log('[SignalR] disconnected')
    } catch (error) {
      console.error('[SignalR] disconnect error', error)
    } finally {
      this.connection = null
    }
  }

  // ================= RECONNECT =================

  async reconnect(): Promise<void> {
    console.log('[SignalR] MANUAL RECONNECT START', {
      time: new Date().toISOString()
    })

    try {
      await this.disconnect()
      await this.connect()

      console.log('[SignalR] MANUAL RECONNECT DONE')
    } catch (error) {
      console.error('[SignalR] reconnect error', error)
    }
  }

  // ================= LIFECYCLE =================

  private registerLifecycleHandlers() {
    if (!this.connection) return

    this.connection.onreconnecting((error) => {
      console.warn('[SignalR] RECONNECTING', {
        error,
        time: new Date().toISOString(),
        token: this.getToken()?.slice(0, 20)
      })
    })

    this.connection.onreconnected(async () => {
      console.log('[SignalR] RECONNECTED', {
        time: new Date().toISOString(),
        token: this.getToken()?.slice(0, 20)
      })

      await this.invoke('RequestCurrentState')
    })

    this.connection.onclose((error) => {
      console.error('[SignalR] CLOSED', {
        error,
        manuallyStopped: this.manuallyStopped,
        time: new Date().toISOString(),
        token: this.getToken()?.slice(0, 20)
      })

      if (this.manuallyStopped) return
    })
  }

  // ================= EVENTS =================

  subscribe<K extends EventKey>(
    event: K,
    handler: NotificationEvents[K]
  ): void {
    if (!this.connection) return
    this.connection.on(event, handler as (...args: unknown[]) => void)
  }

  unsubscribe<K extends EventKey>(
    event: K,
    handler: NotificationEvents[K]
  ): void {
    if (!this.connection) return
    this.connection.off(event, handler as (...args: unknown[]) => void)
  }

  // ================= INVOKE =================

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
}


export const signalRService = new SignalRService()