// notification/notification-state.js
import { apiService } from '../api/api.js';
import { secureGetUserData } from '../utils/utils.js';
import { 
  NOTIFICATION_STATUS, 
  isActiveInfluencing, 
  isPendingInformation, 
  isPostponed 
} from './notification-types.js';
import { isNotificationBlocking } from './notification-utils.js';

// Исходное состояние
const state = {
    notifications: [],          // Массив обогащенных уведомлений
    currentFilter: 'active',    // 'active', 'postponed', 'history', 'information'
    currentPage: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
    currentUserId: secureGetUserData()?.id || null,
    
    // Кэшированные вычисления (обновляются при изменении notifications)
    _computed: {
        hasRedIndicator: false,    // Есть ли влияющие Pending
        hasGrayIndicator: false,   // Нет красных, но есть инфо Pending или Postponed
        hasBlocking: false,        // Есть ли блокирующие уведомления
        counts: {
            total: 0,
            activeInfluencing: 0,  // Для красного индикатора
            pendingInformation: 0, // Для серого индикатора (инфо)
            postponed: 0,          // Для серого индикатора (отложенные)
            information: 0,        // Все информационные
            influencing: 0         // Все влияющие
        }
    }
};

// Геттеры
export function getState() { 
    return state; 
}

// Сеттеры
export function setState(newState) {
    const oldNotifications = state.notifications;
    
    // Обновляем состояние
    Object.assign(state, newState);
    
    // Если изменились уведомления или currentUserId - пересчитываем кэш
    if (newState.notifications !== undefined || newState.currentUserId !== undefined) {
        state.notifications = state.notifications.map(notification => ({
            ...notification,
            userId: notification.userId || state.currentUserId
        }));
        
        // Пересчитываем вычисляемые поля
        recalcComputed();
    }
}

// Устанавливаем ID текущего пользователя
export function setCurrentUserId(userId) {
    if (state.currentUserId !== userId) {
        state.currentUserId = userId;
        recalcComputed();
    }
}

// Пересчет вычисляемых полей
function recalcComputed() {
    const notifications = state.notifications;
    const now = new Date();
    
    // Счетчики
    let activeInfluencing = 0;  // Для красного индикатора
    let pendingInformation = 0; // Информационные Pending
    let postponed = 0;          // Все Postponed
    let information = 0;        // Все информационные
    let influencing = 0;        // Все влияющие
    let hasBlocking = false;    // Есть ли блокирующие
    
    notifications.forEach(notification => {
        // Классификация по типам
        if (notification.isInformation) {
            information++;
            if (notification.status === NOTIFICATION_STATUS.PENDING) {
                pendingInformation++;
            }
        } else if (notification.isInfluencing) {
            influencing++;
            if (notification.status === NOTIFICATION_STATUS.PENDING) {
                activeInfluencing++;
            }
        }
        
        // Отложенные
        if (notification.status === NOTIFICATION_STATUS.POSTPONED) {
            postponed++;
        }
        
        // Блокирующие
        if (isNotificationBlocking(notification)) {
            hasBlocking = true;
        }
    });
    
    // Обновляем кэш
    state._computed = {
        hasRedIndicator: activeInfluencing > 0,
        hasGrayIndicator: activeInfluencing === 0 && (pendingInformation > 0 || postponed > 0),
        hasBlocking,
        counts: {
            total: notifications.length,
            activeInfluencing,
            pendingInformation,
            postponed,
            information,
            influencing
        }
    };
}

// Селекторы для UI

/**
 * Получает статистику для индикаторов
 */
export function getNotificationStats() {
    return {
        totalCount: state._computed.counts.total,
        activeCount: state._computed.counts.activeInfluencing,
        hasActiveNotifications: state._computed.hasRedIndicator,
        hasGrayIndicator: state._computed.hasGrayIndicator,
        hasBlocking: state._computed.hasBlocking,
        counts: { ...state._computed.counts }
    };
}

/**
 * Проверяет, есть ли красный индикатор
 */
