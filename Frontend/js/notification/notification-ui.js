import { apiService } from '../api/api.js';
import { escapeHtml, getNotificationIcon, getNotificationTitle } from './notification-utils.js';
import { getState, getFilteredNotifications, getNotificationStats } from './notification-state.js';
import { NOTIFICATION_STATUS, NOTIFICATION_TYPES, getStatusText } from './notification-types.js';
import { formatDate } from '../utils/utils.js';

/**
 * Обновляет бейдж с количеством уведомлений в сайдбаре
 * @param {number} count - общее количество уведомлений
 */
export function updateNotificationBadge(count) {
    
    // Игнорируем переданный count - берем из stats
    const stats = getNotificationStats();
    if (!stats) {
        console.warn('[DEBUG] getNotificationStats не вернул данные');
        return;
    }
    
    const badge = document.getElementById('notificationsBadge');
    if (!badge) {
        console.warn('[DEBUG] notificationsBadge element not found!');
        return;
    }
    
    // Очищаем все классы цвета
    badge.className = 'badge';
    badge.removeAttribute('style');
    
    const totalCount = stats.totalCount;
    
    if (totalCount > 0) {
        badge.textContent = totalCount > 99 ? '99+' : totalCount.toString();
        badge.style.display = 'inline-flex';
        badge.style.opacity = '1';
        badge.style.visibility = 'visible';
        
        // Определяем цвет бейджа по статистике
        if (stats.hasActiveNotifications) {
            // Красный для активных влияющих уведомлений
            badge.classList.add('badge-danger');
        } 
        else if (stats.counts && stats.counts.postponed > 0 && stats.counts.activeInfluencing === 0 && stats.counts.pendingInformation === 0) {
            // Синий для только отложенных уведомлений
            badge.style.backgroundColor = '#3498db';
            badge.style.color = 'white';
        }
        else if (stats.hasGrayIndicator) {
            // Серый для информационных или смешанных
            badge.classList.add('badge-secondary');
        }
        else {
            // По умолчанию - акцентный цвет
            badge.style.backgroundColor = 'var(--accent)';
            badge.style.color = 'white';
        }
    } else {
        badge.textContent = '';
        badge.style.display = 'none';
        badge.style.opacity = '0';
        badge.style.visibility = 'hidden';
    }
}

export function updateBadgeColor() {
    const badge = document.getElementById('notificationsBadge');
    if (!badge) return;
    
    const stats = getNotificationStats?.();
    if (!stats) return;
    
    const count = parseInt(badge.textContent) || 0;
    
    if (count === 0) {
        badge.style.display = 'none';
        return;
    }
    
    // Очищаем предыдущие классы и стили
    badge.className = 'badge';
    badge.removeAttribute('style');
    badge.style.display = 'inline-flex';
    
    // Проверяем наличие активных влияющих уведомлений
    const hasActiveInfluencing = stats.hasActiveNotifications || 
                                (stats.counts && stats.counts.activeInfluencing > 0);
    
    // Проверяем наличие только отложенных уведомлений
    const hasOnlyPostponed = stats.counts && 
                            stats.counts.postponed > 0 && 
                            stats.counts.activeInfluencing === 0 && 
                            stats.counts.pendingInformation === 0;
    
    // Проверяем наличие только информационных уведомлений
    const hasOnlyInformation = stats.counts && 
                              stats.counts.pendingInformation > 0 && 
                              stats.counts.activeInfluencing === 0 && 
                              stats.counts.postponed === 0;
    
    if (hasActiveInfluencing) {
        badge.classList.add('badge-danger');
    } 
    else if (hasOnlyPostponed) {
        badge.style.backgroundColor = '#3498db';
        badge.style.color = 'white';
    }
    else if (hasOnlyInformation) {
        badge.classList.add('badge-secondary');
    }
    else if (stats.hasGrayIndicator) {
        badge.classList.add('badge-secondary');
    }
}

/**
 * Обновляет индикаторы в сайдбаре (красный/серый)
 * @param {Object} stats - статистика уведомлений
 */
