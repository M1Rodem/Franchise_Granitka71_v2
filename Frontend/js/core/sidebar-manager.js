import { apiService } from '../api/api.js';
import { NotificationManager } from '../notification/notification-manager.js';
import { secureGetUserData } from '../utils/utils.js';
import { initBlockingHandlers } from '../notification/notification-blocking.js';

// Глобальное состояние счётчика (реальный синглтон)
const GlobalNotificationState = {
    count: 0,
    badgeElement: null,
    isConnected: false,
    subscribers: new Set()
};

export class SidebarManager {
    constructor() {
        this.pageInitialized = false;
        this.unsubscribers = [];
        this.sidebarElement = null;
        this.blockingHandlersInitialized = false;
    }

    /**
     * Инициализация sidebar на странице
     */
    init() {
        if (this.pageInitialized) {
            return;
        }
        
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) {
            console.warn('SidebarManager: Sidebar element not found in DOM');
            return;
        }
        
        this.sidebarElement = sidebar;
        
        // ВСЕГДА показываем сайдбар
        sidebar.style.display = 'block';
        sidebar.style.visibility = 'visible';
        sidebar.style.opacity = '1';
        
        this.setupBurgerButton();
        this.setupSidebarClose();
        this.setupActiveNav();
        
        // Отложенная инициализация админ-меню
        const initAdminMenuDelayed = () => {
            setTimeout(() => {
                this.setupAdminMenu();
            }, 150);
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAdminMenuDelayed);
        } else {
            initAdminMenuDelayed();
        }
        
        // Инициализация уведомлений (SignalR уже сам обновит бейдж)
        const initNotificationsDelayed = () => {
            setTimeout(() => {
                const userData = this.getUserDataWithRetry();
                if (userData?.id) {
                    this.initializeNotificationSystem();
                } else {
                    // Если не авторизован — просто скрываем бейдж
                    const badge = document.getElementById('notificationsBadge');
                    if (badge) {
                        badge.style.display = 'none';
                    }
                }
            }, 200);
        };
        
        initNotificationsDelayed();
        
        this.setupBlockingHandlers();
        
        this.pageInitialized = true;
        
        console.log('[SidebarManager] Инициализация завершена');
    }

    /**
     * Настройка обработчиков блокировки для навигации
     */
    setupBlockingHandlers() {
        initBlockingHandlers();
        this.setupSidebarSpecificHandlers();
    }

    /**
     * Специфичные обработчики для сайдбара
     */
    setupSidebarSpecificHandlers() {
        const sidebar = this.sidebarElement;
        if (!sidebar) return;
        
        // Можно добавить дополнительную визуальную обратную связь
        const blockedLinks = sidebar.querySelectorAll(
            'a[href*="create-order"], a[href*="archived-orders"]'
        );
        
        blockedLinks.forEach(link => {
            // Добавляем data-атрибут для идентификации защищенных ссылок
            link.setAttribute('data-blocking-check', 'true');
            
            // Можно добавить подсказку
            const originalTitle = link.getAttribute('title') || '';
            if (!originalTitle.includes('блокировка')) {
                link.setAttribute('title', `${originalTitle} (требует выполнения уведомлений)`.trim());
            }
        });
    }

    /**
     * Получение данных пользователя с повторными попытками
     */
    getUserDataWithRetry(maxAttempts = 5, delay = 100) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Пробуем все доступные методы
            let userData = null;
            
            if (typeof secureGetUserData === 'function') {
                userData = secureGetUserData();
            }
            
            if (!userData && window.apiService && typeof window.apiService.getCurrentUser === 'function') {
                userData = window.apiService.getCurrentUser();
            }
            
            if (!userData || !userData.role) {
                try {
                    const stored = localStorage.getItem('userData');
                    if (stored) {
                        userData = JSON.parse(stored);
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            }
            
            if (userData && userData.role) {
                return userData;
            }
            
            // Ждем перед следующей попыткой
            if (attempt < maxAttempts - 1) {
                // Блокирующий sleep (только для демо, в продакшене лучше промисы)
                const start = Date.now();
                while (Date.now() - start < delay) { /* wait */ }
            }
        }
        
        return null;
    }

    /**
     * Поиск или создание элемента бейджа
     */
    findOrCreateBadgeElement() {
        // Используем глобальный элемент если он уже есть
        if (GlobalNotificationState.badgeElement) {
            return GlobalNotificationState.badgeElement;
        }
        
        // Ищем существующий бейдж
        let badgeElement = document.getElementById('notificationsBadge');
        
        if (!badgeElement) {
            // Ищем ссылку на уведомления
            const notificationsLink = document.querySelector('[href="notifications.html"]');
            if (notificationsLink) {
                // Создаём бейдж если его нет
                badgeElement = document.createElement('span');
                badgeElement.id = 'notificationsBadge';
                badgeElement.className = 'badge';
                badgeElement.style.display = 'none';
                badgeElement.setAttribute('aria-label', '0 непрочитанных уведомлений');
                notificationsLink.appendChild(badgeElement);
            }
        }
        
        // Сохраняем в глобальное состояние
        GlobalNotificationState.badgeElement = badgeElement;
        
        return badgeElement;
    }

    /**
     * Инициализация системы уведомлений (SignalR + счётчик)
     */
    initializeNotificationSystem() {
        console.log('[SidebarManager] Инициализация системы уведомлений');
        NotificationManager.init().catch(err => {
            console.error('[SidebarManager] Ошибка инициализации NotificationManager:', err);
        });
    }

    updateBadgeWithStats(stats) {
        const { totalCount, hasActive } = stats;
        
        // Обновляем глобальное состояние
        if (GlobalNotificationState.count !== totalCount) {
            GlobalNotificationState.count = totalCount;
        }
        
        // Обновляем UI с правильным состоянием
        this.updateBadgeUI(totalCount, hasActive);
    }


    setupManagerSubscriptions(manager) {
        this.cleanupSubscriptions(); // очищаем старые, если были

        const unsubscribeCount = manager.on('notification_count_updated', (count) => {
            this.updateGlobalCount(count, true);
        });

        const unsubscribeStats = manager.on('notification_state_updated', (stats) => {
            // Обновляем глобальное состояние
            if (GlobalNotificationState.count !== stats.totalCount) {
                GlobalNotificationState.count = stats.totalCount;
            }
            
            // Обновляем UI с правильным состоянием
            this.updateBadgeUI(stats.totalCount, stats.hasActive);
        });

        const unsubscribeReceived = manager.on('notification_received', (notification) => {
            this.incrementGlobalCount();
            if (notification.type === 0 || notification.type === 1) {
                this.animateBadge('pulse');
            }
        });

        const unsubscribeResolved = manager.on('notification_resolved', (data) => {
            this.decrementGlobalCount();
        });

        const unsubscribeState = manager.on('connection_state_changed', (state) => {
            if (state.state === 'disconnected' || state.state === 'failed') {
                GlobalNotificationState.isConnected = false;
            } else if (state.state === 'connected') {
                GlobalNotificationState.isConnected = true;
            }
        });

        this.unsubscribers = [
            unsubscribeCount,
            unsubscribeStats,
            unsubscribeReceived,
            unsubscribeResolved,
            unsubscribeState
        ];
    }

    /**
     * Загрузка начального количества уведомлений через API
     */
    async loadInitialNotificationCount() {
        try {
            const response = await apiService.getNotifications({
                status: 'pending', // Только активные (не отложенные)
                page: 1,
                pageSize: 1
            });
            
            const count = response.totalCount || 0;
            this.updateGlobalCount(count, false); // false = без анимации
            
        } catch (error) {
            console.warn('SidebarManager: Error loading initial notification count:', error.message);
            // Устанавливаем 0 при ошибке
            this.updateGlobalCount(0, false);
        }
    }

    /**
     * Настройка подписок на SignalR события (глобально)
     */
    setupSignalRSubscriptions() {
        // Если уже есть подписки на этой странице, очищаем
        this.cleanupSubscriptions();
        
        
        // Подписка на обновление счётчика
        const unsubscribeCount = notificationHub.on(
            notificationHub.events.NOTIFICATION_COUNT_UPDATED, 
            (count) => {
                this.updateGlobalCount(count, true);
            }
        );
        
        // Подписка на новое уведомление
        const unsubscribeReceived = notificationHub.on(
            notificationHub.events.NOTIFICATION_RECEIVED, 
            (notification) => {
                // Инкрементируем счётчик для нового уведомления
                this.incrementGlobalCount();
                
                // Анимация для важных уведомлений
                if (notification.type === 0 || notification.type === 1) {
                    this.animateBadge('pulse');
                }
            }
        );
        
        // Подписка на обработанное уведомление
        const unsubscribeResolved = notificationHub.on(
            notificationHub.events.NOTIFICATION_RESOLVED, 
            (data) => {
                // Декрементируем счётчик если было активное уведомление
                this.decrementGlobalCount();
            }
        );
        
        // Подписка на изменение состояния соединения
        const unsubscribeState = notificationHub.on(
            notificationHub.events.CONNECTION_STATE_CHANGED,
            (state) => {
                if (state.state === 'disconnected' || state.state === 'failed') {
                    GlobalNotificationState.isConnected = false;
                } else if (state.state === 'connected') {
                    GlobalNotificationState.isConnected = true;
                }
            }
        );
        
        // Сохраняем функции отписки (для этой страницы)
        this.unsubscribers = [
            unsubscribeCount,
            unsubscribeReceived,
            unsubscribeResolved,
            unsubscribeState
        ];
        
    }

    /**
     * Обновление глобального счётчика
     */
    updateGlobalCount(newCount, animate = true) {
        const count = Math.max(0, newCount);
        
        // Если значение не изменилось - выходим
        if (GlobalNotificationState.count === count) return;
        
        const oldCount = GlobalNotificationState.count;
        GlobalNotificationState.count = count;
        
        // Обновляем UI
        this.updateBadgeUI(count, animate);
        
        // Уведомляем подписчиков (если будут в будущем)
        GlobalNotificationState.subscribers.forEach(callback => {
            try {
                callback(count);
            } catch (err) {
                console.warn('SidebarManager: Subscriber error:', err);
            }
        });
    }

    /**
     * Увеличение глобального счётчика на 1
     */
    incrementGlobalCount() {
        this.updateGlobalCount(GlobalNotificationState.count + 1, true);
    }

    /**
     * Уменьшение глобального счётчика на 1
     */
    decrementGlobalCount() {
        if (GlobalNotificationState.count > 0) {
            this.updateGlobalCount(GlobalNotificationState.count - 1, true);
        }
    }

    /**
     * Обновление UI бейджа
     */
    updateBadgeUI(count = GlobalNotificationState.count, hasActive = false) {
        const badge = GlobalNotificationState.badgeElement;
        if (!badge) {
            console.warn('SidebarManager: Badge element not found');
            // Попробуем найти заново
            this.findOrCreateBadgeElement();
            return;
        }
        
        const notificationsLink = badge.closest('a[href="notifications.html"]');
        
        if (count > 0) {
            // Показываем бейдж
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'inline-block';
            badge.setAttribute('aria-label', `${count} ${hasActive ? 'активных' : 'отложенных'} уведомлений`);
            
            // Сбрасываем классы и добавляем нужные
            badge.className = 'badge';
            
            if (hasActive) {
                badge.classList.add('badge-active');
            } else {
                badge.classList.add('badge-postponed');
            }
            
            // Обновляем кнопку в сайдбаре
            if (notificationsLink) {
                notificationsLink.classList.remove('has-active', 'has-postponed');
                if (hasActive) {
                    notificationsLink.classList.add('has-active');
                } else {
                    notificationsLink.classList.add('has-postponed');
                }
            }
            
        } else {
            // Скрываем бейдж
            badge.style.display = 'none';
            badge.removeAttribute('aria-label');
            badge.className = 'badge';
            
            // Сбрасываем стили кнопки
            if (notificationsLink) {
                notificationsLink.classList.remove('has-active', 'has-postponed');
            }
        }
    }

    /**
     * Анимация бейджа
     */
    animateBadge(animationType = 'pulse') {
        const badge = GlobalNotificationState.badgeElement;
        if (!badge || GlobalNotificationState.count === 0) return;
        
        badge.classList.add(animationType);
        
        setTimeout(() => {
            badge.classList.remove(animationType);
        }, 1500);
    }

    /**
     * Очистка подписок этой страницы
     */
    cleanupSubscriptions() {
        if (this.unsubscribers.length > 0) {
            this.unsubscribers.forEach(unsubscribe => {
                try {
                    unsubscribe();
                } catch (err) {
                    console.warn('SidebarManager: Error unsubscribing:', err);
                }
            });
            this.unsubscribers = [];
        }
    }

    /**
     * Получение текущего количества уведомлений
     */
    getNotificationCount() {
        return GlobalNotificationState.count;
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // UI МЕТОДЫ (без изменений от оригинальной рабочей версии)
    // ──────────────────────────────────────────────────────────────────────────────

    setupBurgerButton() {
        const burgerBtn = document.getElementById('burgerBtn');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        if (burgerBtn && sidebar) {
            // Клонируем для удаления старых обработчиков
            const newBurgerBtn = burgerBtn.cloneNode(true);
            burgerBtn.parentNode.replaceChild(newBurgerBtn, burgerBtn);
            
            newBurgerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const isOpening = !sidebar.classList.contains('open');
                sidebar.classList.toggle('open');
                newBurgerBtn.classList.toggle('open');
                newBurgerBtn.setAttribute('aria-expanded', sidebar.classList.contains('open'));
                
                if (mainContent) {
                    mainContent.classList.toggle('shifted');
                }
                
                this.toggleBackdrop(isOpening);
            });
        }
    }

    toggleBackdrop(show) {
        let backdrop = document.querySelector('.sidebar-backdrop');
        
        if (show && !backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'sidebar-backdrop';
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1001;
                display: block;
            `;
            backdrop.addEventListener('click', () => {
                this.closeSidebar();
            });
            document.body.appendChild(backdrop);
            
            setTimeout(() => {
                backdrop.style.opacity = '1';
            }, 10);
        } else if (!show && backdrop) {
            backdrop.style.opacity = '0';
            setTimeout(() => {
                if (backdrop && backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
            }, 300);
        }
    }

    setupSidebarClose() {
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const burgerBtn = document.getElementById('burgerBtn');
            
            if (sidebar && sidebar.classList.contains('open')) {
                const isBurgerBtn = e.target === burgerBtn || e.target.closest('#burgerBtn');
                const isSidebar = e.target === sidebar || sidebar.contains(e.target);
                
                if (!isBurgerBtn && !isSidebar) {
                    this.closeSidebar();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('open')) {
                    this.closeSidebar();
                }
            }
        });
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const burgerBtn = document.getElementById('burgerBtn');
        const mainContent = document.getElementById('mainContent');
        
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            if (burgerBtn) {
                burgerBtn.classList.remove('open');
                burgerBtn.setAttribute('aria-expanded', 'false');
            }
            if (mainContent) {
                mainContent.classList.remove('shifted');
            }
            this.toggleBackdrop(false);
        }
    }

    setupActiveNav() {
        const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
        
        document.querySelectorAll('.nav-item').forEach(item => {
            const href = item.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'dashboard.html')) {
                item.classList.add('active');
                item.setAttribute('aria-current', 'page');
            } else {
                item.classList.remove('active');
                item.removeAttribute('aria-current');
            }
        });
    }

    setupAdminMenu() {
        try {
            // ГАРАНТИРУЕМ получение пользователя ЛЮБЫМ способом
            let userData = null;
            
            // СПОСОБ 1: secureGetUserData из utils.js (если доступно глобально)
            if (typeof secureGetUserData === 'function') {
                userData = secureGetUserData();
            }
            
            // СПОСОБ 2: Через window.utils (если модуль экспортирован в window)
            if (!userData && window.utils && typeof window.utils.secureGetUserData === 'function') {
                userData = window.utils.secureGetUserData();
            }
            
            // СПОСОБ 3: Через apiService
            if (!userData && window.apiService && typeof window.apiService.getCurrentUser === 'function') {
                userData = window.apiService.getCurrentUser();
            }
            
            // СПОСОБ 4: Прямо из localStorage (последнее средство)
            if (!userData || !userData.role) {
                try {
                    const stored = localStorage.getItem('userData');
                    if (stored) {
                        userData = JSON.parse(stored);
                    }
                } catch (e) {
                    console.warn('SidebarManager: Cannot parse userData from localStorage');
                }
            }
            
             const userRole = userData?.role;
            
            // ЕСЛИ данные еще не готовы - используем данные из localStorage СРАЗУ
            if (!userRole) {
                try {
                    const stored = localStorage.getItem('userData');
                    if (stored) {
                        userData = JSON.parse(stored);
                    }
                } catch (e) {}
            }
            
            const usersLink = document.querySelector('a[href="users.html"]');
            const adminLink = document.querySelector('a[href="admin.html"]');
            
            if (userRole === 'Admin' || userRole === 'SuperAdmin') {
                document.body.classList.add('user-is-admin');
                
                // Принудительно показываем оба админских пункта
                if (usersLink) {
                    usersLink.style.display = 'block';
                    usersLink.classList.add('admin-only');
                }
                if (adminLink) {
                    adminLink.style.display = 'block';
                    adminLink.classList.add('admin-only');
                }
            } else {
                // Для не-админов скрываем
                if (usersLink) usersLink.style.display = 'none';
                if (adminLink) adminLink.style.display = 'none';
            }
            
            document.body.classList.add(`user-role-${(userRole || 'unknown').toLowerCase()}`);
            
        } catch (error) {
            console.warn('SidebarManager: Error in setupAdminMenu:', error);
        }
    }

    /**
     * Очистка ресурсов (при переходе на новую страницу)
     */
    destroy() {
        // Очищаем подписки этой страницы
        this.cleanupSubscriptions();
        
        // Сбрасываем флаг инициализации страницы
        this.pageInitialized = false;
        
    }

    /**
     * Статический метод для обратной совместимости
     */
    static init() {
        const instance = new SidebarManager();
        instance.init();
        return instance;
    }
}

// Экспортируем глобальное состояние для отладки
export { GlobalNotificationState };