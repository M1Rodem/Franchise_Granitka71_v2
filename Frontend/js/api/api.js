const API_BASE_URL = '/api';

import { 
    secureGetToken,
    secureSetToken,
    secureRemoveToken,
    secureSetUserData,
    secureGetUserData, 
    showTempMessage 
} from '../utils/utils.js';

class ApiService {
    constructor() {
        this.refreshToken();
        this.controller = new AbortController();
        this.setupImageAuth();
    }

    refreshToken() {
        this.token = secureGetToken();
    }

    // Основной request с timeout (5s)
    async request(endpoint, options = {}) {
        
        const url = `${API_BASE_URL}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // СОЗДАЕМ HEADERS ОДИН РАЗ
        const headers = { 
            'Content-Type': 'application/json', 
            ...options.headers 
        };

        // ДОБАВЛЯЕМ AUTHORIZATION
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            signal: controller.signal,
            headers: headers,
            ...options
        }

        try {
            const response = await fetch(url, config);
            
            clearTimeout(timeoutId);

            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                showTempMessage(`Слишком много запросов. Попробуйте через ${retryAfter || 60} секунд`, 'error');
                throw new Error('Rate limit exceeded');
            }

            const data = await this.parseResponse(response);
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.handleUnauthorized();
                    throw this.createError(response, data);
                }
                throw this.createError(response, data);
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (!navigator.onLine) {
                showTempMessage('Нет подключения к интернету', 'error');
                throw new Error('Offline mode');
            }
            
            if (error.name === 'AbortError') throw new Error('Запрос прерван (timeout)');
            throw error;
        }
    }
    
    /**
     * НОВЫЙ МЕТОД: Добавление платежа к заказу
     */
    async addPayment(orderId, paymentData) {
        return this.request(`/Orders/${orderId}/payments`, {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    async requestWithRetry(endpoint, options = {}, maxRetries = 2) {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.request(endpoint, options);
            } catch (error) {
                lastError = error;
                
                // Не повторяем для 4xx ошибок (кроме 429)
                if (error.status >= 400 && error.status < 500 && error.status !== 429) {
                    break;
                }
                
                // Ждем перед повторной попыткой
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        
        throw lastError;
    }

    async cleanupTempMedia(tempIds) {
        return this.request('/media/cleanup', {
            method: 'POST',
            body: JSON.stringify({ tempIds })
        });
    }
    
    // Helpers
        async parseResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        try {
            if (contentType.includes('application/json')) {
                return await response.json();
            }
            return { message: await response.text() };
        } catch (error) {
            console.error('Ошибка парсинга ответа:', error);
            // Возвращаем структурированную ошибку вместо падения
            return { 
                error: true, 
                message: `Ошибка обработки ответа: ${error.message}`,
                status: response.status
            };
        }
    }

    createError(response, data) {
        if (!data || typeof data !== 'object') {
            data = { message: `Ошибка ${response.status}` };
        }
        
        let message = data.message || `Ошибка ${response.status}`;
        if (data.errors && typeof data.errors === 'object') {
            const details = Object.entries(data.errors)
                .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                .join('\n');
            if (details) message += `\n${details}`;
        }
        
        // Дополнительная информация из не-JSON ответов
        if (typeof data === 'string') {
            message = data;
        }
        
        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        return error;
    }

    handleUnauthorized() {
        this.token = null;
        secureRemoveToken();
        
        if (!window.location.pathname.includes('login.html')) {
            if (typeof handleLogout === 'function') {
                handleLogout();
            } else {
                window.location.href = 'login.html';
            }
        }
    }

    // Auth
    async login(credentials) {
        const response = await fetch(`${API_BASE_URL}/Auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
            signal: new AbortController().signal
        });

        // ФИКС: Проверяем, что ответ есть и его можно парсить как JSON
        let data;
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // Если не JSON, пытаемся получить текст
                const text = await response.text();
                data = { message: text || 'Ошибка авторизации' };
            }
        } catch (parseError) {
            console.error('Ошибка парсинга ответа:', parseError);
            data = { 
                message: `Ошибка сервера: ${parseError.message || 'Некорректный ответ'}`
            };
        }
        
        if (!response.ok) {
            const error = new Error(data.message || `Ошибка ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }
        
        if (data.token) {
            this.setToken(data.token);
            // СОХРАНЯЕМ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ С РОЛЬЮ
            secureSetUserData({
                id: data.id,
                username: data.username,
                fullName: data.fullName,
                role: data.role // Важно: 'Manager', 'Admin' или 'SuperAdmin'
            });
        } else if (!data.token && response.ok) {
            // Если ответ успешный, но нет токена - это странно
            console.warn('Login successful but no token received');
            throw new Error('Отсутствует токен авторизации в ответе сервера');
        }
        
        return data;
    }

    async logout() {
        try {
            await this.request('/Auth/logout', { method: 'POST' });
        } catch (error) {
            console.warn('Logout request failed:', error);
        } finally {
            this.handleUnauthorized();
        }
    }

    // Profile
    async getMyProfile() {
        return this.request('/Profile');
    }

    async changePassword(passwordData) {
        return this.request('/Profile/change-password', {
            method: 'POST',
            body: JSON.stringify(passwordData)
        });
    }

    async updateProfile(profileData) {
        return this.request('/Profile/update-profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    // Orders (с mapper для Status enum)
    async getOrders(filter) {
        const params = new URLSearchParams();
        
        // Базовые параметры пагинации
        params.append('Page', filter.page || 1);
        params.append('PageSize', filter.pageSize || 20);
        
        // Поиск
        if (filter.SearchQuery) {
            params.append('SearchQuery', filter.SearchQuery);
        }
        
        // Статус оплаты
        if (filter.PaymentStatus !== undefined && filter.PaymentStatus !== null) {
            params.append('PaymentStatus', filter.PaymentStatus);
        }
        
        // Статус заказа
        if (filter.Status !== undefined && filter.Status !== null) {
            params.append('Status', filter.Status);
        }
        
        // Дата заказа
        if (filter.OrderDateFrom) {
            params.append('OrderDateFrom', filter.OrderDateFrom);
        }
        if (filter.OrderDateTo) {
            params.append('OrderDateTo', filter.OrderDateTo);
        }
        
        // Сортировка
        if (filter.sortBy) {
            params.append('sortBy', filter.sortBy);
        }
        if (filter.sortDesc !== undefined) {
            params.append('sortDesc', filter.sortDesc);
        }
        return this.request(`/Orders?${params}`);
    }

    async getOrder(id) {
        return this.request(`/Orders/${id}`);
    }

    async createOrder(orderData) {
        return this.request('/Orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    async updateOrder(id, orderData) {
        return this.request(`/Orders/${id}`, {
            method: 'PUT',
            body: JSON.stringify(orderData)
        });
    }

    async deleteOrder(id) {
        return this.request(`/Orders/${id}`, { method: 'DELETE' });
    }

    // Archived
    async getArchivedOrders(filter) {
        const params = new URLSearchParams(filter);
        return this.request(`/Orders/archived?${params.toString()}`);
    }

    async getArchivedOrder(id) {
        return this.request(`/Orders/archived/${id}`);
    }

    async restoreArchivedOrder(id) {
        return this.request(`/Orders/${id}/restore`, {
            method: 'POST'
        });
    }

    async permanentDeleteArchivedOrder(id) {
        return this.request(`/Orders/archived/${id}`, {
            method: 'DELETE'
        });
    }

    async getUnpaidOrdersStats() {
        try {
            // Используем фильтр по PaymentStatus=1 (Аванс)
            const response = await this.request('/Orders?page=1&pageSize=1000&PaymentStatus=1');
            
            if (response && response.totalCount !== undefined) {
                // Сервер возвращает totalCount - общее количество с учетом фильтра
                return response.totalCount;
            } else if (response && Array.isArray(response.items)) {
                // Fallback если сервер не поддерживает totalCount
                return response.items.length;
            }
            return 0;
        } catch (error) {
            console.error('Error getting unpaid stats:', error);
            return 0;
        }
    }

    // Photos
    async uploadTempPhoto(file) {
        // Валидация размера файла (макс 20MB)
        const MAX_SIZE = 20 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            throw new Error(`Файл слишком большой (макс: ${MAX_SIZE / 1024 / 1024}MB)`);
        }
        
        // Валидация типа файла - полный список изображений
        const allowedTypes = [
            'image/jpeg',      // JPEG
            'image/png',       // PNG
            'image/webp',      // WebP
            'image/gif',       // GIF
            'image/bmp',       // BMP
            'image/tiff',      // TIFF
            'image/svg+xml',   // SVG
            'image/heic',      // HEIC
            'image/heif',      // HEIF
            'image/avif'       // AVIF
        ];
        
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Разрешены только файлы изображений: JPG, PNG, WebP, GIF, BMP, TIFF, SVG, HEIC, HEIF, AVIF');
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE_URL}/Photos/upload-temp`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData,
            signal: new AbortController().signal
        });

        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        return await response.json();
    }

    async commitPhotos(orderId, tempIds) {
        return this.request(`/Photos/move-temp-to-order/${orderId}`, {
            method: 'POST',
            body: JSON.stringify(tempIds)
        });
    }

    async getTempPreview(tempId) {
        const response = await fetch(`${API_BASE_URL}/Photos/temp-preview/${tempId}`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Temp preview failed: ${response.status}`);
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }

    async getPhotoUrl(photoId) {
        const response = await fetch(`${API_BASE_URL}/Photos/${photoId}/file`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Photo load failed: ${response.status}`);
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }

    async downloadPhoto(photoId, fileName = 'photo.jpg') {
        try {
            // ПОЛУЧАЕМ BLOB ОБЪЕКТ, а не URL
            const response = await fetch(`${API_BASE_URL}/Photos/${photoId}/file`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Photo load failed: ${response.status}`);
            }

            const blob = await response.blob();
            
            // Создаём временную URL для скачивания
            const url = URL.createObjectURL(blob);
            
            // Создаём скрытую ссылку и триггерим клик
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Чистим URL
            URL.revokeObjectURL(url);
            
            showTempMessage(`Скачано: ${fileName}`, 'success');
            return { success: true };
        } catch (error) {
            console.error('Download photo error:', error);
            showTempMessage('Ошибка скачивания фото: ' + error.message, 'error');
            throw error;
        }
    }

    async deleteTempPhoto(tempId) {
        return this.request(`/Photos/temp/${tempId}`, { method: 'DELETE' });
    }

    async deleteOrderPhoto(photoId) {
        return this.request(`/Photos/edit/${photoId}`, { method: 'DELETE' });
    }
    // ====== МЕДИА (обновленные методы) ======

    /**
     * Загрузка временного медиафайла
     */
    async uploadTempMedia(file, type = 'photo') {
        // Валидация размера файла (макс 500MB)
        const MAX_SIZE = 500 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            throw new Error(`Файл слишком большой (макс: ${MAX_SIZE / 1024 / 1024}MB)`);
        }
        
        // Получаем лимиты для валидации
        const limits = await this.getMediaLimits();
        const typeLimits = limits[type];
        
        if (!typeLimits) {
            throw new Error(`Тип медиа "${type}" не поддерживается`);
        }
        
        // Валидация MIME-типа
        if (!typeLimits.allowedMimeTypes.includes(file.type)) {
            throw new Error(`Неподдерживаемый формат файла. Разрешены: ${typeLimits.allowedMimeTypes.join(', ')}`);
        }
        
        // Загрузка файла
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE_URL}/media/upload-temp?type=${type}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData,
            signal: new AbortController().signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upload failed:', response.status, errorText);
            throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }
        return await response.json();
    }

    /**
     * Получение URL превью временного медиа
     */
    async getTempMediaPreview(tempId) {
        try {
            const response = await fetch(`${API_BASE_URL}/media/temp-preview/${tempId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Temp preview failed: ${response.status}`);
            }

            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('getTempMediaPreview error:', error);
            throw error;
        }
    }

    /**
     * Удаление временного медиа
     */
    async deleteTempMedia(tempId) {
        return this.request(`/media/temp/${tempId}`, { method: 'DELETE' });
    }

    /**
     * Получение URL медиа файла
     */
    async getMediaUrl(mediaId) {
        try {
            const response = await fetch(`${API_BASE_URL}/media/${mediaId}/file`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Media load failed: ${response.status}`);
            }

            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('getMediaUrl error:', error);
            throw error;
        }
    }

    /**
     * Для обратной совместимости оставляем старый метод, но перенаправляем на новый
     */
    async uploadTempPhoto(file) {
        return this.uploadTempMedia(file, 'photo');
    }

    /**
     * Для обратной совместимости
     */
    async getTempPreview(tempId) {
        // Перенаправляем на новый метод
        console.warn('getTempPreview is deprecated, use getTempMediaPreview instead');
        return this.getTempMediaPreview(tempId);
    }

    /**
     * Для обратной совместимости
     */
    async getPhotoUrl(photoId) {
        // Перенаправляем на новый метод
        console.warn('getPhotoUrl is deprecated, use getMediaUrl instead');
        return this.getMediaUrl(photoId);
    }

    /**
     * Для обратной совместимости
     */
    async deleteTempPhoto(tempId) {
        // Перенаправляем на новый метод
        console.warn('deleteTempPhoto is deprecated, use deleteTempMedia instead');
        return this.deleteTempMedia(tempId);
    }

    /**
     * Обновляем setupImageAuth для поддержки media
     */
    setupImageAuth() {
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            const [url, options = {}] = args;
            // ОБНОВЛЕНО: добавляем поддержку media
            if (typeof url === 'string' && 
                (url.includes(`${API_BASE_URL}/Photos/`) || url.includes(`${API_BASE_URL}/media/`))) {
                options.headers = { ...options.headers, 'Authorization': `Bearer ${this.token}` };
                args[1] = options;
            }
            return originalFetch(...args);
        };
    }

    // Users
    async getUsers() { return this.request('/Users'); }

    async createUser(userData) {
        return this.request('/Users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateUser(id, userData) {
        return this.request(`/Users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(id) {
        return this.request(`/Users/${id}`, { method: 'DELETE' });
    }

    async changeUserRole(id, role) {
        return this.request(`/Users/${id}/change-role`, {
            method: 'POST',
            body: JSON.stringify({ role })
        });
    }

    async blockUser(id) {
        return this.request(`/Users/${id}/block`, { method: 'POST' });
    }

    async unblockUser(id) {
        return this.request(`/Users/${id}/unblock`, { method: 'POST' });
    }

    // Notifications
    async getNotifications(options = {}) {
        const { 
            status = 'active',  // "active", "postponed", "pending", "approved", "rejected", "all"
            page = 1, 
            pageSize = 20 
        } = options;
        
        const params = new URLSearchParams();
        params.append('status', status);
        params.append('page', page);
        params.append('pageSize', pageSize);
        
        return this.request(`/notifications?${params.toString()}`);
    }

    async getUnreadNotificationsCount() {
        const response = await this.request('/notifications/count');
        // Ответ от бэкенда: { count: 5 }
        return response;
    }

    async resolveNotification(id, status, note = '') {
        // Конвертируем числовой статус в строковый по enum
        let statusString;
        switch(status) {
            case 0: statusString = "Pending"; break;
            case 1: statusString = "Approved"; break; // "Принять"
            case 2: statusString = "Rejected"; break; // "Отклонить"
            case 3: statusString = "Postponed"; break; // "Отложить"
            default: statusString = "Pending";
        }
        
        // ПРАВИЛЬНАЯ структура согласно ResolveNotificationRequest
        const body = {
            status: statusString,  // Обязательное поле: "Approved" или "Rejected"
            note: note || null      // Опциональное поле
        };
        return this.request(`/notifications/${id}/resolve`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }
    
    async postponeNotification(id, minutes = 30, reason = '') {
        // Согласно PostponeNotificationRequest
        const body = {
            minutes: minutes,  // По умолчанию 30
            reason: reason || null
        };
        
        return this.request(`/notifications/${id}/postpone`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }
    // Utils
    setToken(token) {
        if (secureSetToken(token)) {
            this.token = token;
            return true;
        }
        return false;
    }

    getCurrentUser() {
        return secureGetUserData();
    }

    setupImageAuth() {
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            const [url, options = {}] = args;
            if (typeof url === 'string' && url.includes(`${API_BASE_URL}Photos/`)) {
                options.headers = { ...options.headers, 'Authorization': `Bearer ${this.token}` };
                args[1] = options;
            }
            return originalFetch(...args);
        };
    }

    async downloadOrderExcel(orderId) {
        const response = await fetch(`/api/Print/order/${orderId}/download`, { 
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }

        return response;
    }

    async getOrderHtmlPrint(orderId) {
        const response = await fetch(`/api/Print/order/${orderId}/html-print`, { // Вернул /html-print
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'text/html'
            }
        });

        if (!response.ok) {
            throw new Error(`HTML print failed: ${response.status}`);
        }

        return response.text();
    }

    async getUsersPaged(filter = {}) {
        const params = new URLSearchParams();
        
        // Базовые параметры пагинации
        params.append('page', filter.page || 1);
        params.append('pageSize', filter.pageSize || 10);
        
        // Поиск
        if (filter.search) {
            params.append('search', filter.search);
        }
        
        return this.request(`/Users/paged?${params}`);
    }

    // ====== УЧАСТКИ (PLOTS) ======
    async getPlots(includeInactive = false) {
        return this.request(`/plots?includeInactive=${includeInactive}`);
    }

    // ====== МЕДИА (расширение для видео) ======
    async getMediaLimits() {
        return this.request('/media/types');
    }

    async uploadTempFile(file, type = 'photo') {
        // Валидация размера файла (макс 500MB)
        const MAX_SIZE = 500 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            throw new Error(`Файл слишком большой (макс: ${MAX_SIZE / 1024 / 1024}MB)`);
        }
        
        // Получаем лимиты для валидации
        const limits = await this.getMediaLimits();
        const typeLimits = limits[type];
        
        if (!typeLimits) {
            throw new Error(`Тип медиа "${type}" не поддерживается`);
        }
        
        // Валидация MIME-типа
        if (!typeLimits.allowedMimeTypes.includes(file.type)) {
            throw new Error(`Неподдерживаемый формат файла. Разрешены: ${typeLimits.allowedMimeTypes.join(', ')}`);
        }
        
        // Загрузка файла
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE_URL}/media/upload-temp?type=${type}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData,
            signal: new AbortController().signal
        });

        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        return await response.json();
    }

    // Для обратной совместимости оставляем старый метод
    async uploadTempPhoto(file) {
        return this.uploadTempFile(file, 'photo');
    }
}

export const apiService = new ApiService();