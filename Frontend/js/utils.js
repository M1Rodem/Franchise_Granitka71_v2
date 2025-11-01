// ====== ФОРМАТИРОВАНИЕ ======

export function formatDate(dateString) {
    if (!dateString) return '—';
    try { return new Date(dateString).toLocaleDateString('ru-RU'); } catch { return '—'; }
}

export function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatDateTime(dateString) {
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
    if (!phone) return '';
    return String(phone).trim().replace(/\D/g, '');
}

export function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0 ₽';
    const formatted = Math.abs(Number(amount)).toLocaleString('ru-RU');
    return `${formatted} ₽`;
}

// ====== БЕЗОПАСНОСТЬ HTML ======
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function sanitizeInput(input) {
    if (!input) return '';
    return String(input).trim().replace(/[<>]/g, '');
}

// ====== РАБОТА С ФОРМАМИ ======
export function getFormValue(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return '';

    const value = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' 
        ? (element.value || '') 
        : (element.textContent || element.innerText || '');
    
    return value.trim();
}

export function setFormValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.value = value || '';
}

export function valueOrNull(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = el.value.trim();
    return v === '' ? null : v;
}

export function clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) form.reset();
}

export function populateForm(formId, data) {
    const form = document.getElementById(formId);
    if (!form || !data) return;
    for (const [key, value] of Object.entries(data)) {
        const input = form.querySelector(`[name="${key}"]`) || document.getElementById(key);
        if (input) {
            if (input.type === 'checkbox') input.checked = !!value;
            else input.value = value || '';
        }
    }
}

// ====== ВРЕМЕННЫЕ СООБЩЕНИЯ ======
export function showTempMessage(message, type = 'success', duration = 3000) {
    const messageEl = document.createElement('div');
    messageEl.className = `temp-message temp-message-${type}`;
    messageEl.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 1rem; border-radius: 4px;
        color: white; z-index: 10000; transform: translateX(100%);
        transition: transform 0.3s ease;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
    `;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    messageEl.innerHTML = `<div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.2em;">${icon}</span>
        <span>${escapeHtml(message)}</span>
    </div>`;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => messageEl.style.transform = 'translateX(0)', 10);
    
    setTimeout(() => {
        messageEl.style.transform = 'translateX(100%)';
        setTimeout(() => messageEl.remove(), 300);
    }, duration);
    
    messageEl.addEventListener('click', () => {
        messageEl.style.transform = 'translateX(100%)';
        setTimeout(() => messageEl.remove(), 300);
    });
    
    return { close: () => { messageEl.style.transform = 'translateX(100%)'; setTimeout(() => messageEl.remove(), 300); } };
}

// ====== РАБОТА С ДАТАМИ ======

export function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

export function isToday(dateString) {
    if (!dateString) return false;
    const today = new Date().toDateString();
    const compareDate = new Date(dateString).toDateString();
    return today === compareDate;
}

export function getDaysDifference(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = today - date;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// ====== ОПТИМИЗАЦИЯ ======

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ====== ВАЛИДАЦИЯ ======

export function isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function isValidPhone(phone) {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
}

export function isNumeric(value) {
    if (!value) return false;
    return !isNaN(parseFloat(value)) && isFinite(value);
}

// ====== РАБОТА С МАССИВАМИ И ОБЪЕКТАМИ ======

export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    
    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

export function arrayToObject(array, keyField) {
    if (!Array.isArray(array)) return {};
    return array.reduce((obj, item) => {
        obj[item[keyField]] = item;
        return obj;
    }, {});
}

// ====== РАБОТА С DOM ======

export function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
    }
}

export function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

export function toggleElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }
}

export function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

export function setElementHTML(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = html;
    }
}

// ====== СТАТУСЫ И ЦВЕТА ======

export function getPaymentStatus(order) {
    if (!order || !order.payments) return 'not_paid';
    
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const totalPrice = Number(order.totalPrice) || 0;
    
    if (totalPaid === 0) return 'not_paid';
    if (totalPaid < totalPrice) return 'partial';
    return 'paid';
}

export function getPaymentStatusText(order) {
    const status = getPaymentStatus(order);
    const statusMap = {
        'not_paid': 'Не оплачено',
        'partial': 'Частично оплачено', 
        'paid': 'Оплачено'
    };
    return statusMap[status] || 'Не оплачено';
}

export function getStatusBadgeClass(status) {
    const classMap = {
        'not_paid': 'status-unpaid',
        'partial': 'status-partial',
        'paid': 'status-paid',
        'Новый': 'status-new'
    };
    return classMap[status] || 'status-default';
}

// ====== ПОЛУЧЕНИЕ ИМЕНИ МЕНЕДЖЕРА ИЗ ЗАКАЗА ======
export function getUserNameFromOrder(order) {
    if (!order) return 'Неизвестно';
    return order.manager?.fullName || order.manager?.username || 'Неизвестно';
}

// ====== URL И ПАРАМЕТРЫ ======

export function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

export function updateUrlParam(param, value) {
    const url = new URL(window.location);
    if (value) {
        url.searchParams.set(param, value);
    } else {
        url.searchParams.delete(param);
    }
    window.history.pushState({}, '', url);
}

// ====== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ======

export function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
}

export function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return null;
    }
}

export function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Error removing from localStorage:', error);
        return false;
    }
}

// ====== ОБРАБОТКА ОШИБОК ======

export function handleApiError(error) {
    console.error('API Error:', error);
    
    let message = 'Произошла ошибка';
    if (error.status === 401) {
        message = 'Требуется авторизация';
        handleLogout();
    } else if (error.status === 403) {
        message = 'Доступ запрещен';
    } else if (error.message) {
        message = error.message;
    }
    
    showTempMessage(message, 'error');
    return message;
}