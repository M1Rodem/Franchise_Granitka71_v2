const API_BASE_URL = 'https://localhost:7137/api';  // Убедитесь, что URL правильный (ваш сервер)

class ApiService {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    // ОСНОВНОЙ МЕТОД ЗАПРОСА
    async request(endpoint, options = {}) 
    {
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
            
            // НЕ вызываем handleUnauthorized для эндпоинта логина
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
        if (typeof handleLogout === 'function') {
            handleLogout();
        } else {
            window.location.href = 'login.html';
        }
    }

    // АУТЕНТИФИКАЦИЯ
async login(credentials) {
    try {
        const response = await fetch(`${API_BASE_URL}/Auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        const data = await response.json();
        
        if (!response.ok) {
            // Создаем ошибку с статусом для правильной обработки
            const error = new Error(data.message || `Ошибка ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }
        
        if (data.token) {
            this.setToken(data.token);
            localStorage.setItem('userData', JSON.stringify({
                id: data.id,
                username: data.username,
                fullName: data.fullName,
                role: data.role
            }));
        }
        
        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
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

    // ЗАКАЗЫ
    async getOrders(filter = {}) {
        const params = new URLSearchParams(filter);
        return this.request(`/Orders?${params.toString()}`);
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

    // АРХИВ ЗАКАЗОВ (исправленные методы с правильными эндпоинтами)
    async getArchivedOrders(filter = {}) {
        const params = new URLSearchParams(filter);
        return this.request(`/Orders/archived?${params.toString()}`);
    }

    async getArchivedOrder(id) {
        return this.request(`/Orders/archived/${id}`);
    }

    async restoreArchivedOrder(id) {
        return this.request(`/Orders/${id}/restore`, { method: 'POST' });
    }

    async permanentDeleteArchivedOrder(id) {
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
        body: JSON.stringify(tempIds) // ДОЛЖЕН БЫТЬ МАССИВ ID
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
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo_${photoId}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

export const apiService = new ApiService();