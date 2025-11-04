import { apiService } from './api.js';
import { initLayout, handleApiError } from './utils.js';

export class PageManager {
    static async initialize(pageType, initCallback = null) {
        try {
            // Проверка авторизации
            const userData = apiService.getCurrentUser();
            if (!userData) {
                window.location.href = 'login.html';
                return null;
            }

            // Инициализация layout (навигация, пользователь, logout)
            initLayout(userData, pageType);

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