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

async function handleLogin(e) {  // e — событие submit (event), async — для await API
    e.preventDefault();  // Шаг 1: Останавливаем стандартное поведение формы (не перезагружаем страницу)
    
    // Шаг 2: Получаем данные из полей (trim() убирает пробелы)
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;  // Пароль без trim, чтобы не сломать
    const submitButton = loginForm.querySelector('button[type="submit"]');  // Кнопка для loading

    // Шаг 3: Простая валидация (если поля пустые — ошибка, не отправляем)
    if (!username || !password) {
        showTempMessage('Заполните все поля', 'error');  // Toast-уведомление из utils.js
        return;  // Выходим, не продолжаем
    }

    try {  // Шаг 4: Основная логика (try — "попробуй", если ошибка — catch)
        // Показываем loading на кнопке (спиннер, disable)
        setLoadingState(submitButton, true);
        hideError();  // Скрываем старые ошибки (если были)

        // Шаг 5: Отправляем на API (await — ждём ответа от бэка)
        const result = await apiService.login({ username, password });  // api.js — твой сервис для POST /auth/login
        
        // Шаг 6: Если успех — сохраняем в localStorage (токен уже в apiService.setToken, но userData для UI)
        localStorage.setItem('userData', JSON.stringify({  // JSON.stringify — чтобы сохранить объект как строку
            id: result.id,
            username: result.username,
            fullName: result.fullName,  // Для показа "Привет, Иван!" в header
            role: result.role  // Для админ-меню (users.html)
        }));
        
        // Шаг 7: Редирект на дашборд (успех!)
        window.location.href = 'dashboard.html';
        
    } catch (error) {  // Шаг 8: Если API вернул ошибку (401/403 или сеть)
        
        // Шаг 9: Умная обработка (какой статус — такая ошибка)
        let errorMessage = 'Ошибка входа';  // Дефолт
        if (error.status === 401) {  // Неправильный логин/пароль
            errorMessage = 'Неверный логин или пароль';
        } else if (error.status === 403) {  // Заблокирован
            errorMessage = 'Аккаунт заблокирован';
        } else if (error.message) {  // Любая кастомная из API
            errorMessage = error.message;
        }
        
        showTempMessage(errorMessage, 'error');  // Toast с ошибкой (красный)
        
    } finally {  // Шаг 10: Всегда выполняется (успех или ошибка) — снимаем loading
        setLoadingState(submitButton, false);
    }
}

function checkExistingAuth() {
    // Если пользователь уже авторизован и находится на странице логина - редирект
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    
    if (token && userData && window.location.pathname.includes('login.html')) {
        window.location.href = 'dashboard.html';
    }
}

function setLoadingState(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');  // CSS spinner!
        button.textContent = 'Вход...';  // Text remains, spinner after
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.textContent = 'Войти';
    }
}

function hideError() {
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