import { apiService } from '../api/api.js';
import { secureGetUserData, showTempMessage } from '../utils/utils.js';
import { SidebarManager } from '../core/sidebar-manager.js';
import { notificationHub } from './notification-hub.js';
import { enrichSignalRNotification, convertNotificationStatus, escapeHtml, getNotificationIcon, getNotificationTitle } from './notification-utils.js';
import { updateNotificationBadge, renderNotifications, updatePagination, highlightNotification, updateFilterCounts, updateEmptyStateText, updateFilterCountsFromState } from './notification-ui.js';
import { NotificationViewModal } from './notification-modal.js';
import { resolveNotification, postponeNotification, optimisticPostpone} from './notification-actions.js';
import { getState, setState, getNotificationStats, fetchNotificationStats} from './notification-state.js';
import { 
  NOTIFICATION_TYPES, 
  NOTIFICATION_STATUS, 
  isInformationType, 
  isInfluencingType 
} from './notification-types.js';
import { HeaderManager } from '../core/header-manager.js';

export class NotificationManager {
    constructor() {
        this.eventHandlers = new Map();
        this.isInitialized = false;
        this.currentUserId = null;
        this.viewModal = new NotificationViewModal(this);
        this.loadingNotifications = new Set();
         this.actionCache = new Map();
    }

    static async init() {
        const instance = NotificationManager.getInstance();
        
        if (instance.isInitialized) {
            const hubState = notificationHub.getState();
            if (!notificationHub.connection || hubState !== 'Connected') {
                await notificationHub.connect();
            }
            // УБРАЛИ: await instance.updateBadgeCount();
            return instance;
        }

        await HeaderManager.init?.();
        
        const userData = secureGetUserData();
        if (!userData?.id) {
            console.warn('NotificationManager: User not authenticated, skipping initialization');
            updateNotificationBadge(0);
            return instance;
        }

        instance.currentUserId = userData.id;
        
        try {
            await notificationHub.connect();
            
            if (notificationHub.connection && notificationHub.connection.state === 'Connected') {
                try {
                    await notificationHub.connection.invoke('JoinUserGroup', userData.id.toString());
                    console.log(`[NotificationManager] Присоединен к группе пользователя ${userData.id}`);
                } catch (groupError) {
                    if (!groupError.message.includes('Method does not exist')) {
                        console.error('[NotificationManager] Ошибка присоединения к группе:', groupError);
                    }
                }
            }
        } catch (error) {
            console.error('NotificationManager: SignalR connection failed:', error);
        }
        
        if (!instance._signalRHandlersSetup) {
            instance.setupSignalRHandlers();
            instance._signalRHandlersSetup = true;
        }
        
        // УБРАЛИ все вызовы updateBadgeCount()
        // Бейдж заполняется из InitialNotificationState
        
        instance.isInitialized = true;
        
        return instance;
    }

    setButtonsLoading(notificationId, isLoading) {
        if (isLoading) {
            this.loadingNotifications.add(notificationId);
        } else {
            this.loadingNotifications.delete(notificationId);
        }
        
        this.updateButtonsState(notificationId, isLoading);
    }

    async resolveNotification(notificationId, status, comment) {        
        try {
            if (this.viewModal && this.viewModal.currentNotificationId === notificationId) {
                this.viewModal.hide();
            }
            
            this.setButtonsLoading(notificationId, true);
            
            const state = getState();
            const updatedNotifications = state.notifications.filter(n => n.id !== notificationId);
            
            setState({
                notifications: updatedNotifications,
                totalCount: Math.max(0, state.totalCount - 1)
            });
            
            renderNotifications();
            updateFilterCounts();
            
            const result = await resolveNotification(notificationId, status, comment);

            return result;
            
        } catch (error) {
            console.error('[NotificationManager] Ошибка разрешения уведомления:', error);
            
            await this.loadNotifications();
            
            this.setButtonsLoading(notificationId, false);
            throw error;
        }
    }

    async postponeNotification(notificationId, minutes = 30, reason = '') {
        
        return postponeNotification(notificationId, minutes, reason);
    }

    updateButtonsState(notificationId, isLoading) {
        // В модалке
        const modalButtons = document.querySelectorAll(`#notificationDetailsModal [data-id="${notificationId}"]`);
        modalButtons.forEach(btn => {
            btn.disabled = isLoading;
            if (isLoading) {
                btn.classList.add('loading');
            } else {
                btn.classList.remove('loading');
            }
        });
        
        // В списке уведомлений
        const listButtons = document.querySelectorAll(`.notification-item[data-id="${notificationId}"] button`);
        listButtons.forEach(btn => {
            btn.disabled = isLoading;
        });
    }

    static getInstance() {
        if (!NotificationManager._instance) {
            NotificationManager._instance = new NotificationManager();
        }
        return NotificationManager._instance;
    }

