// notification/notification-hub-fix.js
import { notificationHub } from './notification-hub.js';

/**
 * Патч для временного решения проблемы с JoinUserGroup
 * Если серверный метод не существует, просто логируем и продолжаем
 */
export async function initializeNotificationHub(userId) {
    try {
        await notificationHub.connect();
        
        // Пробуем присоединиться к группе, но игнорируем ошибку если метода нет
        if (notificationHub.connection && notificationHub.connection.state === 'Connected') {
            try {
                await notificationHub.connection.invoke('JoinUserGroup', userId.toString());
                console.log(`[NotificationHub] Присоединен к группе пользователя ${userId}`);
            } catch (groupError) {
                if (groupError.message.includes('Method does not exist')) {
                    console.warn('[NotificationHub] Метод JoinUserGroup не существует на сервере. Продолжаем без присоединения к группе.');
                } else {
                    console.error('[NotificationHub] Ошибка присоединения к группе:', groupError);
                }
            }
        }
        
        return notificationHub;
    } catch (error) {
        console.error('[NotificationHub] Ошибка инициализации:', error);
        throw error;
    }
}

/**
 * Проверка состояния подключения
 */
export function getHubConnectionState() {
    return notificationHub.getConnectionState ? 
           notificationHub.getConnectionState() : 
           { state: notificationHub.getState() };
}

/**
 * Универсальный хелпер для подписки на события
 */
export function subscribeToNotificationEvents(handlers) {
    const unsubscribers = [];
    
    if (handlers.onNotificationReceived && notificationHub.on) {
        unsubscribers.push(
            notificationHub.on(notificationHub.events.NOTIFICATION_RECEIVED, handlers.onNotificationReceived)
        );
    }
    
    if (handlers.onNotificationUpdated && notificationHub.on) {
        unsubscribers.push(
            notificationHub.on(notificationHub.events.NOTIFICATION_UPDATED, handlers.onNotificationUpdated)
        );
    }
    
    if (handlers.onNotificationResolved && notificationHub.on) {
        unsubscribers.push(
            notificationHub.on(notificationHub.events.NOTIFICATION_RESOLVED, handlers.onNotificationResolved)
        );
    }
    
    // Возвращаем функцию для отписки
    return () => {
        unsubscribers.forEach(unsubscribe => unsubscribe());
    };
}