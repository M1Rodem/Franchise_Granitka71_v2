export const NOTIFICATION_TYPES = {
    ORDER_UPDATE_REQUEST: 0,      // Влияющее уведомление (isInfluencing=true)
    SYSTEM: 2                     // Информационное уведомление (isInformation=true)
};

export const NOTIFICATION_STATUS = {
    PENDING: 0,      // Ожидает реакции
    APPROVED: 1,     // Принято/Убрано
    REJECTED: 2,     // Отклонено
    POSTPONED: 3     // Отложено
};

export const MAP_RELATED_FIELDS = [
    'Latitude',
    'Longitude',
    'PlotId'
];

/**
 * Вспомогательные функции для определения типа уведомления
 */
export function isInformationType(type) {
    return type === NOTIFICATION_TYPES.SYSTEM;
}

export function isInfluencingType(type) {
    return type === NOTIFICATION_TYPES.ORDER_UPDATE_REQUEST;
}

/**
 * Определяет флаги на основе типа уведомления
 * @param {number} type - тип уведомления (0, 2)
 * @returns {Object} Флаги isInformation и isInfluencing
 */
export function getNotificationFlagsByType(type) {
    const isInformation = isInformationType(type);
    const isInfluencing = isInfluencingType(type);
    
    return {
        isInformation,
        isInfluencing,
        isBlocking: false // isBlocking вычисляется отдельно на основе статуса
    };
}

/**
 * Проверяет, является ли уведомление активным (для красного индикатора)
 * @param {Object} notification - объект уведомления
 * @returns {boolean} true если влияющее в статусе Pending
 */
export function isActiveInfluencing(notification) {
    return !notification.isInformation && 
           notification.status === NOTIFICATION_STATUS.PENDING;
}

/**
 * Проверяет, является ли уведомление информационным в ожидании
 * @param {Object} notification - объект уведомления
 * @returns {boolean} true если информационное в статусе Pending
 */
export function isPendingInformation(notification) {
    return notification.isInformation && 
           notification.status === NOTIFICATION_STATUS.PENDING;
}

/**
 * Проверяет, является ли уведомление отложенным
 * @param {Object} notification - объект уведомления
 * @returns {boolean} true если статус Postponed
 */
export function isPostponed(notification) {
    return notification.status === NOTIFICATION_STATUS.POSTPONED;
}

/**
 * Получает текстовое представление статуса
 */
export function getStatusText(statusCode) {
    switch(statusCode) {
        case NOTIFICATION_STATUS.PENDING: return 'В ожидании';
        case NOTIFICATION_STATUS.APPROVED: return 'Принято';
        case NOTIFICATION_STATUS.REJECTED: return 'Отклонено';
        case NOTIFICATION_STATUS.POSTPONED: return 'Отложено';
        default: return 'Неизвестно';
    }
}

/**
 * Получает текстовое представление типа
 */
export function getTypeText(typeCode) {
    switch(typeCode) {
        case NOTIFICATION_TYPES.ORDER_UPDATE_REQUEST: return 'Запрос на изменение';
        case NOTIFICATION_TYPES.SYSTEM: return 'Системное';
        default: return 'Неизвестно';
    }
}