    setupSignalRHandlers() {
        notificationHub.on(notificationHub.events.NOTIFICATION_RECEIVED, async (notification) => {
            await this.handleNewNotification(notification);
            // Счётчик обновится отдельно через UpdateNotificationCount или InitialState
        });

        notificationHub.on(notificationHub.events.NOTIFICATION_UPDATED, (notification) => {
            this.handleNotificationUpdated(notification);
        });

        notificationHub.on(notificationHub.events.NOTIFICATION_RESOLVED, (data) => {
            this.handleNotificationResolved(data);
        });

        notificationHub.on('NotificationPostponed', (data) => {
            this.handleNotificationPostponed(data);
        });

        // САМОЕ ВАЖНОЕ: счётчик обновляем ТОЛЬКО здесь
        notificationHub.on(notificationHub.events.NOTIFICATION_COUNT_UPDATED, (data) => {
            console.log('[NotificationManager] Получено обновление счётчика по SignalR:', data);
            
            const count = typeof data === 'object' ? data.count : data;
            updateNotificationBadge(count);
            
            // Если в data есть дополнительные флаги (hasActive, hasGrayIndicator) — используем их
            if (typeof data === 'object' && (data.hasActive || data.hasGrayIndicator)) {
                const stats = getNotificationStats();
                updateBadgeColor(stats);
            }
            
            // Можно обновить глобальное состояние
            setState({ /* unreadCount: count */ });
        });

        notificationHub.on(notificationHub.events.CONNECTION_STATE_CHANGED, (state) => {
            this.handleConnectionState(state);
            // Здесь можно реагировать на 'synced' если нужно
        });

        console.log('[NotificationManager] SignalR handlers настроены (без дублей и без лишних запросов)');
    }

    updateIndicators() {
        const stats = getNotificationStats();
        
        // Обновляем индикаторы в сайдбаре
        if (typeof updateSidebarIndicators === 'function') {
            updateSidebarIndicators(stats);
        }
        
        // ОБНОВЛЯЕМ ЦВЕТ БЕЙДЖА
        if (typeof updateBadgeColor === 'function') {
            updateBadgeColor();
        }
        
        // Эмитим событие для других компонентов
        this.emit('indicators_updated', stats);
    }

    processNotificationImmediately(notification, currentState) {
        // Для информационных уведомлений не загружаем детали
        
        // ПОКАЗЫВАЕМ БРАУЗЕРНОЕ УВЕДОМЛЕНИЕ
        if (Notification.permission === 'granted') {
            this.showBrowserNotification(notification);
        }
        
        // ДОБАВЛЯЕМ В СОСТОЯНИЕ
        const newNotifications = [notification, ...currentState.notifications];
        
        setState({
            notifications: newNotifications,
            totalCount: currentState.totalCount + 1
        });

        if (typeof renderNotifications === 'function') {
            renderNotifications();
        }
        
        // ОБНОВЛЯЕМ СЧЕТЧИКИ ИЗ ЛОКАЛЬНОГО STATE
        this.updateFilterCountsFromState();
        
        // ОБНОВЛЯЕМ UI
        if (typeof renderNotifications === 'function') {
            renderNotifications();
        }
        
        // ОБНОВЛЯЕМ ИНДИКАТОРЫ
        this.updateIndicators();
    }

    // Поиск кэшированного действия
    findCachedAction(notificationId, actionType) {
        if (!this.actionCache) return null;
        
        const entries = Array.from(this.actionCache.entries());
        for (const [key, value] of entries) {
            if (value.notificationId === notificationId && 
                value.action === actionType &&
                Date.now() - value.timestamp < 30000) { // 30 секунд
                return { key, ...value };
            }
        }
        return null;
    }

    // Очистка кэшированного действия
    clearCachedAction(key) {
        if (this.actionCache && this.actionCache.has(key)) {
            this.actionCache.delete(key);
        }
    }

    handleNotificationUpdated(updatedNotification) {
        // ОБОГАЩАЕМ флагами
        const enriched = {
            ...updatedNotification,
            isInformation: updatedNotification.type === NOTIFICATION_TYPES.SYSTEM,
            isInfluencing: updatedNotification.type === NOTIFICATION_TYPES.ORDER_UPDATE_REQUEST,
            userId: this.currentUserId
        };

        // ПРОВЕРЯЕМ: игнорируем события не для текущего пользователя
        if (enriched.recipientUserId && enriched.recipientUserId !== this.currentUserId) {
            return;
        }

        // ИГНОРИРУЕМ UpdateNotification со статусом Postponed (3) - они обрабатываются отдельно
        if (enriched.status === NOTIFICATION_STATUS.POSTPONED) {
            return;
        }

        const currentState = getState();
        const index = currentState.notifications.findIndex(n => n.id === enriched.id);

        if (index !== -1) {
            // ОБНОВЛЯЕМ существующее уведомление
            const newNotifications = [...currentState.notifications];
            const existing = newNotifications[index];
            
            // Сохраняем важные данные
            newNotifications[index] = {
                ...existing,
                ...enriched,
                // Сохраняем детали если они были
                data: enriched.data || existing.data,
                proposedChanges: enriched.proposedChanges || existing.proposedChanges
            };

            setState({ notifications: newNotifications });
            
            // Перерисовываем элемент
            this.rerenderNotificationItem(enriched.id);
            
        } else if (enriched.status === NOTIFICATION_STATUS.PENDING) {
            // ДОБАВЛЯЕМ новое уведомление (только если статус Pending)
            const newNotifications = [enriched, ...currentState.notifications];
            
            setState({
                notifications: newNotifications,
                totalCount: currentState.totalCount + 1
            });

            // Рендерим и подсвечиваем
            if (typeof renderNotifications === 'function') {
                renderNotifications();
            }
            highlightNotification(enriched.id);
        }

        // ОБНОВЛЯЕМ ИНДИКАТОРЫ
        this.updateIndicators();
    }

