// ====== НОВЫЕ КОНСТАНТЫ СТАТУСОВ ОПЛАТЫ ======
export const PAYMENT_STATUS = {
    ALL: 0,
    ADVANCE: 1,
    PARTIALLY_PAID: 2,
    FULLY_PAID: 3
};

export const PAYMENT_STATUS_TEXT = {
    [PAYMENT_STATUS.ALL]: 'Все',
    [PAYMENT_STATUS.ADVANCE]: 'Аванс',
    [PAYMENT_STATUS.PARTIALLY_PAID]: 'Частично оплачен',
    [PAYMENT_STATUS.FULLY_PAID]: 'Оплачен'
};

export const PAYMENT_STATUS_BADGE_CLASS = {
    [PAYMENT_STATUS.ADVANCE]: 'status-advance',
    [PAYMENT_STATUS.PARTIALLY_PAID]: 'status-partial',
    [PAYMENT_STATUS.FULLY_PAID]: 'status-paid'
};

// ====== ФОРМАТИРОВАНИЕ ======
export function formatDate(dateString) {
    if (!dateString) return '—';
    try { return new Date(dateString).toLocaleDateString('ru-RU'); } catch { return '—'; }
}

export function formatPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7,9)}-${digits.slice(9)}`;
    if (digits.length === 10) return `+7 (${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,8)}-${digits.slice(8)}`;
    return phone;
}

export function normalizePhone(phone) {
    return phone ? String(phone).trim().replace(/\D/g, '') : '';
}

export function formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '0 ₽';
    return `${Math.abs(Number(amount)).toLocaleString('ru-RU')} ₽`;
}

// ====== БЕЗОПАСНОСТЬ HTML ======
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function sanitizeInput(input) {
    return input ? String(input).trim().replace(/[<>]/g, '') : '';
}

// ====== РАБОТА С ФОРМАМИ ======
export function getFormValue(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return '';
    return (element.value || element.textContent || '').trim();
}

export function setFormValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.value = value || '';
}

export function valueOrNull(id) {
    const v = getFormValue(id);
    return v === '' ? null : v;
}

export function clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) form.reset();
}

export function populateForm(formId, data) {
    const form = document.getElementById(formId);
    if (!form || !data) return;
    Object.entries(data).forEach(([key, value]) => {
        const input = form.querySelector(`[name="${key}"]`) || document.getElementById(key);
        if (input) {
            if (input.type === 'checkbox') input.checked = !!value;
            else input.value = value || '';
        }
    });
}

// ====== ВРЕМЕННЫЕ СООБЩЕНИЯ (TOASTS) ======
export function showTempMessage(message, type = 'success', duration = 3000) {
    // Удаляем старое
    document.querySelectorAll('.temp-message').forEach(el => el.remove());

    const messageEl = document.createElement('div');
    messageEl.className = `temp-message temp-message-${type}`;
    messageEl.setAttribute('role', 'alert');
    messageEl.innerHTML = `<span>${escapeHtml(message)}</span><button class="close" aria-label="Закрыть">×</button>`;
    
    // Закрытие
    messageEl.querySelector('.close').addEventListener('click', () => {
        messageEl.classList.add('hiding');
        setTimeout(() => messageEl.remove(), 350);
    });

    document.body.appendChild(messageEl);

    // Вход
    requestAnimationFrame(() => {
        messageEl.classList.add('show');
    });

    // Авто-исчезновение
    setTimeout(() => {
        messageEl.classList.remove('show');
        messageEl.classList.add('hiding');
        setTimeout(() => messageEl.remove(), 350);
    }, duration);
}

// ====== DOM UTILS ======
export function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

export function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

export function toggleElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }
}

export function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = text;
}

// ====== СТАТУСЫ ЗАКАЗОВ ======
export function getPaymentStatus(order) {
    // Если есть поле paymentStatus от сервера - используем его
    if (order?.paymentStatus !== undefined && order?.paymentStatus !== null) {
        // Конвертируем число в строковый статус для обратной совместимости
        const statusMap = {
            1: 'advance',
            2: 'partial',
            3: 'paid'
        };
        return statusMap[order.paymentStatus] || 'not_paid';
    }
    
    // Fallback на старую логику для старых заказов
    if (!order?.payments) return 'not_paid';
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPrice = (order.workItems || []).reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
    
    if (totalPaid === 0) return 'not_paid';
    if (totalPaid < totalPrice) return 'partial';
    if (totalPaid === totalPrice) return 'paid';
    if (totalPaid > totalPrice) return 'overpaid';
    return 'not_paid';
}

export function getPaymentStatusText(order) {
    if (order?.paymentStatus !== undefined && order?.paymentStatus !== null) {
        return PAYMENT_STATUS_TEXT[order.paymentStatus] || 'Не оплачено';
    }
    
    // Fallback на старую логику
    const statusMap = {
        'not_paid': 'Не оплачено',
        'partial': 'Частично оплачено', 
        'paid': 'Оплачено',
        'overpaid': 'Переплачено',
        'advance': 'Аванс (0–30%)'
    };
    return statusMap[getPaymentStatus(order)] || 'Не оплачено';
}

export function getStatusBadgeClass(status) {
    const classMap = {
        'not_paid': 'status-not_paid',
        'partial': 'status-partial', 
        'paid': 'status-paid',
        'overpaid': 'status-overpaid',
        'advance': 'status-advance',
        'Новый': 'status-new',
        // Числовые статусы
        1: 'status-advance',
        2: 'status-partial',
        3: 'status-paid'
    };
    return classMap[status] || 'status-not_paid';
}

// ====== ПОЛУЧЕНИЕ ИМЕНИ МЕНЕДЖЕРА ИЗ ЗАКАЗА ======
export function getUserNameFromOrder(order) {
    return order?.managerFullName || 'Неизвестно';
}

export function isAdmin() {
    const user = secureGetUserData();
    // Проверяем Admin ИЛИ SuperAdmin
    return user?.role === 'Admin' || user?.role === 'SuperAdmin';
}

// ДОБАВЛЯЕМ НОВУЮ ФУНКЦИЮ ДЛЯ ПРОВЕРКИ SuperAdmin
export function isSuperAdmin() {
    const user = secureGetUserData();
    return user?.role === 'SuperAdmin';
}

// ДОБАВЛЯЕМ ФУНКЦИЮ ДЛЯ ПРОВЕРКИ ЛЮБОЙ РОЛИ
export function getUserRole() {
    const user = secureGetUserData();
    return user?.role || 'Manager'; // По умолчанию Manager
}


// ====== Проверка и очистка устаревших токенов при загрузке приложения ======
export function initTokenCleanup() {
    // Проверяем токен при загрузке
    const token = secureGetToken();
    const userData = secureGetUserData();
    
    if ((!token || !userData) && !window.location.pathname.includes('login.html')) {
        // Если нет валидного токена, но мы не на странице логина - редирект
        secureRemoveToken();
        window.location.href = 'login.html';
    }
}

// ====== URL И ПАРАМЕТРЫ ======
export function getUrlParam(param) {
    return new URLSearchParams(window.location.search).get(param);
}

export function updateUrlParam(param, value) {
    const url = new URL(window.location);
    if (value) url.searchParams.set(param, value);
    else url.searchParams.delete(param);
    window.history.pushState({}, '', url);
}

// ====== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ======
export function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Storage save error:', error);
        return false;
    }
}

export function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Storage load error:', error);
        return null;
    }
}

export function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Storage remove error:', error);
        return false;
    }
}

export function secureSetToken(token) {
    try {
        if (!token || typeof token !== 'string') {
            return false;
        }
        
        // Декодируем JWT для проверки expiration
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                return false;
            }
        } catch (e) {
        }
        
        const secureToken = {
            value: token,
            timestamp: Date.now(),
            signature: btoa(token.slice(-10) + Date.now()).slice(0, 20)
        };
        
        localStorage.setItem('token', JSON.stringify(secureToken));
        return true;
    } catch (error) {
        return false;
    }
}

export function secureGetToken() {
    try {
        const stored = localStorage.getItem('token');
        if (!stored) return null;
        
        const secureToken = JSON.parse(stored);
        const actualToken = secureToken.value;
        
        if (!actualToken) return null;
        
        try {
            const parts = actualToken.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                if (payload.exp && payload.exp * 1000 < Date.now()) {
                    secureRemoveToken();
                    return null;
                }
            }
        } catch (e) {
        }
        
        return actualToken;
        
    } catch (error) {
        return null;
    }
}

export function secureRemoveToken() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        localStorage.removeItem('orderFilters');
        localStorage.removeItem('lastOrderView');
        return true;
    } catch (error) {
        console.error('Token removal error:', error);
        return false;
    }
}

export function secureSetUserData(userData) {
    try {
        if (!userData || typeof userData !== 'object') {
            console.error('Invalid user data provided');
            return false;
        }
        
        const safeUserData = {
            id: userData.id,
            username: userData.username,
            fullName: userData.fullName,
            role: userData.role,
            timestamp: Date.now()
        };
        
        localStorage.setItem('userData', JSON.stringify(safeUserData));
        return true;
    } catch (error) {
        console.error('User data storage error:', error);
        return false;
    }
}

export function secureGetUserData() {
    try {
        const stored = localStorage.getItem('userData');
        if (!stored) return null;
        
        const userData = JSON.parse(stored);
        
        return userData;
    } catch (error) {
        console.error('User data retrieval error:', error);
        return null;
    }
}

// ====== CSRF ЗАЩИТА ======
let csrfToken = '';

/**
 * Установка CSRF токена
 */
export function setCsrfToken(token) {
    if (token && typeof token === 'string') {
        csrfToken = token;
        return true;
    }
    return false;
}

/**
 * Получение CSRF токена
 */
export function getCsrfToken() {
    return csrfToken;
}

/**
 * Проверка валидности CSRF токена
 */
export function isValidCsrfToken(token) {
    if (!token || typeof token !== 'string') return false;
    if (token.length < 10 || token.length > 100) return false; // Базовые проверки длины
    return /^[a-zA-Z0-9_-]+$/.test(token); // Разрешаем только безопасные символы
}

/**
 * Очистка CSRF токена
 */
export function clearCsrfToken() {
    csrfToken = '';
}

// ====== ОБРАБОТКА ОШИБОК ======
export function handleApiError(error) {
    console.error('API Error:', error);
    
    let message = 'Произошла ошибка';
    if (error.status === 401) {
        message = 'Требуется авторизация';
        // handleLogout из auth.js (fallback)
        if (typeof window.handleLogout === 'function') window.handleLogout();
    } else if (error.status === 403) {
        message = 'Доступ запрещен';
    } else if (error.message) {
        message = error.message;
    }
    
    showTempMessage(message, 'error');
    return message;
}

// ====== МАППЕР ДЛЯ ENUM БЭКА ======
export function mapStatusToEnum(status) {
    const map = {
        'all': 0,           // Все
        'advance': 1,       // Аванс (было not_paid)
        'partial': 2,       // Частично
        'paid': 3,          // Оплачен
        // Для обратной совместимости со старыми значениями
        'not_paid': 1,      // NotPaid теперь маппится в Advance
        'overpaid': 3       // Overpaid теперь маппится в FullyPaid
    };
    return map[status] ?? null;
}

// ====== ЛAYOUT & NAVIGATION ======
export function initLayout(userData, pageType = 'default') {
    // User UI
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.fullName || userData.username || 'Пользователь';
    }

    // Admin toggle - для Admin И SuperAdmin
    if (userData.role === 'Admin' || userData.role === 'SuperAdmin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    }

    // Logout - используем безопасную функцию
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        // ФИКС: Удаляем старые обработчики и добавляем новый
        logoutBtn.replaceWith(logoutBtn.cloneNode(true));
        const newLogoutBtn = document.getElementById('logoutBtn');
        
        newLogoutBtn.addEventListener('click', () => {
            secureRemoveToken();
            window.location.href = 'login.html';
        });
    }
}

// ====== УТИЛИТЫ ======

export function isToday(dateString) {
    if (!dateString) return false;
    const today = new Date().toDateString();
    const orderDate = new Date(dateString).toDateString();
    return today === orderDate;
}

export function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// ====== ДАТЫ ======
export function getTodayDate() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// ====== ВАЛИДАЦИЯ ======
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export { isValidPhone } from './phone-mask.js';

export function getOrderStatusText(status) {
    const map = {
        0: 'Новый',
        1: 'В работе',
        2: 'Завершен',
        3: 'Отменен'  // Расширьте по enum OrderStatus из бэка (из OrdersController: OrderStatus.Новый = 0, etc.)
    };
    return map[status] || 'Неизвестно';
}

export function getOrderStatusBadge(status) {
    const map = {
        0: 'bg-info',
        1: 'bg-warning',
        2: 'bg-success',
        3: 'bg-danger'
    };
    return map[status] || 'bg-secondary';
}

export function formatPaymentType(typeOrNote) {
    if (!typeOrNote) return '—';
    const lower = String(typeOrNote).toLowerCase().trim();
    if (lower.includes('аванс') || lower.includes('advance')) return 'Аванс';
    if (lower.includes('доплата') || lower.includes('доплат') || lower.includes('additional')) return 'Доплата';
    return escapeHtml(typeOrNote.slice(0, 20) + (typeOrNote.length > 20 ? '...' : ''));  // Fallback: укоротить note
}

// formatFileSize уже есть — убедись, что экспортирована
export function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(1)} ${units[i]}`;
}

