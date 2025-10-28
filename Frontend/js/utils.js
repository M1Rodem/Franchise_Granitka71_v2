// ====== ФОРМАТИРОВАНИЕ ======

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB'
    }).format(amount || 0);
}

function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
        return '—';
    }
}

function formatDateTime(dateString) {
    if (!dateString) return '—';
    try {
        return new Date(dateString).toLocaleString('ru-RU');
    } catch {
        return '—';
    }
}

function formatPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
        return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7,9)}-${digits.slice(9)}`;
    }
    if (digits.length === 10) {
        return `+7 (${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,8)}-${digits.slice(8)}`;
    }
    return phone;
}

function normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).trim().replace(/\D/g, '');
}

// ====== БЕЗОПАСНОСТЬ HTML ======

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeInput(input) {
    if (!input) return '';
    return String(input).trim().replace(/[<>]/g, '');
}

// ====== РАБОТА С ФОРМАМИ ======

function getFormValue(elementId) {
    const element = document.getElementById(elementId);
    return element ? element.value.trim() : '';
}

function setFormValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.value = value || '';
    }
}

function valueOrNull(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = el.value.trim();
    return v === '' ? null : v;
}

function clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
    }
}

// ====== РАБОТА С ДАТАМИ ======

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function isToday(dateString) {
    if (!dateString) return false;
    const today = new Date().toDateString();
    const compareDate = new Date(dateString).toDateString();
    return today === compareDate;
}

function getDaysDifference(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = today - date;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// ====== ОПТИМИЗАЦИЯ ======

function debounce(func, wait) {
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

function throttle(func, limit) {
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

function isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
}

function isNumeric(value) {
    if (!value) return false;
    return !isNaN(parseFloat(value)) && isFinite(value);
}

// ====== РАБОТА С МАССИВАМИ И ОБЪЕКТАМИ ======

function deepClone(obj) {
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

function arrayToObject(array, keyField) {
    if (!Array.isArray(array)) return {};
    return array.reduce((obj, item) => {
        obj[item[keyField]] = item;
        return obj;
    }, {});
}

// ====== РАБОТА С DOM ======

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
    }
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

function toggleElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }
}

function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function setElementHTML(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = html;
    }
}

// ====== СТАТУСЫ И ЦВЕТА ======

function getPaymentStatus(order) {
    if (!order || !order.payments) return 'not_paid';
    
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const totalPrice = Number(order.totalPrice) || 0;
    
    if (totalPaid === 0) return 'not_paid';
    if (totalPaid < totalPrice) return 'partial';
    return 'paid';
}

function getPaymentStatusText(order) {
    const status = getPaymentStatus(order);
    const statusMap = {
        'not_paid': 'Не оплачено',
        'partial': 'Частично оплачено', 
        'paid': 'Оплачено'
    };
    return statusMap[status] || 'Не оплачено';
}

function getStatusBadgeClass(status) {
    const classMap = {
        'not_paid': 'status-unpaid',
        'partial': 'status-partial',
        'paid': 'status-paid',
        'Новый': 'status-new'
    };
    return classMap[status] || 'status-default';
}

// ====== URL И ПАРАМЕТРЫ ======

function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function updateUrlParam(param, value) {
    const url = new URL(window.location);
    if (value) {
        url.searchParams.set(param, value);
    } else {
        url.searchParams.delete(param);
    }
    window.history.pushState({}, '', url);
}

// ====== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ======

function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
}

function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return null;
    }
}

function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Error removing from localStorage:', error);
        return false;
    }
}

// ====== ОБРАБОТКА ОШИБОК ======

function handleApiError(error) {
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
    
    return message;
}