    async fetchNotificationDetails(notificationId) {
        
        try {
            // Проверяем, есть ли уже кэшированные детали
            if (this._notificationDetailsCache && this._notificationDetailsCache[notificationId]) {
                return this._notificationDetailsCache[notificationId];
            }
            
            // Используем существующий API метод для получения уведомлений
            // Фильтруем по ID, чтобы получить конкретное уведомление
            const response = await apiService.getNotifications({
                page: 1,
                pageSize: 1,
                // Если API поддерживает фильтрацию по ID
                id: notificationId,
                // Или загружаем все и фильтруем на клиенте
                status: 'all'
            });
            
            // Ищем нужное уведомление в ответе
            let fullNotification = {};
            
            if (response.items && Array.isArray(response.items)) {
                // Вариант 1: Ищем по ID в массиве
                const foundNotification = response.items.find(item => item.id === notificationId);
                
                if (foundNotification) {                    
                    fullNotification = {
                        data: foundNotification.data || {},
                        comment: foundNotification.comment || foundNotification.data?.comment || '',
                        proposedChanges: foundNotification.data?.proposedChanges || foundNotification.proposedChanges || {}
                    };
                } else {
                    console.warn('[NotificationManager] Уведомление не найдено в ответе API:', notificationId);
                }
            } else if (response.data) {
                fullNotification = {
                    data: response.data || {},
                    comment: response.comment || response.data?.comment || '',
                    proposedChanges: response.data?.proposedChanges || response.proposedChanges || {}
                };
            }
            
            // Кэшируем результат
            if (!this._notificationDetailsCache) {
                this._notificationDetailsCache = {};
            }
            this._notificationDetailsCache[notificationId] = fullNotification;
            
            return fullNotification;
            
        } catch (error) {
            console.error('[NotificationManager] Ошибка загрузки деталей уведомления:', {
                notificationId,
                error: error.message
            });
            
            // Возвращаем пустые детали, чтобы не сломать UI
            return {
                data: {},
                comment: '',
                proposedChanges: {}
            };
        }
    }

    handleOptimisticPostpone(notificationId) {
        
        try {
            // Удаляем сразу из UI
            optimisticPostpone(notificationId);
            
            // Отправляем запрос на сервер в фоне (не ждем ответа)
            this.postponeNotification(notificationId, 30, 'Отложено пользователем')
                .then(() => {
                })
                .catch(error => {
                    console.error('[NotificationManager] Ошибка фоновой синхронизации:', error);
                    // UI уже обновлен, ошибку видим только в консоли
                });
            
            return true;
        } catch (error) {
            console.error('[NotificationManager] Ошибка в optimistic postpone:', error);
            return false;
        }
    }

    handleNotificationPostponed(postponementData) {
        console.log('[NotificationManager] Обработка откладывания уведомления:', postponementData.notificationId);
        
        const current = getState().notifications || [];
        const updated = current.map(n => {
            if (n.id === postponementData.notificationId) {
                return {
                    ...n,
                    status: NOTIFICATION_STATUS.POSTPONED,
                    returnsAt: postponementData.returnsAt,
                    minutesUntilReturn: postponementData.minutes || 0,
                    _eventType: 'postponed',
                    _timestamp: new Date().toISOString()
                };
            }
            return n;
        });
        
        setState({ notifications: updated });
        renderNotifications?.();
        updateFilterCounts?.();
        this.updateIndicators?.();
        
        console.log('[NotificationManager] Уведомление обновлено после откладывания');
    }

