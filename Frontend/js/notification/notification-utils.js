import { formatDate as utilsFormatDate, escapeHtml as utilsEscapeHtml } from '../utils/utils.js';
import { NOTIFICATION_TYPES, NOTIFICATION_STATUS, getNotificationFlagsByType } from './notification-types.js';
import { formatDate } from '../utils/utils.js';

/**
 * Обогащает уведомление из SignalR всеми необходимыми флагами и полями
 * @param {Object} signalrNotification - сырое уведомление от SignalR
 * @param {number} currentUserId - ID текущего пользователя
 * @returns {Object} Обогащенное уведомление
 */
export function enrichSignalRNotification(signalrNotification, currentUserId = null) {
    // Базовые поля из SignalR
    const baseNotification = {
        id: signalrNotification.id,
        type: signalrNotification.type,
        status: signalrNotification.status, // СОХРАНЯЕМ ЧИСЛОВОЙ статус
        statusCode: signalrNotification.status, // дублируем для совместимости
        title: signalrNotification.title || '',
        message: signalrNotification.message || '',
        createdAt: signalrNotification.createdAt || new Date().toISOString(),
        orderId: signalrNotification.orderId,
        orderNumber: signalrNotification.orderNumber,
        initiatorName: signalrNotification.initiatorName || 'Система',
        
        // Критические поля для фильтрации
        userId: currentUserId,
        recipientUserId: signalrNotification.recipientUserId,
        
        // Опциональные поля
        returnsAt: signalrNotification.returnsAt,
        resolvedAt: signalrNotification.resolvedAt,
        resolvedBy: signalrNotification.resolvedBy,
        resolutionNote: signalrNotification.resolutionNote,
        
        // Данные для модалки (могут приходить из разных источников)
        data: signalrNotification.data || {},
        comment: signalrNotification.comment || '',
        proposedChanges: signalrNotification.proposedChanges || {}
    };
    
    // ВЫЧИСЛЯЕМ ФЛАГИ на основе типа
    const flags = getNotificationFlagsByType(baseNotification.type);
    
    // Добавляем вычисляемые поля для удобства
    const enriched = {
        ...baseNotification,
        ...flags,
        
        // Вычисляемое поле: требует ли действия (status=0 и НЕ информационное)
        isActionRequired: baseNotification.status === NOTIFICATION_STATUS.PENDING && 
                         !flags.isInformation,
        
        // Вычисляемое поле: можно ли отложить (только влияющие в статусе Pending)
        canPostpone: baseNotification.status === NOTIFICATION_STATUS.PENDING && 
                    flags.isInfluencing
    };
    
    return enriched;
}

/**
 * Конвертирует числовой статус в строковый (для обратной совместимости)
 * @deprecated Используйте напрямую числовые статусы
 */
export function convertNotificationStatus(statusCode) {
    switch(statusCode) {
        case NOTIFICATION_STATUS.PENDING: return 'pending';
        case NOTIFICATION_STATUS.APPROVED: return 'approved';
        case NOTIFICATION_STATUS.REJECTED: return 'rejected';
        case NOTIFICATION_STATUS.POSTPONED: return 'postponed';
        default: return 'pending';
    }
}

/**
 * Форматирует значение для отображения
 */
export function formatValue(value, fieldName) {
    if (value === null || value === undefined || value === '') return '—';
    
    switch(fieldName) {
        case 'TotalPrice':
        case 'price':
        case 'amount':
            return `${Number(value).toLocaleString('ru-RU')} ₽`;
        case 'OrderDate':
        case 'paymentDate':
            return formatDate(value);
        case 'Status':
            const statusMap = {
                0: 'Новый',
                1: 'В работе',
                2: 'Завершен',
                3: 'Отменен'
            };
            return statusMap[value] || value;
        default:
            return value.toString();
    }
}

/**
 * Форматирует размер файла
 */
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '—';
    
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Получает иконку для типа уведомления
 */
export function getNotificationIcon(type) {
    const icons = {

    };
    return icons[type] || '';
}

/**
 * Получает заголовок уведомления
 */
export function getNotificationTitle(notification) {
    if (notification.title) return notification.title;
    
    switch(notification.type) {
        case NOTIFICATION_TYPES.ORDER_UPDATE_REQUEST:
            if (notification.orderNumber) {
                return `Изменение заказа #${notification.orderNumber}`;
            }
            return 'Запрос на изменение заказа';
        case NOTIFICATION_TYPES.SYSTEM:
            return 'Системное уведомление';
        default:
            return 'Уведомление';
    }
}

/**
 * Проверяет, является ли уведомление блокирующим
 * Согласно бэкенду: isBlocking === (isInfluencing && (status === 0 || (status === 3 && returnsAt <= now)))
 */
export function isNotificationBlocking(notification) {
    if (!notification.isInfluencing) return false;
    
    // status === PENDING
    if (notification.status === NOTIFICATION_STATUS.PENDING) return true;
    
    // status === POSTPONED и время возврата наступило
    if (notification.status === NOTIFICATION_STATUS.POSTPONED && notification.returnsAt) {
        const now = new Date();
        const returnsAt = new Date(notification.returnsAt);
        return returnsAt <= now;
    }
    
    return false;
}

// Реэкспортируем утилиты из общего модуля
export { utilsFormatDate as formatDate, utilsEscapeHtml as escapeHtml };