import { HubConnectionBuilder, HttpTransportType } from '@microsoft/signalr';
import { secureGetToken, secureGetUserData, showTempMessage } from '../utils/utils.js';
import { apiService } from '../api/api.js';

class NotificationHub {
  constructor() {
    this.connection = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;

    // ОБНОВЛЕННЫЕ события в соответствии с бэкендом
    this.events = {
      NOTIFICATION_RECEIVED: 'ReceiveNotification',
      NOTIFICATION_COUNT_UPDATED: 'UpdateNotificationCount',
      NOTIFICATION_UPDATED: 'UpdateNotification',
      NOTIFICATION_RESOLVED: 'NotificationResolved',
      NOTIFICATION_POSTPONED: 'NotificationPostponed',
      NOTIFICATION_SEEN: 'NotificationSeen',
      CONNECTION_ESTABLISHED: 'ConnectionEstablished',
      CONNECTION_LOST: 'ConnectionLost',
      CONNECTION_STATE_CHANGED: 'connection_state_changed'
    };

    this._handlers = new Map();

    if (typeof window !== 'undefined' && !window.notificationHub) {
      window.notificationHub = this;
    }
  }

  // ПЕРЕПИСЫВАЕМ функцию connect
  async connect() {
    if (this.isConnecting) return;
    if (this.connection?.state === 'Connected') return;

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

    try {
      const connectionUrl = `${window.location.origin}/api/notificationhub`;
      
      this.connection = new HubConnectionBuilder()
        .withUrl(connectionUrl, {
          accessTokenFactory: () => token,
          skipNegotiation: false,
          transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Экспоненциальная задержка: 2s, 4s, 8s, 16s, 32s
            const delay = Math.min(32000, Math.pow(2, retryContext.previousRetryCount) * 1000);
            return delay;
          }
        })
        .configureLogging({
          log: (logLevel, message) => {
            // Фильтруем логи - показываем только важные
            if (logLevel >= 2) { // Warning и выше
              console.log(`[SignalR ${logLevel}] ${message}`);
            }
          }
        })
        .build();

      // НАСТРАИВАЕМ ОБРАБОТЧИКИ СЕРВЕРНЫХ СОБЫТИЙ
      this._setupServerEventHandlers(userData.id);

      // ОБРАБОТЧИКИ СОБЫТИЙ ПОДКЛЮЧЕНИЯ
      this.connection.onclose((error) => {
        console.log('[SignalR] Соединение закрыто:', error?.message || 'Без ошибки');
        this.connection = null;
        this.isConnecting = false;
        
        this._emit(this.events.CONNECTION_STATE_CHANGED, {
          state: 'disconnected',
          error: error?.message,
          canRetry: true
        });

        // Планируем переподключение если нужно
        if (error && this.reconnectAttempts < this.maxReconnectAttempts) {
          this._scheduleReconnect();
        }
      });

      this.connection.onreconnecting((error) => {
        console.log('[SignalR] Переподключение...', error?.message);
        this._emit(this.events.CONNECTION_STATE_CHANGED, {
          state: 'reconnecting',
          error: error?.message
        });
      });

      this.connection.onreconnected((connectionId) => {
        console.log('[SignalR] Переподключение успешно:', connectionId);
        this.reconnectAttempts = 0;
        
        // После переподключения присоединяемся к группе пользователя
        this._joinUserGroup(userData.id);
        
        this._emit(this.events.CONNECTION_STATE_CHANGED, {
          state: 'connected',
          connectionId
        });
      });

      // УСТАНАВЛИВАЕМ СОЕДИНЕНИЕ
      await this.connection.start();
      
      console.log('[SignalR] Подключение установлено. Connection ID:', this.connection.connectionId);

      // ПРИСОЕДИНЯЕМСЯ К ГРУППЕ ПОЛЬЗОВАТЕЛЯ
      await this._joinUserGroup(userData.id);

      this.isConnecting = false;
      this.reconnectAttempts = 0;

      this._emit(this.events.CONNECTION_STATE_CHANGED, {
        state: 'connected',
        connectionId: this.connection.connectionId
      });

      // Эмитим событие об успешном подключении
      this._emit(this.events.CONNECTION_ESTABLISHED, {
        message: 'Подключение к уведомлениям установлено',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[SignalR] Ошибка подключения:', error);
      this.isConnecting = false;
      this.connection = null;

      this._emit(this.events.CONNECTION_STATE_CHANGED, {
        state: 'failed',
        error: error.message,
        canRetry: this.reconnectAttempts < this.maxReconnectAttempts
      });

      // Планируем переподключение
      this._scheduleReconnect();
    }
  }

  async _joinUserGroup(userId) {
      if (!this.connection || this.connection.state !== 'Connected') {
          return false;
      }

      try {
          // Проверяем существует ли метод на сервере
          await this.connection.invoke('JoinUserGroup', userId.toString());
          console.log(`[SignalR] Присоединен к группе пользователя ${userId}`);
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
    if (!this.connection) return;

    // УДАЛЯЕМ старую логику фильтрации по recipientUserId - бэкенд сам фильтрует

    // 1. ReceiveNotification - новое уведомление
    this.connection.on('ReceiveNotification', (notification) => {
      console.log('[SignalR] Получено новое уведомление:', notification.id);
      
      // ОБОГАЩАЕМ уведомление флагами isInformation/isInfluencing
      const enrichedNotification = {
        ...notification,
        isInformation: notification.type === 2, // System type
        isInfluencing: notification.type === 0, // OrderUpdateRequest type
        _eventType: 'receive',
        _timestamp: new Date().toISOString()
      };
      
      this._emit(this.events.NOTIFICATION_RECEIVED, enrichedNotification);
    });

    // 2. UpdateNotification - обновление существующего уведомления
    this.connection.on('UpdateNotification', (notification) => {
      console.log('[SignalR] Обновлено уведомление:', notification.id);
      
      // Для отложенных уведомлений - пропускаем если это действие другого пользователя
      // (фильтрация происходит на сервере, но проверяем на всякий случай)
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
      console.log('[SignalR] Обновлен счетчик уведомлений:', countData);
      
      // countData может быть числом или объектом
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
      console.log('[SignalR] Уведомление разрешено:', resolutionData.notificationId);
      
      // ОБОГАЩАЕМ данные резолюции
      const enrichedData = {
        ...resolutionData,
        _eventType: 'resolved',
        _timestamp: new Date().toISOString(),
        // Добавляем признак информационного/влияющего если нужно
        status: resolutionData.status // 1=Approved, 2=Rejected
      };
      
      this._emit(this.events.NOTIFICATION_RESOLVED, enrichedData);
    });

    // 5. NotificationPostponed - уведомление отложено
    this.connection.on('NotificationPostponed', (postponementData) => {
      console.log('[SignalR] Уведомление отложено:', postponementData.notificationId);
      
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
      console.log('[SignalR] Уведомление просмотрено:', seenData.notificationId);
      
      this._emit(this.events.NOTIFICATION_SEEN, {
        ...seenData,
        _timestamp: new Date().toISOString()
      });
    });

    // 7. ConnectionEstablished - подтверждение подключения от сервера
    this.connection.on('ConnectionEstablished', (message) => {
      console.log('[SignalR] Сервер подтвердил подключение:', message);
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
  }

  _scheduleReconnect() {
    this.reconnectAttempts++;
    
    // Экспоненциальная задержка с максимумом 30 секунд
    const baseDelay = this.reconnectDelay;
    const maxDelay = 30000;
    const delay = Math.min(maxDelay, baseDelay * Math.pow(1.5, this.reconnectAttempts - 1));
    
    console.log(`[SignalR] Планируем переподключение через ${delay}ms (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    const timeoutId = setTimeout(() => {
      const token = secureGetToken();
      if (token && this.reconnectAttempts <= this.maxReconnectAttempts) {
        console.log(`[SignalR] Выполняем переподключение (попытка ${this.reconnectAttempts})`);
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
        console.log('[SignalR] Соединение остановлено');
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