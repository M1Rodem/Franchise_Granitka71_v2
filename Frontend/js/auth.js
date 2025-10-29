import { apiService } from './api.js';
import { showTempMessage } from './utils.js';

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');

    // Проверяем существующую авторизацию
    checkExistingAuth();

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const submitButton = loginForm.querySelector('button[type="submit"]');

    // Базовая валидация
    if (!username || !password) {
        showTempMessage('Заполните все поля', 'error');
        return;
    }

    try {
        // Показываем индикатор загрузки
        setLoadingState(submitButton, true);
        hideError();

        console.log('Попытка входа для пользователя:', username);
        const result = await apiService.login({ username, password });
        console.log('Успешный вход:', result);
        
        // Сохраняем данные пользователя (apiService.login уже setToken, но fullName для UI)
        localStorage.setItem('userData', JSON.stringify({
            id: result.id,
            username: result.username,
            fullName: result.fullName,
            role: result.role
        }));
        
        // Редирект на дашборд
        window.location.href = 'dashboard.html';
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        
        // Специфичная обработка ошибок
        let errorMessage = 'Ошибка входа';
        if (error.status === 401) {
            errorMessage = 'Неверный логин или пароль';
        } else if (error.status === 403) {
            errorMessage = 'Аккаунт заблокирован';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showTempMessage(errorMessage, 'error');
    } finally {
        // Снимаем индикатор загрузки
        setLoadingState(submitButton, false);
    }
}

function checkExistingAuth() {
    // Если пользователь уже авторизован и находится на странице логина - редирект
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    
    if (token && userData && window.location.pathname.includes('login.html')) {
        console.log('Пользователь уже авторизован, редирект на дашборд');
        window.location.href = 'dashboard.html';
    }
}

function setLoadingState(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.textContent = 'Вход...';
        button.style.opacity = '0.7';
    } else {
        button.disabled = false;
        button.textContent = 'Войти';
        button.style.opacity = '1';
    }
}

function hideError() {
    // Теперь toast, но если legacy div — hide
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
    }
}

// Глобальная функция для проверки авторизации на других страницах (экспорт для модулей)
export function checkAuth() {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
        // Если нет токена или данных пользователя - на логин
        window.location.href = 'login.html';
        return null;
    }
    
    try {
        return JSON.parse(userData);
    } catch (error) {
        console.error('Ошибка парсинга userData:', error);
        window.location.href = 'login.html';
        return null;
    }
}

// Функция для выхода (экспорт)
export function handleLogout() {
    // Очищаем все связанные данные
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('orderFilters');
    localStorage.removeItem('lastOrderView');
    
    // Делаем запрос на сервер для выхода
    apiService.logout().catch(error => {
        console.warn('Ошибка при выходе:', error);
    });
    
    // Редирект на страницу логина
    window.location.href = 'login.html';
}

// Глобальные для legacy (HTML onclick)
window.checkAuth = checkAuth;
window.handleLogout = handleLogout;