    async handleNewNotification(notificationData) {
        console.log('[NotificationManager] Обработка нового уведомления по SignalR:', notificationData.id);

        // 1. Обогащаем базовыми флагами и метаданными
        const enriched = {
            ...notificationData,
            isInformation: notificationData.type === NOTIFICATION_TYPES.SYSTEM,
            isInfluencing: notificationData.type === NOTIFICATION_TYPES.ORDER_UPDATE_REQUEST,
            userId: this.currentUserId,
            status: notificationData.status || 0,
            statusCode: notificationData.status || 0,
            _timestamp: new Date().toISOString(),
            _eventType: 'receive'
        };

        // 2. Получаем текущее состояние ОДИН РАЗ
        const currentState = getState();
        const currentNotifications = currentState.notifications || [];

        // 3. Проверяем, есть ли уже такое уведомление
        const existingIndex = currentNotifications.findIndex(n => n.id === enriched.id);
        let updatedNotifications = [...currentNotifications];

        if (existingIndex !== -1) {
            console.log('[NotificationManager] Обновляем существующее уведомление:', enriched.id);
            updatedNotifications[existingIndex] = {
                ...updatedNotifications[existingIndex],
                ...enriched
            };
        } else {
            console.log('[NotificationManager] Добавляем новое уведомление:', enriched.id);
            updatedNotifications = [enriched, ...currentNotifications];
        }

        // 4. Мгновенно обновляем состояние → UI сразу увидит уведомление
        setState({ notifications: updatedNotifications });
        renderNotifications?.();
        updateFilterCounts?.();
        this.updateIndicators?.();

        // 5. Вызываем твою текущую логику (информационные / браузерные уведомления)
        if (enriched.isInformation) {
            this.handleSignalREvent?.('receive', enriched);
            
            if (Notification.permission === 'granted') {
                this.showBrowserNotification?.(enriched);
            }
        } else {
            // Для влияющих — запускаем подгрузку деталей
            await this.handleNotificationWithDetails?.(enriched, currentState);
        }

        // 6. Асинхронно подгружаем ПОЛНЫЕ данные по API (самое важное для деталей изменений)
        try {
            // Запрашиваем свежие pending уведомления (их мало, запрос быстрый)
            const recentResponse = await apiService.getNotifications({ 
                status: 'pending', 
                page: 1, 
                pageSize: 5,  // берём последние 5 — хватит с запасом
                userId: this.currentUserId
            });

            if (recentResponse?.items?.length > 0) {
                // Ищем наше уведомление по id
                const fullNotification = recentResponse.items.find(item => item.id === enriched.id);
                
                if (fullNotification) {
                    const fullyEnriched = {
                        ...enriched,
                        data: fullNotification.data || enriched.data,
                        proposedChanges: fullNotification.proposedChanges || enriched.proposedChanges || {},
                        // Добавь сюда ВСЕ нужные поля из полного DTO
                        // Например:
                        // photos: fullNotification.photos,
                        // comment: fullNotification.comment,
                        // orderDetails: fullNotification.orderDetails,
                        // initiator: fullNotification.initiator,
                    };

                    // Финальное обновление
                    const finalUpdated = updatedNotifications.map(n => 
                        n.id === enriched.id ? fullyEnriched : n
                    );

                    setState({ notifications: finalUpdated });
                    renderNotifications?.();
                    console.log('[NotificationManager] Полные детали подгружены для уведомления', enriched.id);
                }
            }
        } catch (err) {
            console.warn('[NotificationManager] Не удалось подгрузить детали (fallback):', err);
            // Ничего страшного — базовая версия уже показана
        }

        console.log('[NotificationManager] Состояние обновлено. Всего уведомлений:', updatedNotifications.length);
    }

    /**
    * Универсальный метод обновления UI после SignalR события
    * @param {string} action - 'receive', 'update', 'postpone', 'resolve'
    * @param {object} notification - данные уведомления
    */
    handleSignalREvent(action, notification) {
        const state = getState();
        let shouldRerender = false;
        
        switch(action) {
            case 'receive':
                // Добавить новое уведомление в начало
                const newNotifications = [notification, ...state.notifications];
                setState({
                    notifications: newNotifications,
                    totalCount: state.totalCount + 1
                });
                shouldRerender = true;
                break;
                
            case 'postpone':
                // Обновить статус существующего уведомления
                const postponedIndex = state.notifications.findIndex(n => n.id === notification.id);
                if (postponedIndex !== -1) {
                    const updatedNotifications = [...state.notifications];
                    updatedNotifications[postponedIndex] = {
                        ...updatedNotifications[postponedIndex],
                        status: NOTIFICATION_STATUS.POSTPONED,
                        statusCode: NOTIFICATION_STATUS.POSTPONED,
                        returnsAt: notification.returnsAt
                    };
                    setState({ notifications: updatedNotifications });
                    shouldRerender = true;
                }
                break;
                
            case 'resolve':
                // Обновить статус на APPROVED/REJECTED
                const resolvedIndex = state.notifications.findIndex(n => n.id === notification.id);
                if (resolvedIndex !== -1) {
                    const updatedNotifications = [...state.notifications];
                    updatedNotifications[resolvedIndex] = {
                        ...updatedNotifications[resolvedIndex],
                        status: notification.status,
                        statusCode: notification.status,
                        resolvedAt: notification.resolvedAt
                    };
                    setState({ notifications: updatedNotifications });
                    shouldRerender = true;
                }
                break;
        }
        
        // ЕСЛИ НУЖНО ПЕРЕРИСОВАТЬ - делаем полный ререндер
        if (shouldRerender && typeof renderNotifications === 'function') {
            renderNotifications();
            updateFilterCountsFromState();
            this.updateIndicators();
        }
    }