export function updateSidebarIndicators(stats) {
    const sidebarItem = document.querySelector('.nav-item[data-route="notifications"]');
    if (!sidebarItem) return;
    
    // Удаляем все индикаторные классы
    sidebarItem.classList.remove('has-active', 'has-postponed', 'has-information');
    
    // Добавляем соответствующий класс
    if (stats.hasActiveNotifications) {
        sidebarItem.classList.add('has-active'); // Красный индикатор
    } else if (stats.hasGrayIndicator) {
        sidebarItem.classList.add('has-postponed'); // Серый индикатор
    }
    
    // ОБНОВЛЯЕМ БЕЙДЖ с учетом цвета
    updateNotificationBadge(stats.totalCount);
    updateBadgeColor(stats);
}

/**
 * Обновляет счетчики в фильтрах
 */
export async function updateFilterCounts() {
    try {
        const state = getState();
        const userId = state.currentUserId;
        
        if (!userId) return;
        
        // Запрашиваем счетчики с сервера для каждого фильтра
        const [pendingRes, postponedRes, historyRes] = await Promise.all([
            // Активные: все Pending (и type=0 и type=2)
            apiService.getNotifications({ 
                status: 'pending', 
                page: 1, 
                pageSize: 1,
                userId
            }).catch(() => ({ totalCount: 0 })),
            
            // Отложенные: только status=3
            apiService.getNotifications({ 
                status: 'postponed', 
                page: 1, 
                pageSize: 1,
                userId 
            }).catch(() => ({ totalCount: 0 })),
            
            // История: approved и rejected
            apiService.getNotifications({ 
                status: 'all', 
                page: 1, 
                pageSize: 1,
                userId,
                excludeStatus: ['pending', 'postponed']
            }).catch(() => ({ totalCount: 0 }))
        ]);
        
        // Обновляем DOM элементы
        const activeCountElement = document.getElementById('activeCount');
        const postponedCountElement = document.getElementById('postponedCount');
        const historyCountElement = document.getElementById('historyCount');
        
        if (activeCountElement) {
            const activeCount = pendingRes.totalCount || 0;
            activeCountElement.textContent = activeCount;
            activeCountElement.style.display = activeCount > 0 ? 'inline' : 'none';
        }
        
        if (postponedCountElement) {
            const postponedCount = postponedRes.totalCount || 0;
            postponedCountElement.textContent = postponedCount;
            postponedCountElement.style.display = postponedCount > 0 ? 'inline' : 'none';
        }
        
        if (historyCountElement) {
            const historyCount = historyRes.totalCount || 0;
            historyCountElement.textContent = historyCount;
            historyCountElement.style.display = historyCount > 0 ? 'inline' : 'none';
        }
        
    } catch (error) {
        console.warn('Ошибка обновления счетчиков фильтров:', error);
    }
}

export function updateFilterCountsFromState() {
    
    const state = getState();
    const notifications = state.notifications || [];
    
    // Считаем для каждого фильтра
    let activeCount = 0;
    let postponedCount = 0;
    let historyCount = 0;
    
    notifications.forEach(notification => {
        const status = notification.status !== undefined ? notification.status : notification.statusCode;
        
        // Активные (Pending)
        if (status === NOTIFICATION_STATUS.PENDING) {
            activeCount++;
        }
        
        // Отложенные (Postponed)
        if (status === NOTIFICATION_STATUS.POSTPONED) {
            postponedCount++;
        }
        
        // История = ВСЕ уведомления (total)
        // Не фильтруем по статусу
    });
    
    // История = общее количество всех уведомлений
    historyCount = notifications.length;
    
    // Обновляем DOM элементы
    const activeCountElement = document.getElementById('activeCount');
    const postponedCountElement = document.getElementById('postponedCount');
    const historyCountElement = document.getElementById('historyCount');
    
    if (activeCountElement) {
        activeCountElement.textContent = activeCount;
        activeCountElement.style.display = activeCount > 0 ? 'inline' : 'none';
    }
    
    if (postponedCountElement) {
        postponedCountElement.textContent = postponedCount;
        postponedCountElement.style.display = postponedCount > 0 ? 'inline' : 'none';
    }
    
    if (historyCountElement) {
        historyCountElement.textContent = historyCount;
        historyCountElement.style.display = historyCount > 0 ? 'inline' : 'none';
    }
}

/**
 * Рендерит список уведомлений
 */
