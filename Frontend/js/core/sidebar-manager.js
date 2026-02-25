import { apiService } from '../api/api.js';
import { NotificationManager } from '../notification/notification-manager.js';
import { secureGetUserData } from '../utils/utils.js';
import { initBlockingHandlers } from '../notification/notification-blocking.js';
import { updateNotificationBadge } from '../notification/notification-ui.js';

export class SidebarManager {
    constructor() {
        this.pageInitialized = false;
        this.sidebarElement = null;
        this.blockingHandlersInitialized = false;
        this.notificationUnsubscribe = null;
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
        setTimeout(() => {
            this.setupAdminMenu();
        }, 150);
        
        // Инициализация уведомлений
        setTimeout(() => {
            this.setupAdminMenu();
        }, 150);

        // НАЙТИ БЕЙДЖ СРАЗУ
        this.findOrCreateBadgeElement();

        // Инициализация уведомлений
        setTimeout(() => {
            const userData = this.getUserDataWithRetry();
            if (userData?.id) {
                this.initializeNotificationSystem();
            } else {
                const badge = document.getElementById('notificationsBadge');
                if (badge) {
                    badge.style.display = 'none';
                }
            }
        }, 200);
        
        this.setupBlockingHandlers();
        
        this.pageInitialized = true;
    }

    /**
     * Поиск или создание элемента бейджа
     */
    findOrCreateBadgeElement() {
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
        
        return badgeElement;
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
        
        const blockedLinks = sidebar.querySelectorAll(
            'a[href*="create-order"], a[href*="archived-orders"]'
        );
        
        blockedLinks.forEach(link => {
            link.setAttribute('data-blocking-check', 'true');
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
                } catch (e) {}
            }
            
            if (userData && userData.role) {
                return userData;
            }
            
            if (attempt < maxAttempts - 1) {
                const start = Date.now();
                while (Date.now() - start < delay) { /* wait */ }
            }
        }
        
        return null;
    }

    /**
     * Инициализация системы уведомлений
     */
    initializeNotificationSystem() {
        
        // Инициализируем менеджер уведомлений
        NotificationManager.init().then(manager => {
            
            // Отписываемся от предыдущих подписок
            if (this.notificationUnsubscribe) {
                this.notificationUnsubscribe();
            }
            
            // Подписываемся на обновления состояния
            this.notificationUnsubscribe = manager.on('notification_state_updated', (stats) => {
                updateNotificationBadge(stats.totalCount);
            });
            
            // Ждем загрузки уведомлений через проверку состояния
            const checkState = () => {
                import('../notification/notification-state.js').then(({ getNotificationStats }) => {
                    const stats = getNotificationStats();
                    
                    if (stats.totalCount > 0) {
                        // Уже загружены
                        updateNotificationBadge(stats.totalCount);
                    } else {
                        // Еще не загружены - проверяем снова через секунду
                        setTimeout(checkState, 1000);
                    }
                }).catch(() => {
                    setTimeout(checkState, 1000);
                });
            };
            
            // Начинаем проверку через секунду
            setTimeout(checkState, 1000);
            
        }).catch(err => {
            console.error('[SidebarManager] Ошибка инициализации NotificationManager:', err);
        });
    }


    /**
     * Очистка ресурсов
     */
    destroy() {
        if (this.notificationUnsubscribe) {
            this.notificationUnsubscribe();
            this.notificationUnsubscribe = null;
        }
        this.pageInitialized = false;
    }

    // ====== UI МЕТОДЫ ======

    setupBurgerButton() {
        const burgerBtn = document.getElementById('burgerBtn');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        if (burgerBtn && sidebar) {
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
                } catch (e) {}
            }
            
            const userRole = userData?.role;
            
            const usersLink = document.querySelector('a[href="users.html"]');
            const adminLink = document.querySelector('a[href="admin.html"]');
            
            if (userRole === 'Admin' || userRole === 'SuperAdmin') {
                document.body.classList.add('user-is-admin');
                
                if (usersLink) {
                    usersLink.style.display = 'block';
                    usersLink.classList.add('admin-only');
                }
                if (adminLink) {
                    adminLink.style.display = 'block';
                    adminLink.classList.add('admin-only');
                }
            } else {
                if (usersLink) usersLink.style.display = 'none';
                if (adminLink) adminLink.style.display = 'none';
            }
            
            document.body.classList.add(`user-role-${(userRole || 'unknown').toLowerCase()}`);
            
        } catch (error) {
            console.warn('SidebarManager: Error in setupAdminMenu:', error);
        }
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