    async handleNotificationWithDetails(notification, currentState) {
        try {
            // Дозапрашиваем детали
            const notificationDetails = await this.fetchNotificationDetails(notification.id);
            
            
            const fullNotification = {
                // Базовые поля из SignalR
                ...notification,
                
                // Данные в формате, который ожидает модальное окно
                data: {
                    comment: notificationDetails.comment || '',
                    proposedChanges: notificationDetails.proposedChanges || {},
                    ...notificationDetails.data
                },
                
                // Поля на верхнем уровне для обратной совместимости
                comment: notificationDetails.comment || '',
                proposedChanges: notificationDetails.proposedChanges || {},
                
                // Обязательные системные поля
                userId: this.currentUserId,
                createdAt: notification.createdAt || new Date().toISOString(),
                status: 'pending',
                statusCode: 0
            };
            
            // Показываем браузерное уведомление
            if (Notification.permission === 'granted') {
                this.showBrowserNotification(fullNotification);
            }

            // Сохраняем в состояние
            const newNotifications = [fullNotification, ...currentState.notifications];

            setState({
                notifications: newNotifications,
                totalCount: currentState.totalCount + 1
            });

            // Обновляем UI
            renderNotifications();
            
        } catch (detailsError) {
            console.error('[NotificationManager] Ошибка при получении деталей уведомления:', {
                notificationId: notification.id,
                error: detailsError.message
            });
            
            // Fallback: сохраняем базовое уведомление
            if (Notification.permission === 'granted') {
                this.showBrowserNotification(notification);
            }

            const enrichedNotification = enrichSignalRNotification(notification, this.currentUserId);
            const newNotifications = [enrichedNotification, ...currentState.notifications];

            setState({
                notifications: newNotifications,
                totalCount: currentState.totalCount + 1
            });

            renderNotifications();
        }
    }

    rerenderNotificationItem(notificationId) {
        const listContainer = document.getElementById('notificationsList');
        if (!listContainer) return;
        
        const item = listContainer.querySelector(`[data-id="${notificationId}"]`);
        if (!item) return;
        
        const state = getState();
        const notification = state.notifications.find(n => n.id === notificationId);
        if (!notification) return;
        
        // Обновляем статус
        const statusBadge = item.querySelector('.notification-status');
        if (!statusBadge) {
            // Если нет элемента статуса, создаем
            const contentDiv = item.querySelector('.notification-content');
            if (contentDiv) {
                const newStatusBadge = document.createElement('span');
                newStatusBadge.className = `notification-status status-${notification.status}`;
                newStatusBadge.textContent = notification.status === 'approved' ? 'Принято' :
                                        notification.status === 'rejected' ? 'Отклонено' :
                                        notification.status === 'postponed' ? 'Отложено' : 'В ожидании';
                contentDiv.appendChild(newStatusBadge);
            }
        } else {
            statusBadge.textContent = notification.status === 'approved' ? 'Принято' :
                                    notification.status === 'rejected' ? 'Отклонено' :
                                    notification.status === 'postponed' ? 'Отложено' : 'В ожидании';
            statusBadge.className = `notification-status status-${notification.status}`;
        }
        
        // Обновляем кнопки действий
        const actionsContainer = item.querySelector('.notification-actions');
        if (actionsContainer) {
            if (notification.status === 'pending') {
                actionsContainer.innerHTML = `
                    <button class="btn-view" data-action="view" data-id="${notification.id}">Просмотр</button>
                    <button class="btn-postpone" data-action="postpone" data-id="${notification.id}">Отложить</button>
                `;
            } else if (notification.status === 'postponed') {
                actionsContainer.innerHTML = `
                    <button class="btn-view" data-action="view" data-id="${notification.id}">Просмотр</button>
                    <span class="postponed-label">Отложено</span>
                `;
            } else {
                // Approved или Rejected - убираем кнопки
                actionsContainer.innerHTML = `
                    <span class="resolved-label">
                        ${notification.status === 'approved' ? '✓ Принято' : '✗ Отклонено'}
                    </span>
                `;
            }
        }
    }

    shouldShowInCurrentFilter(notification) {
        const state = getState();
        
        switch(state.currentFilter) {
            case 'active':
                // Активные влияющие уведомления (для красного индикатора)
                return notification.isInfluencing && 
                    notification.status === NOTIFICATION_STATUS.PENDING;
                
            case 'postponed':
                // Все отложенные уведомления
                return notification.status === NOTIFICATION_STATUS.POSTPONED;
                
            case 'information':
                // Все информационные уведомления
                return notification.isInformation;
                
            case 'history':
                // Принятые и отклоненные
                return notification.status === NOTIFICATION_STATUS.APPROVED || 
                    notification.status === NOTIFICATION_STATUS.REJECTED;
                
            default:
                return true;
        }
    }