export function renderNotifications() {
    const state = getState();
    const listContainer = document.getElementById('notificationsList');
    
    if (!listContainer) {
        return;
    }
    
    listContainer.innerHTML = '';
    
    // Получаем отфильтрованные уведомления
    const filteredNotifications = getFilteredNotifications();
    
    if (filteredNotifications.length === 0) {
        showEmptyState();
        return;
    }
    
    // Рендерим каждое уведомление
    filteredNotifications.forEach((notification, index) => {
        const item = createNotificationElement(notification);
        listContainer.appendChild(item);
    });
}

/**
 * Создает DOM элемент для уведомления
 */
function createNotificationElement(notification) {
    const item = document.createElement('div');
    item.className = `notification-item ${getNotificationItemClass(notification)}`;
    item.dataset.id = notification.id;
    item.dataset.type = notification.type;
    item.dataset.isInformation = notification.isInformation;
    
    // Иконка и заголовок
    const icon = getNotificationIcon(notification.type);
    const title = getNotificationTitle(notification);
    
    // Статус
    const statusText = getStatusText(notification.status);
    
    // Определяем действия
    const actionsHTML = createActionsHTML(notification);
    
    item.innerHTML = `
        <div class="notification-card glass-background ${getNotificationCardClass(notification)}" data-id="${notification.id}">
            <div class="card-header">
                <div class="card-header-content">
                    <div class="notification-icon-wrapper">
                        <div class="notification-title-container">
                            <h4 class="notification-title">${escapeHtml(title)}</h4>
                            <span class="notification-time text-muted">${formatDate(notification.createdAt)}</span>
                        </div>
                    </div>
                    <div class="card-header-badges">
                        <span class="badge ${notification.isInformation ? 'badge-info' : 'badge-warning'}">
                            ${notification.isInformation ? 'Информационное' : 'Требует действий'}
                        </span>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <p class="notification-message">${escapeHtml(notification.message || '')}</p>
            </div>
            <div class="card-footer">
                <div class="notification-actions">
                    ${actionsHTML}
                </div>
            </div>
        </div>
    `;
    // Добавляем обработчики событий
    addNotificationEventListeners(item, notification);
    
    return item;
}

function getNotificationCardClass(notification) {
    const classes = ['glass-shadow', 'border', 'radius-xl'];
    
    if (notification.isInformation) {
        classes.push('notification-information');
    } else {
        classes.push('notification-influencing');
    }
    
    if (notification.status === NOTIFICATION_STATUS.PENDING) {
        classes.push('notification-pending', 'border-accent');
    }
    
    // ДОБАВЛЕНО: класс для блокирующих уведомлений
    if (notification.isBlocking) {
        classes.push('notification-blocking', 'border-error');
    }
    
    if (notification.status === NOTIFICATION_STATUS.POSTPONED) {
        classes.push('notification-postponed', 'border-muted');
    }
    
    return classes.join(' ');
}

/**
 * Определяет CSS класс для элемента уведомления
 */
function getNotificationItemClass(notification) {
    const classes = [];
    
    if (notification.isInformation) {
        classes.push('notification-information');
    } else {
        classes.push('notification-influencing');
    }
    
    if (notification.status === NOTIFICATION_STATUS.PENDING) {
        classes.push('notification-pending');
    }
    
    // ДОБАВЛЕНО: класс для блокирующих уведомлений
    if (notification.isBlocking) {
        classes.push('notification-blocking');
    }
    
    return classes.join(' ');
}

/**
 * Создает HTML для кнопок действий
 */
