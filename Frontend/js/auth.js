import { apiService } from './api.js';
import { showTempMessage, handleApiError } from './utils.js';

let submitDebounce = null;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    checkExistingAuth(); 
    if (loginForm) {
        loginForm.addEventListener('submit', handleSubmitDebounced);
    }
});

function handleSubmitDebounced(e) {
    e.preventDefault();
    if (submitDebounce) return;
    submitDebounce = setTimeout(() => { submitDebounce = null; }, 500);
    handleLogin(e);
}

async function handleLogin(e) {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const submitButton = document.querySelector('#loginForm button[type="submit"]');

    if (!username || !password) {
        showTempMessage('Заполните все поля', 'error');
        return;
    }

    try {
        setLoadingState(submitButton, true);

        const result = await apiService.login({ username, password });
        
        localStorage.setItem('userData', JSON.stringify({
            id: result.id,
            username: result.username,
            fullName: result.fullName,
            role: result.role
        }));
        window.location.href = 'dashboard.html';        
    } catch (error) {
        if (error.status === 401) {
            const serverMessage = error.data?.message || error.message || '';
            
            if (serverMessage.toLowerCase().includes('заблокирован') || 
                serverMessage.toLowerCase().includes('blocked') ||
                serverMessage.toLowerCase().includes('аккаунт')) {
                showTempMessage('Аккаунт заблокирован. Обратитесь к администратору.', 'error');
            } else {
                showTempMessage('Неверный логин или пароль', 'error');
            }
        } else {
            handleApiError(error); 
        }
    } finally {
        setLoadingState(submitButton, false);
    }
}

function checkExistingAuth() {
    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('userData');
    
    if (token && userDataStr && window.location.pathname.includes('login.html')) {
        try {
            JSON.parse(userDataStr);
            window.location.href = 'dashboard.html';
        } catch {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
        }
    }
}

function setLoadingState(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        button.textContent = 'Вход...';
        button.setAttribute('aria-busy', 'true');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.textContent = 'Войти';
        button.removeAttribute('aria-busy');
    }
}

export function checkAuth() {
    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('userData');
    
    if (!token || !userDataStr) {
        window.location.href = 'login.html';
        return null;
    }
    
    try {
        return JSON.parse(userDataStr);
    } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        window.location.href = 'login.html';
        return null;
    }
}

export function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('orderFilters');
    localStorage.removeItem('lastOrderView');
    
    apiService.logout().catch(console.warn);
    window.location.href = 'login.html';
}

window.checkAuth = checkAuth;
window.handleLogout = handleLogout;