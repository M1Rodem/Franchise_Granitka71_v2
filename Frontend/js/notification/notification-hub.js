import { HubConnectionBuilder, HttpTransportType } from '@microsoft/signalr';
import { secureGetToken, secureGetUserData, showTempMessage } from '../utils/utils.js';
import { apiService } from '../api/api.js';
import { setState } from './notification-state.js';
import { updateNotificationBadge } from './notification-ui.js';

class NotificationHub {
  constructor() {
    this.connection = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;

    this.events = {
        NOTIFICATION_RECEIVED: 'ReceiveNotification',
        NOTIFICATION_COUNT_UPDATED: 'UpdateNotificationCount',
        NOTIFICATION_UPDATED: 'UpdateNotification',
        NOTIFICATION_RESOLVED: 'NotificationResolved',
        NOTIFICATION_POSTPONED: 'NotificationPostponed',
        NOTIFICATION_SEEN: 'NotificationSeen',
        CONNECTION_ESTABLISHED: 'ConnectionEstablished',
        CONNECTION_LOST: 'ConnectionLost',
        CONNECTION_STATE_CHANGED: 'connection_state_changed',
        INITIAL_STATE: 'InitialNotificationState'
    };

    this._handlers = new Map();

    if (typeof window !== 'undefined' && !window.notificationHub) {
        window.notificationHub = this;
    }

    this.hasRequestedInitialState = false;
    this._reconnectTimeoutId = null;
    
    // Добавляем глобальный обработчик ошибок SignalR
    if (typeof window !== 'undefined') {
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.message && 
                (event.reason.message.includes('SignalR') || 
                 event.reason.message.includes('WebSocket'))) {
                console.error('[NotificationHub] Глобальная ошибка SignalR:', event.reason);
            }
        });
    }
  }

  getState() {
      if (!this.connection) return 'Disconnected';
      return this.connection.state;
  }

  async connect() {
      if (this.isConnecting || this.connection?.state === 'Connected') {
          return;
      }

      const token = secureGetToken();
      const userData = secureGetUserData();

      if (!token || !userData?.id) {
          console.warn('[NotificationHub] Нет токена или пользователя для подключения');
          this._emit(this.events.CONNECTION_STATE_CHANGED, { 
              state: 'disconnected', 
              reason: 'no_auth',
              canRetry: false
          });
          return;
      }

      this.isConnecting = true;
      
      this._emit(this.events.CONNECTION_STATE_CHANGED, { 
          state: 'connecting',
          userId: userData.id
      });

      // Создаем промис с таймаутом
      const connectWithTimeout = async () => {
          const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Таймаут подключения SignalR (10 сек)')), 10000);
          });

          try {
              const connectionUrl = `${window.location.origin}/api/notificationhub`;
              
              this.connection = new HubConnectionBuilder()
                  .withUrl(connectionUrl, {
                      accessTokenFactory: () => token,
                      skipNegotiation: false,
                      transport: HttpTransportType.LongPolling | HttpTransportType.ServerSentEvents  // Убрали WebSockets
                  })
                  .withAutomaticReconnect({
                      nextRetryDelayInMilliseconds: (retryContext) => {
                          const delay = Math.min(32000, Math.pow(2, retryContext.previousRetryCount) * 1000);
                          return delay;
                      }
                  })
                  .configureLogging({
                      log: (logLevel, message) => {
                          if (logLevel >= 1);
                      }
                  })
                  .build();

              this._setupServerEventHandlers(userData.id);

              // Обработчики подключения
              this.connection.onclose(async (error) => {
                  this.isConnecting = false;
                  this.hasRequestedInitialState = false;
                  
                  this._emit(this.events.CONNECTION_STATE_CHANGED, { 
                      state: 'disconnected', 
                      reason: error?.message || 'closed',
                      canRetry: true
                  });
                  
                  setTimeout(() => {
                      if (secureGetToken() && secureGetUserData()?.id) {
                          this.connect().catch(err => {
                              console.warn('[SignalR] Ошибка автоматического переподключения:', err);
                          });
                      }
                  }, 3000);
              });

              this.connection.onreconnecting((error) => {
                  this._emit(this.events.CONNECTION_STATE_CHANGED, { 
                      state: 'reconnecting', 
                      reason: error?.message 
                  });
              });

              this.connection.onreconnected((connectionId) => {
                  this.reconnectAttempts = 0;
                  this.hasRequestedInitialState = false;
                  
                  if (this.connection.state === 'Connected') {
                      this.connection.invoke('RequestCurrentState')
                          .then(() => {
                              this.hasRequestedInitialState = true;
                          })
                          .catch(err => {
                              console.warn('[SignalR] Ошибка запроса состояния после переподключения:', err);
                          });
                  }
                  
                  this._emit(this.events.CONNECTION_STATE_CHANGED, { 
                      state: 'connected',
                      connectionId 
                  });
              });
              
              // Запускаем соединение и ждем с таймаутом
              await Promise.race([
                  this.connection.start(),
                  timeoutPromise
              ]);

              if (this.connection.state === 'Connected' && !this.hasRequestedInitialState) {
                  try {
                      await this.connection.invoke('RequestCurrentState');
                      this.hasRequestedInitialState = true;
                  } catch (err) {
                      console.warn('[NotificationHub] Ошибка запроса начального состояния:', err);
                  }
              }

              this.isConnecting = false;
              this._emit(this.events.CONNECTION_STATE_CHANGED, { 
                  state: 'connected', 
                  userId: userData.id 
              });

          } catch (error) {
              console.error('[NotificationHub] ОШИБКА подключения:', error);
              console.error('[NotificationHub] Тип ошибки:', error.name);
              console.error('[NotificationHub] Сообщение:', error.message);
              console.error('[NotificationHub] Стек:', error.stack);
              
              // Проверяем специфичные ошибки
              if (error.message.includes('negotiate')) {
                  console.error('[NotificationHub] Ошибка negotiation - возможно проблемы с CORS или endpoint');
              } else if (error.message.includes('WebSocket')) {
                  console.error('[NotificationHub] Ошибка WebSocket - проверь поддержку WebSocket на сервере');
              } else if (error.message.includes('timeout')) {
                  console.error('[NotificationHub] Таймаут - сервер не отвечает');
              }
              
              this.isConnecting = false;
              this.connection = null;
              this._emit(this.events.CONNECTION_STATE_CHANGED, { state: 'error', error });
          }
      };

      return connectWithTimeout();
  }

  async _joinUserGroup(userId) {
      if (!this.connection || this.connection.state !== 'Connected') {
          return false;
      }

      try {
          // Проверяем существует ли метод на сервере
          await this.connection.invoke('JoinUserGroup', userId.toString());
          return true;
      } catch (err) {
          // Игнорируем ошибку "Method does not exist"
          if (err.message.includes('Method does not exist')) {
              console.warn('[SignalR] Метод JoinUserGroup не существует на сервере. Продолжаем без групп.');
              return true; // Возвращаем true чтобы не блокировать подключение
          }
          
          console.error('[SignalR] Ошибка присоединения к группе:', err);
          return false;
      }
  }

  _setupServerEventHandlers(currentUserId) {
      if (!this.connection) {
          console.error('[NotificationHub] Нет соединения для настройки обработчиков');
          return;
      }

      // 1. ReceiveNotification - новое уведомление
      this.connection.on('ReceiveNotification', (notification) => {
          
          const enrichedNotification = {
              ...notification,
              isInformation: notification.type === 2,
              isInfluencing: notification.type === 0,
              _eventType: 'receive',
              _timestamp: new Date().toISOString()
          };
          
          this._emit(this.events.NOTIFICATION_RECEIVED, enrichedNotification);
      });

      // 2. UpdateNotification - обновление существующего уведомления
      this.connection.on('UpdateNotification', (notification) => {
          
          if (notification.recipientUserId && notification.recipientUserId !== currentUserId) {
              return;
          }
          
          const enrichedNotification = {
              ...notification,
              isInformation: notification.type === 2,
              isInfluencing: notification.type === 0,
              _eventType: 'update',
              _timestamp: new Date().toISOString()
          };
          
          this._emit(this.events.NOTIFICATION_UPDATED, enrichedNotification);
      });

      // 3. UpdateNotificationCount - обновление счетчика
      this.connection.on('UpdateNotificationCount', (countData) => {
          
          const count = typeof countData === 'object' ? countData.count : countData;
          const type = typeof countData === 'object' ? countData.type : 'total';
          
          this._emit(this.events.NOTIFICATION_COUNT_UPDATED, {
              count,
              type,
              timestamp: new Date().toISOString()
          });
      });

      // 4. NotificationResolved - уведомление разрешено
      this.connection.on('NotificationResolved', (resolutionData) => {
          
          const enrichedData = {
              ...resolutionData,
              _eventType: 'resolved',
              _timestamp: new Date().toISOString(),
              status: resolutionData.status
          };
          
          this._emit(this.events.NOTIFICATION_RESOLVED, enrichedData);
      });

      // 5. NotificationPostponed - уведомление отложено
      this.connection.on('NotificationPostponed', (postponementData) => {
          
          const enrichedData = {
              ...postponementData,
              _eventType: 'postponed',
              _timestamp: new Date().toISOString(),
              returnsAt: postponementData.returnsAt || new Date(Date.now() + (postponementData.minutes || 30) * 60000).toISOString()
          };
          
          this._emit(this.events.NOTIFICATION_POSTPONED, enrichedData);
      });

      // 6. NotificationSeen - уведомление просмотрено
      this.connection.on('NotificationSeen', (seenData) => {
          
          this._emit(this.events.NOTIFICATION_SEEN, {
              ...seenData,
              _timestamp: new Date().toISOString()
          });
      });

      // 7. ConnectionEstablished - подтверждение подключения от сервера
      this.connection.on('ConnectionEstablished', (message) => {
          this._emit(this.events.CONNECTION_ESTABLISHED, {
              message: message || 'Соединение с сервером уведомлений установлено',
              timestamp: new Date().toISOString()
          });
      });

      // 8. ConnectionLost - уведомление о потере соединения
      this.connection.on('ConnectionLost', (message) => {
          console.warn('[SignalR] Сервер сообщил о потере соединения:', message);
          this._emit(this.events.CONNECTION_LOST, {
              message: message || 'Потеряно соединение с сервером уведомлений',
              timestamp: new Date().toISOString()
          });
      });

      // 9. InitialNotificationState - начальное состояние
      this.connection.on(this.events.INITIAL_STATE, (state) => {          
          updateNotificationBadge(state.unreadCount || 0);
          
          if (typeof setState === 'function') {
              setState({ 
                  unreadCount: state.unreadCount || 0,
                  lastSync: new Date().toISOString() 
              });
          }
          
          this._emit(this.events.NOTIFICATION_COUNT_UPDATED, {
              count: state.unreadCount || 0,
              type: 'total',
              timestamp: new Date().toISOString()
          });

          this._emit(this.events.CONNECTION_STATE_CHANGED, { 
              state: 'synced',
              unreadCount: state.unreadCount || 0
          });
      });
  }

  _scheduleReconnect() {
    this.reconnectAttempts++;
    
    // Экспоненциальная задержка с максимумом 30 секунд
    const baseDelay = this.reconnectDelay;
    const maxDelay = 30000;
    const delay = Math.min(maxDelay, baseDelay * Math.pow(1.5, this.reconnectAttempts - 1));

    const timeoutId = setTimeout(() => {
      const token = secureGetToken();
      if (token && this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect().catch(err => {
          console.error('[SignalR] Ошибка при переподключении:', err);
        });
      } else {
        console.warn('[SignalR] Превышено максимальное количество попыток переподключения или нет токена');
        this._emit(this.events.CONNECTION_STATE_CHANGED, {
          state: 'disconnected',
          reason: 'max_retries_exceeded',
          canRetry: false
        });
      }
    }, delay);

    // Сохраняем ID таймаута для возможной отмены
    this._reconnectTimeoutId = timeoutId;
  }

 on(eventName, handler) {
    if (!this._handlers.has(eventName)) {
      this._handlers.set(eventName, []);
    }
    this._handlers.get(eventName).push(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    if (this._handlers.has(eventName)) {
      const handlers = this._handlers.get(eventName);
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  _emit(eventName, data) {
    if (this._handlers.has(eventName)) {
      this._handlers.get(eventName).forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[NotificationHub] Ошибка в обработчике ${eventName}:`, err);
        }
      });
    }
  }

  async disconnect() {
    // Отменяем запланированное переподключение
    if (this._reconnectTimeoutId) {
      clearTimeout(this._reconnectTimeoutId);
      this._reconnectTimeoutId = null;
    }

    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (err) {
        console.error('[SignalR] Ошибка при остановке соединения:', err);
      } finally {
        this.connection = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        this._emit(this.events.CONNECTION_STATE_CHANGED, { 
          state: 'disconnected',
          reason: 'manual_disconnect',
          canRetry: false
        });
      }
    }
  }

    getConnectionState() {
    if (!this.connection) {
      return {
        state: 'Disconnected',
        canRetry: this.reconnectAttempts < this.maxReconnectAttempts,
        reconnectAttempts: this.reconnectAttempts
      };
    }
    
    return {
      state: this.connection.state,
      connectionId: this.connection.connectionId,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Отправка события серверу
  async sendToServer(methodName, ...args) {
    if (!this.connection || this.connection.state !== 'Connected') {
      console.warn(`[SignalR] Не могу отправить ${methodName}: нет соединения`);
      throw new Error('Нет соединения с сервером');
    }

    try {
      return await this.connection.invoke(methodName, ...args);
    } catch (error) {
      console.error(`[SignalR] Ошибка при отправке ${methodName}:`, error);
      throw error;
    }
  }

  // Подписка на все события
  subscribeAll(handler) {
    const unsubscribers = [];
    
    Object.values(this.events).forEach(eventName => {
      if (eventName !== 'connection_state_changed') {
        const unsubscribe = this.on(eventName, (data) => {
          handler(eventName, data);
        });
        unsubscribers.push(unsubscribe);
      }
    });
    
    // Возвращаем функцию для отписки от всех событий
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }
  getState() {
    if (!this.connection) return 'Disconnected';
    return this.connection.state;
  } 
}

export const notificationHub = new NotificationHub();