function createActionsHTML(notification) {
    // ИНФОРМАЦИОННЫЕ уведомления - только кнопка "Убрать"
    if (notification.isInformation) {
        if (notification.status === NOTIFICATION_STATUS.PENDING) {
            return `
                <button class="btn btn-primary btn-small btn-dismiss" 
                        data-action="view" 
                        data-id="${notification.id}"
                        title="Просмотреть детали">
                    Просмотр
                </button>
                        <button class="btn btn-outline btn-small btn-view" 
                        data-action="dismiss" 
                        data-id="${notification.id}"
                        title="Убрать уведомление">
                    Убрать
                </button>
            `;
        } else {
            return '<span class="resolved-label">Обработано</span>';
        }
    }
    
    // ВЛИЯЮЩИЕ уведомления
    switch(notification.status) {
        case NOTIFICATION_STATUS.PENDING:
            return `
                <button class="btn btn-primary btn-small btn-view" 
                        data-action="view" 
                        data-id="${notification.id}"
                        title="Просмотреть и принять решение">
                    Просмотр
                </button>
                <button class="btn btn-outline btn-small btn-postpone" 
                        data-action="postpone" 
                        data-id="${notification.id}"
                        title="Отложить на 30 минут">
                    Отложить
                </button>
            `;
            
        case NOTIFICATION_STATUS.POSTPONED:
            return `
                <button class="btn btn-primary btn-small btn-view" 
                        data-action="view" 
                        data-id="${notification.id}"
                        title="Просмотреть детали">
                    Просмотр
                </button>
                <span class="postponed-label">Отложено</span>
            `;
            
        case NOTIFICATION_STATUS.APPROVED:
        case NOTIFICATION_STATUS.REJECTED:
            const label = notification.status === NOTIFICATION_STATUS.APPROVED ? '✓ Принято' : '✗ Отклонено';
            return `<span class="resolved-label">${label}</span>`;
            
        default:
            return '';
    }
}

/**
 * Добавляет обработчики событий к элементу уведомления
 */
function addNotificationEventListeners(item, notification) {
    // Обработка кликов по кнопкам
    item.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const action = button.dataset.action;
        const notificationId = parseInt(button.dataset.id);
        
        if (!notificationId) return;
        
        // Получаем менеджер уведомлений
        const manager = window.NotificationManager?.getInstance?.();
        if (!manager) {
            console.error('NotificationManager не найден');
            return;
        }
        
        switch(action) {
            case 'view':
                if (manager.viewModal && typeof manager.viewModal.show === 'function') {
                    manager.viewModal.show(notification);
                }
                break;
                
            case 'postpone':
                if (manager.postponeNotification && typeof manager.postponeNotification === 'function') {
                    manager.postponeNotification(notificationId, 30, '');
                }
                break;
                
            case 'dismiss':
                // Для информационных уведомлений - разрешаем со статусом Approved
                if (manager.resolveNotification && typeof manager.resolveNotification === 'function') {
                    manager.resolveNotification(notificationId, NOTIFICATION_STATUS.APPROVED, '');
                }
                break;
        }
    });
}

/**
 * Показывает состояние "нет уведомлений"
 */
function showEmptyState() {
    const listContainer = document.getElementById('notificationsList');
    const state = getState();
    
    if (!listContainer) return;
    
    let message = '';
    switch(state.currentFilter) {
        case 'active':
            message = 'Нет активных уведомлений, требующих действий';
            break;
        case 'postponed':
            message = 'Нет отложенных уведомлений';
            break;
        case 'information':
            message = 'Нет информационных уведомлений';
            break;
        case 'history':
            message = 'Нет уведомлений в истории';
            break;
        default:
            message = 'Нет уведомлений';
    }
    
    listContainer.innerHTML = `
        <div class="empty-state">
            <h3>${message}</h3>
            <p>Здесь будут отображаться уведомления, соответствующие выбранному фильтру</p>
        </div>
    `;
}

/**
 * Обновляет текст пустого состояния
 */
export function updateEmptyStateText(noNotificationsElement) {
    const state = getState();
    let text = '';
    
    switch(state.currentFilter) {
        case 'active':
            text = 'Нет активных уведомлений';
            break;
        case 'postponed':
            text = 'Нет отложенных уведомлений';
            break;
        case 'information':
            text = 'Нет информационных уведомлений';
            break;
        case 'history':
            text = 'Нет уведомлений в истории';
            break;
        default:
            text = 'Нет уведомлений';
    }
    
    if (noNotificationsElement) {
        noNotificationsElement.innerHTML = `<p>${text}</p>`;
    }
}

/**
 * Обновляет пагинацию
 */
export function updatePagination() {
    const state = getState();
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (prevBtn) {
        prevBtn.disabled = state.currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = state.currentPage >= state.totalPages;
    }
    
    if (pageInfo) {
        pageInfo.textContent = `Страница ${state.currentPage} из ${state.totalPages}`;
    }
}

/**
 * Подсвечивает уведомление (при новом получении)
 */
export function highlightNotification(id) {
    const item = document.querySelector(`.notification-item[data-id="${id}"]`);
    if (item) {
        item.classList.add('highlighted');
        setTimeout(() => item.classList.remove('highlighted'), 2000);
    }
}