import { 
    secureGetUserData, 
    secureGetToken,
    handleApiError,
    initLayout,
    setupUserNameAdaptivity
} from '../utils/utils.js';
import { SidebarManager } from './sidebar-manager.js';

export class PageManager {
    static async initialize(pageType, initCallback = null) {
        try {
            // Проверка авторизации через безопасные функции
            const userData = secureGetUserData();
            const token = secureGetToken();
            
            if (!userData || !token) {
                window.location.href = 'login.html';
                return null;
            }

            // Инициализация layout (навигация, пользователь, logout)
            initLayout(userData, pageType);

            // ИНИЦИАЛИЗАЦИЯ АДАПТИВНОСТИ ФИО - ДОБАВЛЕНО
            setTimeout(() => {
                setupUserNameAdaptivity();
            }, 100);

            // ФИКС: Явная инициализация sidebar с проверкой
            if (typeof SidebarManager !== 'undefined') {
                SidebarManager.init();
            } else {
                console.error('SidebarManager not found');
            }

            // Вызов кастомной инициализации страницы
            if (initCallback) {
                await initCallback(userData);
            }

            return userData;
        } catch (error) {
            console.error(`${pageType} init error:`, error);
            handleApiError(error);
            return null;
        }
    }

    // Универсальная функция для загрузки данных с обработкой loading
    static async withLoading(loadingCallback, dataCallback) {
        try {
            if (loadingCallback) loadingCallback(true);
            const result = await dataCallback();
            return result;
        } catch (error) {
            handleApiError(error);
            throw error;
        } finally {
            if (loadingCallback) loadingCallback(false);
        }
    }
}