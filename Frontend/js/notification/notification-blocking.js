import { apiService } from '../api/api.js';
import { secureGetUserData, showTempMessage } from '../utils/utils.js';

/**
 * Основная функция проверки блокировки
 * @returns {Promise<{isBlocked: boolean, blockingCount: number, message: string|null} | null>}
 */
export async function checkBlocking() {
    try {
        // 1. Проверка роли пользователя (Admin/SuperAdmin пропускаются)
        const userData = secureGetUserData();
        
        if (!userData) {
            console.warn('[Blocking] Пользователь не авторизован');
            return null;
        }
        
        const userRole = userData.role;
        if (userRole === 'Admin' || userRole === 'SuperAdmin') {
            console.log(`[Blocking] Пользователь ${userRole} - пропуск проверки`);
            return {
                isBlocked: false,
                blockingCount: 0,
                message: null
            };
        }
        
        // 2. Вызов API проверки блокировки
        const response = await apiService.request('/notifications/check-blocking');
        
        console.log('[Blocking] Ответ от сервера:', response);
        
        return {
            isBlocked: response.isBlocked || false,
            blockingCount: response.blockingCount || 0,
            message: response.message || null
        };
        
    } catch (error) {
        console.error('[Blocking] Ошибка проверки блокировки:', error);
        
        // При ошибке API - разрешаем доступ (fail-open стратегия)
        showTempMessage('Ошибка проверки доступности. Попробуйте позже.', 'warning');
        
        return {
            isBlocked: false,
            blockingCount: 0,
            message: null
        };
    }
}

/**
 * Утилита для обработки навигации с проверкой блокировки
 * @param {Event} event - Событие клика
 * @param {string} targetUrl - URL для перехода при успешной проверке
 * @param {string} actionName - Название действия для логов
 */
export async function handleNavigationWithBlockingCheck(event, targetUrl, actionName = 'переход') {
    // Отменяем стандартное поведение (переход по ссылке)
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log(`[Blocking] Проверка блокировки для ${actionName}: ${targetUrl}`);
    
    const blockingResult = await checkBlocking();
    
    if (!blockingResult) {
        // Если результат null (не авторизован), редирект на логин
        window.location.href = 'login.html';
        return;
    }
    
    if (blockingResult.isBlocked) {
        // БЛОКИРОВКА: показываем сообщение и редирект на уведомления
        if (blockingResult.message) {
            showTempMessage(blockingResult.message, 'error');
        }
        
        console.log(`[Blocking] Блокировка! Редирект в уведомления. Count: ${blockingResult.blockingCount}`);
        
        // Редирект на страницу уведомлений
        setTimeout(() => {
            window.location.href = 'notifications.html';
        }, 1500);
        
    } else {
        // РАЗРЕШЕНО: выполняем переход
        console.log(`[Blocking] Разрешено. Выполняем ${actionName}`);
        
        if (targetUrl) {
            window.location.href = targetUrl;
        }
    }
}

/**
 * Инициализация глобальных обработчиков блокировки
 * Должна вызываться на каждой странице
 */
export function initBlockingHandlers() {
    console.log('[Blocking] Инициализация обработчиков блокировки');
    
    // Обработчик для ссылок в сайдбаре
    document.addEventListener('click', async (event) => {
        const link = event.target.closest('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        const page = link.getAttribute('data-page');
        
        // Проверяем только конкретные страницы
        if (href && (href.includes('create-order.html') || href.includes('archived-orders.html'))) {
            await handleNavigationWithBlockingCheck(
                event, 
                href,
                `перехода на страницу ${page || href}`
            );
        }
    });
    
    console.log('[Blocking] Обработчики инициализированы');
}