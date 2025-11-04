const API_BASE_URL = 'https://localhost:7137/api'; // Замени на prod URL в .env

import { showTempMessage } from './utils.js';

class ApiService {
    constructor() {
        this.token = localStorage.getItem('token');
        this.controller = new AbortController(); // Для timeout
        this.setupImageAuth();
    }

    // Основной request с timeout (5s) — без изменений
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const config = {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            if (response.status === 401 && !endpoint.includes('/Auth/login')) {
                this.handleUnauthorized();
                throw new Error('Требуется авторизация');
            }

            const data = await this.parseResponse(response);
            
            if (!response.ok) {
                throw this.createError(response, data);
            }

            return data;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Запрос прерван (timeout)');
            throw error;
        }
    }

    // Helpers (без изменений)
    async parseResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        return { message: await response.text() };
    }

    createError(response, data) {
        let message = data.message || `Ошибка ${response.status}`;
        if (data.errors && typeof data.errors === 'object') {
            const details = Object.entries(data.errors)
                .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                .join('\n');
            if (details) message += `\n${details}`;
        }
        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        return error;
    }

    handleUnauthorized() {
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        if (typeof handleLogout === 'function') {
            handleLogout();
        } else {
            window.location.href = 'login.html';
        }
    }

    // Auth (без изменений)
    async login(credentials) {
        const response = await fetch(`${API_BASE_URL}/Auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
            signal: new AbortController().signal // Timeout отдельно
        });

        const data = await response.json();
        
        if (!response.ok) {
            const error = new Error(data.message || `Ошибка ${response.status}`);
            error.status = response.status;
            throw error;
        }
        
        if (data.token) {
            this.setToken(data.token);
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

    // Profile (без изменений)
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

    // Orders (ФИКС: mapper для Status enum)
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
        
        // ✅ ФИКС: Сортировка
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
            // Запрашиваем ВСЕ заказы и фильтруем на клиенте
            const response = await this.request('/Orders?page=1&pageSize=1000');
            
            if (response && Array.isArray(response.items)) {
                // Фильтруем заказы где сумма платежей = 0
                const unpaidOrders = response.items.filter(order => {
                    const totalPaid = order.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
                    return totalPaid === 0;
                });
                
                return unpaidOrders.length;
            }
            return 0;
        } catch (error) {
            console.error('Error getting unpaid stats:', error);
            return 0;
        }
    }

    // Photos (без изменений)
    async uploadTempPhoto(file) {
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

    // Users (без изменений)
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

    // Utils
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    getCurrentUser() {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    }

    setupImageAuth() {
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            const [url, options = {}] = args;
            if (typeof url === 'string' && url.includes('/api/Photos/')) {
                options.headers = { ...options.headers, 'Authorization': `Bearer ${this.token}` };
                args[1] = options;
            }
            return originalFetch(...args);
        };
    }
}

export const apiService = new ApiService();