export function hasRedIndicator() {
    return state._computed.hasRedIndicator;
}

/**
 * Проверяет, есть ли серый индикатор
 */
export function hasGrayIndicator() {
    return state._computed.hasGrayIndicator;
}

/**
 * Проверяет, есть ли блокирующие уведомления
 */
export function hasBlockingNotifications() {
    return state._computed.hasBlocking;
}

/**
 * Получает уведомления для текущего фильтра
 */
export function getFilteredNotifications() {
    const filter = state.currentFilter;
    
    return state.notifications.filter(notification => {
        // ВАЖНО: проверяем что уведомление принадлежит текущему пользователю
        if (notification.userId && state.currentUserId && notification.userId !== state.currentUserId) {
            return false;
        }
        
        switch(filter) {
            case 'active':
                // Только Pending (активные) - НЕ отложенные
                return notification.status === NOTIFICATION_STATUS.PENDING;
            
            case 'postponed':
                // Только Postponed (отложенные)
                return notification.status === NOTIFICATION_STATUS.POSTPONED;
            
            case 'history':
                // ВСЕ уведомления без фильтрации
                return true;
            
            default:
                return true;
        }
    });
}

/**
 * Загружает статистику с сервера (для точного подсчета)
 */
export async function fetchNotificationStats() {
    try {
        const userData = secureGetUserData();
        if (!userData?.id) {
            return { 
                totalCount: 0, 
                activeCount: 0, 
                hasActiveNotifications: false,
                hasGrayIndicator: false,
                hasBlocking: false
            };
        }
        
        // Запрашиваем все уведомления для точного подсчета
        const [pendingRes, postponedRes, allRes] = await Promise.all([
            apiService.getNotifications({ 
                status: 'pending', 
                page: 1, 
                pageSize: 100, // Большой лимит для подсчета
                userId: userData.id 
            }).catch(() => ({ items: [], totalCount: 0 })),
            
            apiService.getNotifications({ 
                status: 'postponed', 
                page: 1, 
                pageSize: 100,
                userId: userData.id 
            }).catch(() => ({ items: [], totalCount: 0 })),
            
            apiService.getNotifications({ 
                status: 'all', 
                page: 1, 
                pageSize: 100,
                userId: userData.id 
            }).catch(() => ({ items: [], totalCount: 0 }))
        ]);
        
        // Анализируем данные
        const pendingItems = pendingRes.items || [];
        const postponedItems = postponedRes.items || [];
        const allItems = allRes.items || [];
        
        // Подсчет по типам
        let activeInfluencing = 0;
        let pendingInformation = 0;
        let hasBlocking = false;
        
        pendingItems.forEach(item => {
            // Определяем тип по значению type
            if (item.type === 0) { // OrderUpdateRequest - влияющее
                activeInfluencing++;
                // Проверяем блокировку
                if (item.status === 0) { // Pending
                    hasBlocking = true;
                }
            } else if (item.type === 2) { // System - информационное
                pendingInformation++;
            }
        });
        
        // Проверяем отложенные на блокировку (возврат времени)
        postponedItems.forEach(item => {
            if (item.type === 0 && item.returnsAt) { // Влияющее отложенное
                const now = new Date();
                const returnsAt = new Date(item.returnsAt);
                if (returnsAt <= now) {
                    hasBlocking = true;
                }
            }
        });
        
        const hasRed = activeInfluencing > 0;
        const hasGray = !hasRed && (pendingInformation > 0 || postponedItems.length > 0);
        
        return {
            totalCount: allItems.length,
            activeCount: activeInfluencing,
            hasActiveNotifications: hasRed,
            hasGrayIndicator: hasGray,
            hasBlocking,
            counts: {
                activeInfluencing,
                pendingInformation,
                postponed: postponedItems.length,
                total: allItems.length
            }
        };
        
    } catch (error) {
        console.warn('NotificationState: Ошибка загрузки статистики:', error);
        return getNotificationStats(); // Возвращаем локальные данные
    }
}