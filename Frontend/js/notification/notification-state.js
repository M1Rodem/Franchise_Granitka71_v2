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
    notifications: [],
    filteredNotifications: [],
    currentFilter: 'active', // ДОЛЖНО БЫТЬ 'active'
    currentPage: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
    currentUserId: secureGetUserData()?.id || null,
    
    _computed: {
        hasRedIndicator: false,
        hasGrayIndicator: false,
        hasBlocking: false,
        counts: {
            total: 0,
            activeInfluencing: 0,
            pendingInformation: 0,
            postponed: 0,
            information: 0,
            influencing: 0
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
        // Обогащаем уведомления userId
        state.notifications = state.notifications.map(notification => ({
            ...notification,
            userId: notification.userId || state.currentUserId
        }));
        
        // Удаляем дубликаты по id
        const uniqueNotifications = [];
        const seenIds = new Set();
        
        state.notifications.forEach(notification => {
            if (!seenIds.has(notification.id)) {
                seenIds.add(notification.id);
                uniqueNotifications.push(notification);
            }
        });
        
        if (uniqueNotifications.length !== state.notifications.length) {
            state.notifications = uniqueNotifications;
        }
        
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
    const notifications = state.notifications; // ЭТОЙ СТРОКИ НЕ ХВАТАЕТ!
    const now = new Date();
    
    // Счетчики
    let activeInfluencing = 0;  // Для красного индикатора (Pending + isInfluencing)
    let pendingInformation = 0;  // Информационные Pending (для серого)
    let postponed = 0;           // Все Postponed (для синего)
    let information = 0;         // Все информационные
    let influencing = 0;         // Все влияющие
    let hasBlocking = false;     // Есть ли блокирующие
    
    notifications.forEach(notification => {
        const status = notification.status !== undefined ? notification.status : notification.statusCode;
        const isPending = status === NOTIFICATION_STATUS.PENDING;
        const isPostponed = status === NOTIFICATION_STATUS.POSTPONED;
        
        // Классификация по типам
        if (notification.isInformation || notification.type === 2) {
            information++;
            if (isPending) {
                pendingInformation++;
            }
            if (isPostponed) {
                postponed++;
            }
        } else if (notification.isInfluencing || notification.type === 0) {
            influencing++;
            if (isPending) {
                activeInfluencing++;
            }
            if (isPostponed) {
                postponed++;
            }
        }
    });
    
    // Обновляем кэш
    state._computed = {
        hasRedIndicator: activeInfluencing > 0,
        hasBlueIndicator: activeInfluencing === 0 && postponed > 0,
        hasGrayIndicator: activeInfluencing === 0 && postponed === 0 && pendingInformation > 0,
        hasBlocking,
        counts: {
            total: activeInfluencing + pendingInformation + postponed, // ВСЕ актуальные уведомления!
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
    const stats = {
        totalCount: state._computed.counts.total,
        activeCount: state._computed.counts.activeInfluencing,
        hasActiveNotifications: state._computed.hasRedIndicator,
        hasGrayIndicator: state._computed.hasGrayIndicator,
        hasBlocking: state._computed.hasBlocking,
        counts: { ...state._computed.counts }
    };
    return stats;
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
        
        const status = notification.status !== undefined ? notification.status : notification.statusCode;
        
        switch(filter) {
            case 'active':
                // Только Pending (активные)
                return status === NOTIFICATION_STATUS.PENDING;
            
            case 'postponed':
                // Только Postponed (отложенные)
                return status === NOTIFICATION_STATUS.POSTPONED;
            
            case 'history':
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
        
        // Запрашиваем ТОЛЬКО активные (pending) уведомления для счетчика
        const [pendingRes, postponedRes] = await Promise.all([
            apiService.getNotifications({ 
                status: 'pending', 
                page: 1, 
                pageSize: 100,
                userId: userData.id 
            }).catch(() => ({ items: [], totalCount: 0 })),
            
            apiService.getNotifications({ 
                status: 'postponed', 
                page: 1, 
                pageSize: 100,
                userId: userData.id 
            }).catch(() => ({ items: [], totalCount: 0 }))
        ]);
        
        // Анализируем данные
        const pendingItems = pendingRes.items || [];
        const postponedItems = postponedRes.items || [];
        
        // Подсчет по типам
        let activeInfluencing = 0;
        let pendingInformation = 0;
        let hasBlocking = false;
        
        pendingItems.forEach(item => {
            if (item.type === 0) { // OrderUpdateRequest - влияющее
                activeInfluencing++;
                if (item.status === 0) {
                    hasBlocking = true;
                }
            } else if (item.type === 2) { // System - информационное
                pendingInformation++;
            }
        });
        
        // Проверяем отложенные на блокировку
        postponedItems.forEach(item => {
            if (item.type === 0 && item.returnsAt) {
                const now = new Date();
                const returnsAt = new Date(item.returnsAt);
                if (returnsAt <= now) {
                    hasBlocking = true;
                }
            }
        });
        
        const hasRed = activeInfluencing > 0;
        const hasGray = !hasRed && (pendingInformation > 0 || postponedItems.length > 0);
        
        // ВАЖНО: totalCount = только активные влияющие + информационные (не отложенные!)
        const totalCount = activeInfluencing + pendingInformation;        
        return {
            totalCount: totalCount,
            activeCount: activeInfluencing,
            hasActiveNotifications: hasRed,
            hasGrayIndicator: hasGray,
            hasBlocking,
            counts: {
                activeInfluencing,
                pendingInformation,
                postponed: postponedItems.length,
                total: totalCount
            }
        };
        
    } catch (error) {
        console.warn('NotificationState: Ошибка загрузки статистики:', error);
        return getNotificationStats(); // Возвращаем локальные данные
    }
}