// ====== АДАПТИВНОСТЬ ФИО ПОЛЬЗОВАТЕЛЯ ======

/**
 * Настройка адаптивного отображения ФИО пользователя
 */
export function setupUserNameAdaptivity() {
    const userNameElement = document.getElementById('userName');
    
    if (!userNameElement) return;
    
    const fullName = userNameElement.textContent.trim();
    const isMobile = window.innerWidth <= 768;
    
    // Всегда устанавливаем data-атрибут для тултипа
    userNameElement.setAttribute('data-fullname', fullName);
    userNameElement.setAttribute('aria-label', `Профиль: ${fullName}`);
    
    // На мобильных - всегда однострочное с усечением
    if (isMobile) {
        userNameElement.classList.remove('multiline');
        return;
    }
    
    // На десктопе: если ФИО больше 25 символов - включаем многострочность
    // "Администратор Системы А" = 25 символов
    if (fullName.length > 25) {
        userNameElement.classList.add('multiline');
    } else {
        userNameElement.classList.remove('multiline');
    }
}

/**
 * Инициализация адаптивности header
 */
export function initHeaderAdaptivity() {
    setupUserNameAdaptivity();
    
    // Обновляем при изменении размера
    window.addEventListener('resize', setupUserNameAdaptivity);
    
    // Также обновляем после загрузки DOM
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupUserNameAdaptivity, 100);
    });
}