    handleNotificationResolved(resolutionData) {
        console.log('[NotificationManager] Обработка разрешения уведомления:', resolutionData.notificationId);
        
        const current = getState().notifications || [];
        const updated = current.map(n => {
            if (n.id === resolutionData.notificationId) {
                return {
                    ...n,
                    status: resolutionData.status,
                    resolvedAt: resolutionData.resolvedAt,
                    resolutionNote: resolutionData.note || n.resolutionNote,
                    _eventType: 'resolved',
                    _timestamp: new Date().toISOString()
                };
            }
            return n;
        });
        
        setState({ notifications: updated });
        renderNotifications?.();
        updateFilterCounts?.();
        this.updateIndicators?.();
        
        console.log('[NotificationManager] Уведомление обновлено после разрешения');
    }

    // Вспомогательный метод для обновления статуса без toast
    updateNotificationStatusOnly(notificationId, data) {
        const state = getState();
        const index = state.notifications.findIndex(n => n.id === notificationId);
        
        if (index !== -1) {
            const newNotifications = [...state.notifications];
            const oldNotification = newNotifications[index];
            
            newNotifications[index] = {
                ...oldNotification,
                status: data.status === 1 ? 'approved' : 'rejected',
                statusCode: data.status,
                resolvedAt: data.resolvedAt || new Date().toISOString(),
                resolutionNote: data.note || '',
                resolvedBy: data.resolvedBy || ''
            };
            
            setState({
                notifications: newNotifications,
                totalCount: state.totalCount
            });
            
            this.rerenderNotificationItem(notificationId);
            updateFilterCounts();
            this.updateBadgeCount();
            
        } else {
            console.warn('[DEBUG] Уведомление не найдено для обновления:', notificationId);
        }
    }


    handleConnectionState(state) {
        this.emit('connection_state_changed', state);
    }

    async updateBadgeCount(force = false) {
        // force = true — только когда пользователь явно нажал "Обновить" или открыл страницу уведомлений
        if (!force) {
            console.log('[NotificationManager] Автоматический updateBadgeCount заблокирован — используем SignalR');
            return 0;
        }

        console.log('[NotificationManager] Ручное обновление бейджа по API (force = true)');
        
        try {
            const userData = secureGetUserData();
            
            if (!userData?.id) {
                updateNotificationBadge(0);
                return 0;
            }
            
            this.currentUserId = userData.id;
            
            const [activeRes, postponedRes] = await Promise.all([
                apiService.getNotifications({ 
                    status: 'pending', 
                    page: 1, 
                    pageSize: 1,
                    userId: userData.id 
                }).catch(() => ({ totalCount: 0 })),
                
                apiService.getNotifications({ 
                    status: 'postponed', 
                    page: 1, 
                    pageSize: 1,
                    userId: userData.id 
                }).catch(() => ({ totalCount: 0 }))
            ]);
            
            const activeCount = activeRes.totalCount || 0;
            const postponedCount = postponedRes.totalCount || 0;
            const totalCount = activeCount + postponedCount;
            
            updateNotificationBadge(totalCount);
            
            return totalCount;
            
        } catch (error) {
            console.error('[NotificationManager] Ошибка ручного обновления бейджа:', error);
            updateNotificationBadge(0); // fallback
            return 0;
        }
    }

    registerGlobalSubscriber(callback) {
        // Эмитим текущее состояние новому подписчику
        const stats = getNotificationStats();
        callback({
            totalCount: stats.totalCount,
            hasActive: stats.hasActiveNotifications
        });
        
        // Возвращаем функцию отписки
        return this.on('notification_state_updated', callback);
    }

    async getNotifications(options = {}) {
        try {
            return await apiService.getNotifications(options);
        } catch (error) {
            console.error('NotificationManager: Error fetching notifications:', error);
            throw error;
        }
    }

    async checkBlockingNotifications(orderId) {
        return checkBlockingNotifications(orderId);
    }

    showBrowserNotification(notification) {
        if (!('Notification' in window)) return;
        
        let title = 'Новое уведомление';
        let body = '';
        
        if (notification.type === NOTIFICATION_TYPES.CHANGE_REQUEST) {
            title = 'Запрос на изменение заказа';
            body = `Заказ #${notification.orderNumber}: ${notification.message || 'Требуется подтверждение изменений'}`;
        } else if (notification.type === NOTIFICATION_TYPES.CONFIRMATION) {
            title = 'Подтверждение выполнения';
            body = `Заказ #${notification.orderNumber}: ${notification.message || 'Требуется подтверждение выполнения'}`;
        }
        
        new Notification(title, {
            body: body,
            icon: '/favicon.ico',
            tag: `notification-${notification.id}`
        });
    }

    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
        
