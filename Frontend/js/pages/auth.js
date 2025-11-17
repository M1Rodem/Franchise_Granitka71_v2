import { apiService } from '../api/api.js';
import { 
    showTempMessage, 
    handleApiError,
    secureSetToken,
    secureGetToken,
    secureRemoveToken,
    secureSetUserData,
    secureGetUserData,
    initTokenCleanup
} from '../utils/utils.js';

let submitDebounce = null;
let failedAttempts = 0;
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    checkExistingAuth(); 
    initTokenCleanup();
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleSubmitDebounced);
        
        const inputs = loginForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleSubmitDebounced(e);
                }
            });
        });
    }
});

function validateForm(username, password) {
    const errors = [];

     if (!username || username.length <= 0) {
        errors.push('Логин не может быть пустым');
    }

    if (!password || password.length < 8) {
        errors.push('Пароль должен содержать минимум 8 символа');
    }
    
    // Защита от SQL injection-like patterns (базовая)
    const suspiciousPatterns = /['";\\]|--|\/\*|\*\//;
    if (suspiciousPatterns.test(username)) {
        errors.push('Логин содержит недопустимые символы');
    }
    
    return errors;
}

function handleSubmitDebounced(e) {
    e.preventDefault();
    if (submitDebounce) return;
    submitDebounce = setTimeout(() => { submitDebounce = null; }, 500);
    handleLogin(e);
}

async function handleLogin(e) {
    const lockoutUntil = localStorage.getItem('loginLockout');
    if (lockoutUntil && Date.now() < parseInt(lockoutUntil)) {
        const minutesLeft = Math.ceil((parseInt(lockoutUntil) - Date.now()) / 60000);
        showTempMessage(`Слишком много попыток. Попробуйте через ${minutesLeft} минут`, 'error');
        return;
    }
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const submitButton = document.querySelector('#loginForm button[type="submit"]');

    // Валидация перед отправкой
    const validationErrors = validateForm(username, password);
    if (validationErrors.length > 0) {
        showTempMessage(validationErrors[0], 'error');
        return;
    }

    try {
        setLoadingState(submitButton, true);

        const result = await apiService.login({ username, password });
        
        // ЗАМЕНИТЬ: localStorage.setItem на безопасные функции
        if (!secureSetToken(result.token)) {
            throw new Error('Ошибка сохранения токена');
        }
        
        if (!secureSetUserData({
            id: result.id,
            username: result.username,
            fullName: result.fullName,
            role: result.role
        })) {
            throw new Error('Ошибка сохранения данных пользователя');
        }
        
        window.location.href = 'dashboard.html';        
    } catch (error) {
        failedAttempts++;
        secureRemoveToken();

        if (failedAttempts >= MAX_ATTEMPTS) {
            const lockoutTime = Date.now() + LOCKOUT_TIME;
            localStorage.setItem('loginLockout', lockoutTime.toString());
            showTempMessage('Слишком много попыток. Аккаунт временно заблокирован.', 'error');
            failedAttempts = 0;
        }
        
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
    const token = secureGetToken();
    const userData = secureGetUserData();
    
    if (token && userData && window.location.pathname.includes('login.html')) {
        try {
            window.location.href = 'dashboard.html';
        } catch {
            secureRemoveToken();
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
    const token = secureGetToken();
    const userData = secureGetUserData();
    
    if (!token || !userData) {
        window.location.href = 'login.html';
        return null;
    }
    
    try {
        return userData;
    } catch {
        secureRemoveToken();
        window.location.href = 'login.html';
        return null;
    }
}

export function handleLogout() {
    secureRemoveToken();
    localStorage.removeItem('lastOrderView');
    
    apiService.logout().catch(console.warn);
    window.location.href = 'login.html';
}

window.checkAuth = checkAuth;
window.handleLogout = handleLogout;