/**
 * Обновление layout ФИО в зависимости от размера экрана
 */
function updateUserNameLayout(element, fullName) {
    const width = window.innerWidth;
    
    // Сбрасываем классы
    element.classList.remove('multiline');
    
    // Определяем стратегию отображения
    if (width <= 430) {
        // На очень маленьких экранах - всегда однострочное усечение
        element.style.maxWidth = '70px';
    } else if (width <= 768) {
        // На мобильных - умное определение
        if (fullName.length > 25) {
            element.classList.add('multiline');
        }
        element.style.maxWidth = width <= 430 ? '90px' : '120px';
    } else if (width <= 1024) {
        // На планшетах
        element.style.maxWidth = '150px';
        if (fullName.length > 30) {
            element.classList.add('multiline');
        }
    } else {
        // На десктопе
        element.style.maxWidth = '200px';
        if (fullName.length > 35) {
            element.classList.add('multiline');
        }
    }
}

/**
 * Инициализация адаптивности ФИО на всех страницах
 */
export function initUserNameAdaptivity() {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            setupUserNameAdaptivity();
        }, 100);
    });
}

/**
 * Умная адаптивность ФИО для мобильных устройств
 */
export function setupMobileUserName() {
    const userNameElement = document.getElementById('userName');
    
    if (!userNameElement) return;
    
    const fullName = userNameElement.textContent.trim();
    const isMobile = window.innerWidth <= 768;
    
    // Всегда устанавливаем data-атрибут для тултипа
    userNameElement.setAttribute('data-fullname', fullName);
    userNameElement.setAttribute('aria-label', `Профиль: ${fullName}`);
    
    // На мобильных - умное определение переноса
    if (isMobile) {
        // Сбрасываем multiline
        userNameElement.classList.remove('multiline');
        
        // Для очень длинных имен на мобильных оставляем однострочное усечение
        if (fullName.length > 25) {
            userNameElement.classList.add('multiline');
        }
    } else {
        // На десктопе - многострочность для длинных имен
        userNameElement.classList.remove('multiline');
        if (fullName.length > 30) {
            userNameElement.classList.add('multiline');
        }
    }
}

// ====== ГЛОБАЛЬНЫЙ ДОСТУП ДЛЯ ТЕСТИРОВАНИЯ ======
// Временно, пока не обновим все страницы
window.PAYMENT_STATUS = PAYMENT_STATUS;
window.PAYMENT_STATUS_TEXT = PAYMENT_STATUS_TEXT;
window.PAYMENT_STATUS_BADGE_CLASS = PAYMENT_STATUS_BADGE_CLASS;
window.getPaymentStatus = getPaymentStatus;
window.getPaymentStatusText = getPaymentStatusText;
window.getStatusBadgeClass = getStatusBadgeClass;
window.mapStatusToEnum = mapStatusToEnum;