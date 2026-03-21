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
  private registeredHandlers: Map<string, (...args: unknown[]) => void> = new Map()

  // ================= Connection =================

  private connectionStatus: SignalRConnectionStatus = 'connecting'
  private listeners = new Set<(status: SignalRConnectionStatus) => void>()

  private setStatus(status: SignalRConnectionStatus) {
    this.connectionStatus = status

    console.log('[SignalR DEBUG] status:', status)

    this.listeners.forEach((l) => l(status))
  }

  registerHandler<K extends keyof NotificationEvents>(
      event: K,
      handler: NotificationEvents[K]
  ): void {
      const key = event as string

      if (this.registeredHandlers.has(key)) {
          console.warn('[SignalR] handler already registered:', key)
          return
      }

      console.log('[SignalR] REGISTERING handler for:', key)
      this.registeredHandlers.set(key, handler as (...args: unknown[]) => void)

      // Если connection уже существует, навешиваем обработчик сразу
      if (this.connection) {
          console.log('[SignalR] Connection exists, attaching handler immediately for:', key)
          this.connection.on(key, (...args) => {
              console.log('[SignalR EVENT]', { event: key, args, time: new Date().toISOString() })
              ;(handler as (...args: unknown[]) => void)(...args)
          })
      }
  }

  subscribeStatus(listener: (status: SignalRConnectionStatus) => void) {
    this.listeners.add(listener)

    // сразу отдаем текущее значение
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

  // ================= CONNECT =================

  async connect(): Promise<void> {
    console.log('[SignalR] CONNECT ATTEMPT', {
        hasToken: !!this.getToken(),
        tokenPreview: this.getToken()?.slice(0, 20),
        state: this.connection?.state,
        isConnecting: this.isConnecting,
        time: new Date().toISOString()
    })
    
    if (!this.isAuthenticated()) return

    if (this.connection?.state === HubConnectionState.Connected) {
        console.log('[SignalR] Already connected, skipping')
        return
    }
    
    if (this.isConnecting) {
        console.log('[SignalR] Already connecting, skipping')
        return
    }

    this.setStatus('connecting')
    this.isConnecting = true

    try {
        if (this.connection) {
            console.log('[SignalR] Closing existing connection before creating new one')
            try {
                await this.connection.stop()
            } catch (e) {
                console.warn('[SignalR] Error stopping existing connection', e)
            }
            this.connection = null
        }

        const connection = this.buildConnection()
        this.connection = connection

        // Навешиваем все зарегистрированные обработчики на новый connection
        console.log('[SignalR] Attaching registered handlers to new connection, count:', this.registeredHandlers.size)
        this.registeredHandlers.forEach((handler, event) => {
            connection.on(event, (...args) => {
                console.log('[SignalR EVENT]', { event, args, time: new Date().toISOString() })
                handler(...args)
            })
        })

        // Регистрируем lifecycle handlers
        this.registerLifecycleHandlers(connection)

        console.log('[SignalR] starting connection...')
        await connection.start()
        
        if (this.connection === connection) {
            this.setStatus('connected')
        }

        console.log('[SignalR] connection started')
        console.log('[SignalR] Connected, ready to receive events')
    } catch (error) {
        console.error('[SignalR] connect error', error)
        this.setStatus('disconnected')
        this.connection = null
    } finally {
        this.isConnecting = false
    }
  }

  // ================= DISCONNECT =================

  async disconnect(): Promise<void> {
    if (!this.connection) return

    try {
      await this.connection.stop()
      console.log('[SignalR] disconnected')
    } catch (error) {
      console.error('[SignalR] disconnect error', error)
    } finally {
      this.connection = null
      this.setStatus('disconnected')
    }
  }

  // ================= RECONNECT =================

  async reconnect(): Promise<void> {
    console.log('[SignalR] MANUAL RECONNECT START', {
        time: new Date().toISOString(),
        currentState: this.connection?.state,
        isConnecting: this.isConnecting
    })

    // Если уже подключаемся, не нужно
    if (this.isConnecting) {
        console.log('[SignalR] Already connecting, skipping reconnect')
        return
    }

    try {
        await this.disconnect()
        await this.connect()
        console.log('[SignalR] MANUAL RECONNECT DONE')
    } catch (error) {
        console.error('[SignalR] reconnect error', error)
    }
  }

  // ================= LIFECYCLE =================

  private registerLifecycleHandlers(connection: HubConnection) {
    connection.onreconnecting((error) => {
        if (this.connection !== connection) return
        this.setStatus('connecting')
        console.warn('[SignalR] RECONNECTING', { error })
    })

    connection.onreconnected((connectionId) => {
        if (this.connection !== connection) return
        this.setStatus('connected')
        console.log('[SignalR] RECONNECTED', { connectionId })
    })

    connection.onclose((error) => {
        if (this.connection !== connection) return
        this.setStatus('disconnected')
        console.error('[SignalR] CLOSED', { error })
    })
  }

  // ================= EVENTS =================

  unsubscribe<K extends keyof NotificationEvents>(
    event: K,
    handler: NotificationEvents[K]
  ): void {
    if (!this.connection) return
    this.connection.off(event, handler as (...args: unknown[]) => void)
    
    // Также удаляем из registeredHandlers
    const key = event as string
    if (this.registeredHandlers.has(key) && this.registeredHandlers.get(key) === handler) {
        this.registeredHandlers.delete(key)
    }
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

  // ================= TYPED EVENTS =================

  onInitialState(handler: NotificationEvents['initialnotificationstate']) {
    // Убираем лишний лог, т.к. registerHandler уже логирует
    this.registerHandler('initialnotificationstate', handler)
    return () => {
        console.log('[SignalR] UNREGISTERING onInitialState handler')
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