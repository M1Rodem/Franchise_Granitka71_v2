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
        status: signalrNotification.status,
        statusCode: signalrNotification.status,
        title: signalrNotification.title || '',
        message: signalrNotification.message || '',
        createdAt: signalrNotification.createdAt || new Date().toISOString(),
        orderId: signalrNotification.orderId,
        orderNumber: signalrNotification.orderNumber,
        initiatorName: signalrNotification.initiatorName || 'Система',
        
        // Критические поля для фильтрации
        userId: currentUserId,
        recipientUserId: signalrNotification.recipientUserId,
        
        // НОВЫЕ поля от бэкенда
        isInfluencing: signalrNotification.isInfluencing || signalrNotification.type === 0,
        isBlocking: signalrNotification.isBlocking || false,
        isInformation: signalrNotification.isInformation || signalrNotification.type === 2,
        minutesUntilReturn: signalrNotification.minutesUntilReturn,
        isActionRequired: signalrNotification.isActionRequired,
        canPostpone: signalrNotification.canPostpone,
        
        // Опциональные поля
        returnsAt: signalrNotification.returnsAt,
        resolvedAt: signalrNotification.resolvedAt,
        resolvedBy: signalrNotification.resolvedBy,
        resolutionNote: signalrNotification.resolutionNote,
        
        // Данные для модалки
        data: signalrNotification.data || {},
        comment: signalrNotification.comment || '',
        proposedChanges: signalrNotification.proposedChanges || {}
    };
    
    // ВЫЧИСЛЯЕМ ФЛАГИ на основе типа (обратная совместимость)
    const flags = getNotificationFlagsByType(baseNotification.type);
    
    // Добавляем вычисляемые поля для удобства
    const enriched = {
        ...baseNotification,
        ...flags,
        
        // Переопределяем флаги, если они пришли с сервера
        isInformation: baseNotification.isInformation !== undefined ? baseNotification.isInformation : flags.isInformation,
        isInfluencing: baseNotification.isInfluencing !== undefined ? baseNotification.isInfluencing : flags.isInfluencing,
        
        // Вычисляем isBlocking если не пришел с сервера
        isBlocking: baseNotification.isBlocking !== undefined ? baseNotification.isBlocking : 
                   (baseNotification.isInfluencing && 
                    (baseNotification.status === NOTIFICATION_STATUS.PENDING || 
                     (baseNotification.status === NOTIFICATION_STATUS.POSTPONED && 
                      baseNotification.returnsAt && new Date(baseNotification.returnsAt) <= new Date()))),
        
        // Вычисляем isActionRequired если не пришел с сервера
        isActionRequired: baseNotification.isActionRequired !== undefined ? baseNotification.isActionRequired :
                         (baseNotification.status === NOTIFICATION_STATUS.PENDING && !baseNotification.isInformation),
        
        // Вычисляем canPostpone если не пришел с сервера
        canPostpone: baseNotification.canPostpone !== undefined ? baseNotification.canPostpone :
                    (baseNotification.status === NOTIFICATION_STATUS.PENDING && baseNotification.isInfluencing)
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
 * Определяет тип медиа по ID (временный или постоянный)
 * @param {number|string} id - ID медиа
 * @returns {string} 'temp' или 'permanent'
 */
export function getMediaTypeById(id) {
    const idStr = String(id);
    // Временные ID обычно отрицательные или содержат префикс 'temp'
    if (idStr.startsWith('-') || idStr.startsWith('temp_') || idStr.includes('temp')) {
        return 'temp';
    }
    return 'permanent';
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
        case 'Latitude':
        case 'Longitude':
            // Координаты с точностью до 6 знаков
            return Number(value).toFixed(6);
        case 'PlotId':
            return `Участок #${value}`;
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