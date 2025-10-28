const API_BASE_URL = 'https://localhost:7137/api';

class ApiService {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    // ОСНОВНОЙ МЕТОД ЗАПРОСА
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            
            // Автоматический logout при 401
            if (response.status === 401) {
                this.handleUnauthorized();
                throw new Error('Требуется авторизация');
            }

            const data = await this.parseResponse(response);
            
            if (!response.ok) {
                throw this.createError(response, data);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    async parseResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        return { message: await response.text() };
    }

    createError(response, data) {
        let message = data.message || data.title || `Ошибка ${response.status}`;
        
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
        window.location.href = 'login.html';
    }

    // АУТЕНТИФИКАЦИЯ
    async login(credentials) {
        const result = await this.request('/Auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        if (result.token) {
            this.setToken(result.token);
            // Сохраняем данные пользователя
            localStorage.setItem('userData', JSON.stringify({
                id: result.id,
                username: result.username,
                fullName: result.fullName,
                role: result.role
            }));
        }
        
        return result;
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

    // ПРОФИЛЬ
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

    // ЗАКАЗЫ С ПАГИНАЦИЕЙ
    async getOrders(filter = {}) {
        const queryParams = new URLSearchParams({
            page: filter.page || 1,
            pageSize: filter.pageSize || 10,
            ...filter
        }).toString();
        
        return this.request(`/Orders?${queryParams}`);
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

    // АРХИВ ЗАКАЗОВ
    async getArchivedOrders(filter = {}) {
        const queryParams = new URLSearchParams({
            page: filter.page || 1,
            pageSize: filter.pageSize || 10,
            ...filter
        }).toString();
        
        return this.request(`/Orders/archived?${queryParams}`);
    }

    async getArchivedOrder(id) {
        return this.request(`/Orders/archived/${id}`);
    }

    async restoreOrder(id) {
        return this.request(`/Orders/${id}/restore`, { method: 'POST' });
    }

    async permanentDeleteOrder(id) {
        return this.request(`/Orders/archived/${id}`, { method: 'DELETE' });
    }

    // ФОТОГРАФИИ
    async uploadTempPhoto(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE_URL}/Photos/upload-temp`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
        
        return await response.json();
    }

    async commitPhotos(orderId, tempIds) {
        return this.request(`/Photos/move-temp-to-order/${orderId}`, {
            method: 'POST',
            body: JSON.stringify(tempIds)
        });
    }

    async getOrderPhotos(orderId) {
        return this.request(`/Photos/order/${orderId}`);
    }

    async deletePhoto(photoId) {
        return this.request(`/Photos/edit/${photoId}`, { method: 'DELETE' });
    }

    async deleteTempPhoto(tempId) {
        return this.request(`/Photos/temp/${tempId}`, { method: 'DELETE' });
    }

    // НОВЫЙ МЕТОД ДЛЯ СКАЧИВАНИЯ ФОТО
    async downloadPhoto(photoId) {
        const response = await fetch(`${API_BASE_URL}/Photos/${photoId}/download`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        return url;
    }

    async getTempPreview(tempId) {
        const response = await fetch(`${API_BASE_URL}/Photos/temp-preview/${tempId}`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Preview failed: ${response.status}`);
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }

    // ПОЛЬЗОВАТЕЛИ (админ)
    async getUsers() {
        return this.request('/Users');
    }

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

    // Утилиты
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    getCurrentUser() {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    }

    isAdmin() {
        const user = this.getCurrentUser();
        return user && user.role === 'Admin';
    }
}

const apiService = new ApiService();