        return () => this.off(event, handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`NotificationManager: Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    setupEventListeners() {
        const filterActive   = document.getElementById('filterActive');
        const filterPostponed = document.getElementById('filterPostponed');
        const filterHistory   = document.getElementById('filterHistory');

        if (filterActive) {
            filterActive.addEventListener('click', () => this.changeFilter('active'));
        }
        if (filterPostponed) {
            filterPostponed.addEventListener('click', () => this.changeFilter('postponed'));
        }
        if (filterHistory) {
            filterHistory.addEventListener('click', () => this.changeFilter('history'));
        }
        
        document.getElementById('prevPage')?.addEventListener('click', () => {
            const state = getState();
            if (state.currentPage > 1) {
                updateState('currentPage', state.currentPage - 1);
                this.loadNotifications();
            }
        });
        
        document.getElementById('nextPage')?.addEventListener('click', () => {
            const state = getState();
            if (state.currentPage < state.totalPages) {
                updateState('currentPage', state.currentPage + 1);
                this.loadNotifications();
            }
        });
        
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadNotifications());
        }
        
        document.addEventListener('click', async (e) => {
            const actionBtn = e.target.closest('.btn-view, .btn-postpone');
            if (!actionBtn) return;

            e.preventDefault();
            e.stopPropagation();

            const action = actionBtn.classList.contains('btn-view') ? 'view' : 'postpone';
            const notificationId = parseInt(actionBtn.dataset.id);

            if (!notificationId) {
                console.warn('Нет ID уведомления в кнопке');
                return;
            }

            if (action === 'view') {
                // Открываем модальное окно просмотра
                const state = getState();
                const notification = state.notifications.find(n => n.id === notificationId);
                if (notification) {
                    this.viewModal.show(notification);  // предполагается, что NotificationViewModal имеет метод show()
                } else {
                    console.warn(`Уведомление ${notificationId} не найдено в текущем состоянии`);
                }
            } else if (action === 'postpone') {
                // ОПТИМИСТИЧНОЕ откладывание
                try {
                    // Сразу удаляем из UI
                    this.handleOptimisticPostpone(notificationId);
                    
                    // Отправляем запрос в фоне
                    postponeNotification(notificationId, 30, 'Отложено через кнопку')
                        .catch(err => {
                            console.error('Фоновая ошибка откладывания:', err);
                            // UI уже обновлен, ошибка только в логах
                        });
                } catch (err) {
                    console.error('Ошибка в обработчике кнопки:', err);
                }
            }
        });
    }

    async changeFilter(newFilter) {
        const state = getState();
        if (state.currentFilter === newFilter) return;

        // 1. Обновляем состояние
        setState({
            currentFilter: newFilter,
            currentPage: 1
        });

        // 2. СРАЗУ обновляем активный класс кнопок
        document.querySelectorAll('.filters .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-filter="${newFilter}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // 3. ОБНОВЛЯЕМ UI БЕЗ ЗАПРОСА К API
        // Уведомления уже есть в состоянии, просто фильтруем их
        if (typeof renderNotifications === 'function') {
            renderNotifications();
        }
        
        // 4. Обновляем счетчики фильтров из состояния
        if (typeof updateFilterCountsFromState === 'function') {
            updateFilterCountsFromState();
        }
        
        // 5. Обновляем индикаторы
        this.updateIndicators();

        // 6. ТОЛЬКО ПОСЛЕ ВСЕГО ЭТОГО делаем API запрос для синхронизации
        // Это в фоне, пользователь уже видит актуальный UI
        await this.loadNotifications();
    }

    setupSignalRSubscriptions() {        
        this.on('notification_resolved', (data) => {
            this.handleNotificationResolved(data);
        });
        
        if (window.notificationHub) {
            window.notificationHub.on('NotificationResolved', (data) => {
                this.handleNotificationResolved(data);
            });
            
            window.notificationHub.on('UpdateNotificationCount', (count) => {
                updateNotificationBadge(count);
            });
        }
    }

    async loadNotifications() {
        const loadingContainer = document.getElementById('loadingContainer');
        const listContainer = document.getElementById('notificationsList');
        const noNotifications = document.getElementById('noNotifications');
        
        if (!loadingContainer || !listContainer) {
            console.error('DOM элементы не найдены');
            return;
        }
        
        loadingContainer.style.display = 'flex';
        listContainer.innerHTML = '';
        if (noNotifications) noNotifications.style.display = 'none';
        
        try {
            const state = getState();
            
            console.log('[DEBUG] loadNotifications start:', {
                currentFilter: state.currentFilter,
                currentPage: state.currentPage,
                currentUserId: this.currentUserId
            });
            
            const apiParams = this.convertFilterToApiParams(state.currentFilter);
            apiParams.userId = this.currentUserId;
            
            console.log('[DEBUG] API params:', apiParams);
            
            const response = await apiService.getNotifications(apiParams);
            
            console.log('[DEBUG] API response:', {
                totalCount: response.totalCount,
                itemsCount: response.items?.length || 0,
                items: response.items?.map(i => ({ id: i.id, type: i.type, status: i.status, title: i.title }))
            });
            
            const enrichedNotifications = (response.items || []).map(item => ({
                ...item,
                isInformation: item.type === 2,
                isInfluencing: item.type === 0,
                userId: this.currentUserId,
                status: item.status,
                statusCode: item.status
            }));
            
            console.log('[DEBUG] Enriched notifications:', enrichedNotifications);
            
            setState({
                notifications: enrichedNotifications,
                totalCount: response.totalCount || 0,
                totalPages: response.totalPages || 1
            });
            
            console.log('[DEBUG] State after setState:', {
                notificationsCount: getState().notifications.length,
                notifications: getState().notifications.map(n => ({ 
                    id: n.id, status: n.status, type: n.type, title: n.title 
                }))
            });
            
            renderNotifications?.();
            updatePagination?.();
            
            loadingContainer.style.display = 'none';
            
            if (enrichedNotifications.length === 0 && noNotifications) {
                noNotifications.style.display = 'block';
                updateEmptyStateText?.(noNotifications);
            }
            
            // УБРАЛИ: updateFilterCounts() и updateBadgeCount()
            // Счётчик теперь только из SignalR
            
            this.updateIndicators?.();
            
        } catch (error) {
            console.error('Ошибка загрузки уведомлений:', error);
            loadingContainer.style.display = 'none';
            
            showTempMessage(`Ошибка загрузки: ${error.message}`, 'error');
            
            if (listContainer) {
                listContainer.innerHTML = `
                    <div class="error-state">
                        <h3>Ошибка загрузки</h3>
                        <p>${error.message || 'Неизвестная ошибка'}</p>
                        <button id="retryLoadBtn" class="btn btn-outline">
                            Попробовать снова
                        </button>
                    </div>
                `;
                
                document.getElementById('retryLoadBtn')?.addEventListener('click', () => {
                    this.loadNotifications();
                });
            }
        }
    }

    convertFilterToApiParams(filter) {
        const params = {
            page: getState().currentPage,
            pageSize: getState().pageSize
        };
        
        let apiParams;
        
        switch(filter) {
            case 'active':
                apiParams = { ...params, status: 'pending' };
                break;
                
            case 'postponed':
                apiParams = { ...params, status: 'postponed' };
                break;
                
            case 'history':
                // Для истории загружаем ВСЕ, фильтрацию делаем на клиенте
                apiParams = { ...params, status: 'all' };
                break;
                
            default:
                apiParams = { ...params, status: 'pending' };
        }
        
        console.log('[DEBUG] convertFilterToApiParams:', { filter, apiParams });
        return apiParams;
    }

    async syncBadgeOnInit() {
        console.log('[NotificationManager] Лёгкая синхронизация бейджа при старте');

        try {
            const userData = secureGetUserData();
            if (!userData?.id) {
                updateNotificationBadge(0);
                return;
            }

            // Запросы с pageSize=1 — очень быстро, только для счётчиков и типа
            const [pendingRes, postponedRes] = await Promise.all([
                apiService.getNotifications({ 
                    status: 'pending', 
                    page: 1, 
                    pageSize: 1,
                    userId: userData.id 
                }).catch(() => ({ totalCount: 0, items: [] })),

                apiService.getNotifications({ 
                    status: 'postponed', 
                    page: 1, 
                    pageSize: 1,
                    userId: userData.id 
                }).catch(() => ({ totalCount: 0, items: [] }))
            ]);

            const pendingCount = pendingRes.totalCount || 0;
            const postponedCount = postponedRes.totalCount || 0;
            const total = pendingCount + postponedCount;

            // Считаем флаги цвета — ТОЧНО как в getNotificationStats
            const hasActive = pendingRes.items?.some(item => 
                item.isInfluencing || item.type === 0  // OrderUpdateRequest
            ) || false;

            const hasGray = !hasActive && (pendingCount > 0 || postponedCount > 0);

            // Сохраняем в состояние (чтобы updateBadgeColor видел актуальные флаги)
            setState({
                unreadCount: total,
                hasActiveNotifications: hasActive,
                hasGrayIndicator: hasGray,
                // можно ещё totalPending: pendingCount, totalPostponed: postponedCount
            });

            updateNotificationBadge(total);
            updateBadgeColor();

            console.log('[NotificationManager] Бейдж синхронизирован при старте:', {
                count: total,
                red: hasActive,
                gray: hasGray
            });

        } catch (err) {
            console.warn('[NotificationManager] Ошибка синхронизации бейджа при старте:', err);
            updateNotificationBadge(0);
        }
    }
}


if (typeof window !== 'undefined') {
    window.NotificationManager = NotificationManager;
}

// if (typeof window !== 'undefined') {
//     window.addEventListener('load', () => {
//         setTimeout(async () => {
//             const userData = secureGetUserData();
//             if (userData?.id && !window.location.pathname.includes('login.html')) {
//                 try {
//                     await NotificationManager.init();
//                 } catch (error) {
//                     console.error('NotificationManager: Auto-initialization failed:', error);
//                 }
//             }
//         }, 2000);
//     });
// }