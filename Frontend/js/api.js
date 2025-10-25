// api.js
const API_BASE_URL = 'https://localhost:7137/api'; // или 'http://localhost:5137/api'

class ApiService {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    async testConnection() {
        try {
            const response = await fetch(`${API_BASE_URL}/test`);
            return response.ok;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
    
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
            
            if (response.status === 401) {
                this.logout();
                return;
            }

            let data;
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = { message: text };
            }
            
            if (!response.ok) {
                let msg = data.message || data.title || 'Ошибка сервера';
                if (data.errors && typeof data.errors === 'object') {
                    const details = Object.entries(data.errors)
                        .map(([k, v]) => `${k}: ${(Array.isArray(v)?v.join(', '):String(v))}`)
                        .join('\n');
                    if (details) msg += `\n${details}`;
                }
                const err = new Error(msg);
                err.status = response.status;
                throw err;
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Убраны ненужные методы getTempPreview и checkPhotoExists для оптимизации
    async getAuthorizedTempPreview(tempId) {
        try {
            const url = `${API_BASE_URL}/Photos/temp-preview/${tempId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load preview: ${response.status}`);
            }
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            return blobUrl;
        } catch (error) {
            console.error('❌ Ошибка загрузки временного фото:', error);
            throw error;
        }
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    logout() {
        this.token = null;
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    }

    // Auth
    async login(credentials) {
        return this.request('/Auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    }

    // Orders
    async getOrders() {
        const response = await this.request('/Orders');
        return response;
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

    // Photos (staging flow)
    async uploadTempPhoto(file) {
        try {
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
                const errorText = await response.text();
                throw new Error(`Upload failed: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Ошибка загрузки временного фото:', error);
            throw error;
        }
    }

    async commitPhotos(orderId, tempIds) {
        return this.request(`/Photos/move-temp-to-order/${orderId}`, {
            method: 'POST',
            body: JSON.stringify(tempIds)
        });
    }

    async uploadPhoto(orderId, file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${API_BASE_URL}/Photos/upload/${orderId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Ошибка загрузки фото в заказ:', error);
            throw error;
        }
    }

    async getOrderPhotos(orderId) {
        const photos = await this.request(`/Photos/order/${orderId}`);
        return photos;
    }

    async deletePhoto(photoId) {
        return this.request(`/Photos/${photoId}`, { method: 'DELETE' });
    }

    async deleteTempPhoto(tempId) {
        return this.request(`/Photos/temp/${tempId}`, { method: 'DELETE' });
    }

    // Users (admin)
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
}

const apiService = new ApiService();