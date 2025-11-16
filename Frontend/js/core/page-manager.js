import { apiService } from '../api/api.js';
import { 
    secureGetUserData, 
    secureGetToken,
    secureRemoveToken,
    handleApiError,
    initLayout 
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

            // Инициализация sidebar
            SidebarManager.init();

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