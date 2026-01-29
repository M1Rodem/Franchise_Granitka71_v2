// JS/core/header-manager.js
import { apiService } from '../api/api.js';
import { secureGetUserData, initHeaderAdaptivity } from '../utils/utils.js';

export class HeaderManager {
    static async init() {
        await this.updateUserName();
        this.setupLogout();
        this.initAdaptivity();
    }

    static async updateUserName() {
        try {
            // Пробуем оба способа получения данных пользователя
            let userData = secureGetUserData();
            
            if (!userData) {
                // Fallback к API service
                userData = apiService.getCurrentUser?.();
            }

            if (!userData) {
                return;
            }

            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                const userName = userData.fullName || userData.username || 'Пользователь';
                
                // Обновляем текст
                userNameElement.textContent = userName;
                
                // Добавляем атрибуты для консистентности
                userNameElement.setAttribute('aria-label', `Профиль: ${userName}`);
                userNameElement.setAttribute('data-fullname', userName);
                
                // Добавляем класс для длинных имен
                if (userName.length > 20) {
                    userNameElement.classList.add('multiline');
                }
            }
        } catch (error) {
            console.error('[HeaderManager] Ошибка обновления имени пользователя:', error);
        }
    }

    static setupLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                apiService.logout();
            });
        }
    }

    static initAdaptivity() {
        // Инициализация адаптивности header (бургер-меню и т.д.)
        initHeaderAdaptivity?.();
    }

    // Дополнительные методы для будущего расширения
    static updateUserBadge(count) {
        const badge = document.getElementById('notificationsBadge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
    }

    static setPageTitle(title) {
        document.title = `${title} | Granitka71`;
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.textContent = title;
        }
    }
}

// Автоматическая инициализация при загрузке страницы
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => HeaderManager.init(), 0);
    });
}