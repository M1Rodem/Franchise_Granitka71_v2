import { apiService } from '../api/api.js';
import { showTempMessage, secureGetUserData } from '../utils/utils.js';
import { NotificationManager } from './notification-manager.js';
import { getState, setState } from './notification-state.js';
import { updateFilterCounts, updateSidebarIndicators } from './notification-ui.js';
import { NOTIFICATION_STATUS } from './notification-types.js';

/**
 * Отложить уведомление
 * @param {number} id - ID уведомления
 * @param {number} minutes - количество минут (по умолчанию 30)
 * @param {string} reason - причина откладывания
 */
export async function postponeNotification(id, minutes = 30, reason = '') {
    const manager = NotificationManager.getInstance();
    const state = getState();
    
    // Ищем уведомление в состоянии
    const notificationIndex = state.notifications.findIndex(n => n.id === id);
    
    if (notificationIndex === -1) {
        console.warn(`[postponeNotification] Уведомление ${id} не найдено в состоянии`);
        // Все равно пытаемся отправить запрос на сервер
    }
    
    // ПРОВЕРЯЕМ: можно ли отложить это уведомление
    if (notificationIndex !== -1) {
        const notification = state.notifications[notificationIndex];
        
        // Информационные уведомления нельзя отложить
        if (notification.isInformation) {
            showTempMessage('Информационные уведомления нельзя отложить', 'warning', 3000);
            return false;
        }
        
        // Проверяем статус - только Pending можно отложить
        if (notification.status !== NOTIFICATION_STATUS.PENDING) {
            showTempMessage('Можно отложить только уведомления в ожидании', 'warning', 3000);
            return false;
        }
    }
    
    // 1. ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ UI
    if (notificationIndex !== -1) {
        const newNotifications = [...state.notifications];
        const notification = { ...newNotifications[notificationIndex] };
        
        // Обновляем данные для оптимистичного UI
        notification.status = NOTIFICATION_STATUS.POSTPONED;
        notification.statusCode = NOTIFICATION_STATUS.POSTPONED;
        notification.returnsAt = new Date(Date.now() + minutes * 60000).toISOString();
        notification.minutesUntilReturn = minutes;
        
        newNotifications[notificationIndex] = notification;
        
        // Обновляем состояние СРАЗУ
        setState({ notifications: newNotifications });
        
        // Перерисовываем элемент если есть функция
        if (manager.rerenderNotificationItem) {
            manager.rerenderNotificationItem(id);
        }
        
        // Обновляем счетчики фильтров СРАЗУ
        updateFilterCounts();
        
        // Обновляем индикаторы в сайдбаре
        const stats = manager.getNotificationStats ? manager.getNotificationStats() : null;
        if (stats) {
            updateSidebarIndicators(stats);
        }
        
        // Закрываем модалку если открыта
        if (manager.viewModal?.currentNotificationId === id) {
            manager.viewModal.hide();
        }
        
        // Показываем временное сообщение
        showTempMessage(`Уведомление отложено на ${minutes} минут`, 'success', 3000);
    }
    
    // 2. ОТПРАВКА ЗАПРОСА НА СЕРВЕР (в фоне)
    try {
        // Согласно бэкенду: POST /api/notifications/{id}/postpone?minutes=30
        // Проверяем доступные методы apiService
        let result;
        
        if (apiService.postponeNotification && typeof apiService.postponeNotification === 'function') {
            // Используем специализированный метод если он есть
            result = await apiService.postponeNotification(id, minutes, reason);
        } else if (apiService.post && typeof apiService.post === 'function') {
            // Или используем общий post метод
            result = await apiService.post(`/api/notifications/${id}/postpone`, {
                minutes: minutes,
                reason: reason || 'Отложено пользователем'
            });
        } else if (apiService.resolveNotification && typeof apiService.resolveNotification === 'function') {
            // Или используем resolve с status=3 (Postponed)
            result = await apiService.resolveNotification(id, 3, reason);
        } else {
            // Fallback: пытаемся использовать fetch напрямую
            const token = secureGetToken();
            const response = await fetch(`/api/notifications/${id}/postpone?minutes=${minutes}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: reason ? JSON.stringify({ reason }) : undefined
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            result = await response.json();
        }
        
        return result;
        
    } catch (error) {
        console.error('[postponeNotification] Ошибка сервера при откладывании:', error);
        
        // НЕ откатываем UI при ошибке сети/сервера
        // UI остается в оптимистичном состоянии, синхронизация произойдет при следующей загрузке
        
        // Можно показать предупреждение, но не ошибку
        showTempMessage('Уведомление отложено локально. Синхронизация с сервером позже.', 'warning', 5000);
        
        throw error;
    }
}

/**
 * Разрешить уведомление (принять/отклонить/убрать)
 * @param {number} id - ID уведомления
 * @param {number} status - статус (1=Approved, 2=Rejected)
 * @param {string} note - примечание
 */
export async function resolveNotification(id, status, note = '') {
    const manager = NotificationManager.getInstance();
    const userData = secureGetUserData();
    const state = getState();
    
    // Ищем уведомление для проверки типа
    const notification = state.notifications.find(n => n.id === id);
    
    // ПРОВЕРЯЕМ ВАЛИДНОСТЬ СТАТУСА
    if (notification) {
        // Для информационных уведомлений разрешен только статус Approved (1)
        if (notification.isInformation && status !== NOTIFICATION_STATUS.APPROVED) {
            showTempMessage('Для информационных уведомлений доступно только действие "Убрать"', 'error', 4000);
            throw new Error('Invalid status for information notification');
        }
        
        // Для влияющих уведомлений разрешены Approved (1) и Rejected (2)
        if (notification.isInfluencing && 
            status !== NOTIFICATION_STATUS.APPROVED && 
            status !== NOTIFICATION_STATUS.REJECTED) {
            showTempMessage('Для уведомлений доступны только действия "Принять" или "Отклонить"', 'error', 4000);
            throw new Error('Invalid status for influencing notification');
        }
    }
    
    // КЭШИРУЕМ ДЕЙСТВИЕ для предотвращения дублирования
    if (manager.actionCache) {
        const actionKey = `${id}_${status}_${Date.now()}`;
        manager.actionCache.set(actionKey, {
            notificationId: id,
            userId: userData?.id,
            action: 'resolve',
            status: status,
            timestamp: Date.now()
        });
        
        // Автоочистка старых записей через 30 секунд
        setTimeout(() => {
            manager.actionCache.delete(actionKey);
        }, 30000);
    }
    
    // УСТАНАВЛИВАЕМ СОСТОЯНИЕ ЗАГРУЗКИ
    if (manager.setButtonsLoading) {
        manager.setButtonsLoading(id, true);
    }
    
    // ОПТИМИСТИЧНОЕ УДАЛЕНИЕ ИЗ UI
    // Для информационных уведомлений и влияющих - сразу удаляем из списка
    const updatedNotifications = state.notifications.filter(n => n.id !== id);
    setState({
        notifications: updatedNotifications,
        totalCount: Math.max(0, state.totalCount - 1)
    });
    
    // УДАЛЯЕМ ЭЛЕМЕНТ ИЗ DOM
    const listContainer = document.getElementById('notificationsList');
    if (listContainer) {
        const itemToRemove = listContainer.querySelector(`.notification-item[data-id="${id}"]`);
        if (itemToRemove) {
            // Плавное исчезновение
            itemToRemove.style.transition = 'opacity 0.3s, transform 0.3s, height 0.3s, margin 0.3s';
            itemToRemove.style.opacity = '0';
            itemToRemove.style.transform = 'translateX(-20px)';
            itemToRemove.style.height = '0';
            itemToRemove.style.margin = '0';
            itemToRemove.style.overflow = 'hidden';
            
            setTimeout(() => {
                if (itemToRemove.parentNode) {
                    itemToRemove.parentNode.removeChild(itemToRemove);
                }
            }, 300);
        }
    }
    
    // ЗАКРЫВАЕМ МОДАЛКУ если открыта
    if (manager.viewModal?.currentNotificationId === id) {
        manager.viewModal.hide();
    }
    
    // ПОКАЗЫВАЕМ ПРЕДВАРИТЕЛЬНОЕ СООБЩЕНИЕ
    let statusMessage = '';
    if (notification?.isInformation) {
        statusMessage = 'Уведомление убрано';
    } else {
        statusMessage = status === NOTIFICATION_STATUS.APPROVED 
            ? 'Изменения приняты' 
            : 'Изменения отклонены';
    }
    
    showTempMessage(statusMessage, 'success', 3000);
    
    // ОБНОВЛЯЕМ СЧЕТЧИКИ И ИНДИКАТОРЫ
    updateFilterCounts();
    const stats = manager.getNotificationStats ? manager.getNotificationStats() : null;
    if (stats) {
        updateSidebarIndicators(stats);
    }
    
    try {
        // ОТПРАВЛЯЕМ ЗАПРОС НА СЕРВЕР через существующий метод
        const result = await apiService.resolveNotification(id, status, note);
        
        // СБРАСЫВАЕМ СОСТОЯНИЕ ЗАГРУЗКИ
        if (manager.setButtonsLoading) {
            manager.setButtonsLoading(id, false);
        }
        
        return result;
        
    } catch (error) {
        console.error('[resolveNotification] Ошибка сервера:', error);
        
        // ПРИ ОШИБКЕ СЕРВЕРА:
        // 1. Сбрасываем состояние загрузки
        if (manager.setButtonsLoading) {
            manager.setButtonsLoading(id, false);
        }
        
        // 2. Очищаем кэш действия
        if (manager.actionCache) {
            const entries = Array.from(manager.actionCache.entries());
            for (const [key, value] of entries) {
                if (value.notificationId === id) {
                    manager.actionCache.delete(key);
                }
            }
        }
        
        // 3. Показываем сообщение об ошибке
        showTempMessage(
            `Ошибка обработки уведомления: ${error.message || 'Сервер недоступен'}`,
            'error',
            5000
        );
        
        // 4. НЕ ВОССТАНАВЛИВАЕМ UI - оставляем оптимистичное состояние
        // Синхронизация произойдет при следующей загрузке или через SignalR
        
        throw error;
    }
}

/**
 * Оптимистичное откладывание (немедленное обновление UI)
 * @param {number} notificationId - ID уведомления
 * @returns {boolean} успешность операции
 */
export function optimisticPostpone(notificationId) {
    const manager = NotificationManager.getInstance();
    const state = getState();
    
    // Ищем уведомление
    const notificationIndex = state.notifications.findIndex(n => n.id === notificationId);
    
    if (notificationIndex === -1) {
        console.warn(`[optimisticPostpone] Уведомление ${notificationId} не найдено`);
        return false;
    }
    
    const notification = state.notifications[notificationIndex];
    
    // ПРОВЕРКА: только влияющие уведомления в статусе Pending можно отложить
    if (notification.isInformation) {
        console.warn('[optimisticPostpone] Информационные уведомления нельзя отложить');
        return false;
    }
    
    if (notification.status !== NOTIFICATION_STATUS.PENDING) {
        console.warn('[optimisticPostpone] Можно отложить только уведомления в ожидании');
        return false;
    }
    
    // 1. ОБНОВЛЯЕМ СОСТОЯНИЕ
    const updatedNotifications = [...state.notifications];
    updatedNotifications[notificationIndex] = {
        ...notification,
        status: NOTIFICATION_STATUS.POSTPONED,
        statusCode: NOTIFICATION_STATUS.POSTPONED,
        returnsAt: new Date(Date.now() + 30 * 60000).toISOString(),
        minutesUntilReturn: 30
    };
    
    setState({
        notifications: updatedNotifications,
        totalCount: state.totalCount // Количество не меняется
    });
    
    // 2. ОБНОВЛЯЕМ UI ЭЛЕМЕНТ
    const listContainer = document.getElementById('notificationsList');
    if (listContainer) {
        const item = listContainer.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (item) {
            // Меняем классы и содержимое
            item.classList.remove('notification-pending');
            item.classList.add('notification-postponed');
            
            // Обновляем статус в элементе
            const statusElement = item.querySelector('.notification-status');
            if (statusElement) {
                statusElement.textContent = 'Отложено';
                statusElement.className = 'notification-status status-postponed';
            }
            
            // Обновляем кнопки
            const actionsContainer = item.querySelector('.notification-actions');
            if (actionsContainer) {
                actionsContainer.innerHTML = `
                    <button class="btn btn-outline btn-view" 
                            data-action="view" 
                            data-id="${notificationId}"
                            title="Просмотреть детали">
                        Просмотр
                    </button>
                    <span class="postponed-label">Отложено</span>
                `;
            }
        }
    }
    
    // 3. ОБНОВЛЯЕМ СЧЕТЧИКИ И ИНДИКАТОРЫ
    updateFilterCounts();
    const stats = manager.getNotificationStats ? manager.getNotificationStats() : null;
    if (stats) {
        updateSidebarIndicators(stats);
    }
    
    // 4. ПОКАЗЫВАЕМ СООБЩЕНИЕ
    showTempMessage('Уведомление отложено на 30 минут', 'success', 3000);
    
    return true;
}

/**
 * Убрать информационное уведомление
 * @param {number} notificationId - ID уведомления
 * @param {string} note - примечание (необязательно)
 */
export async function dismissInformationNotification(notificationId, note = '') {
    // Для информационных уведомлений всегда используем статус Approved (1)
    return resolveNotification(notificationId, NOTIFICATION_STATUS.APPROVED, note);
}