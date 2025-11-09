// utils.js — Centralized helpers for formatting, DOM, forms, API errors, nav, etc.
// All functions are pure/exported for modular use. No globals except where legacy.

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
    const statusMap = {
        'not_paid': 'Не оплачено',
        'partial': 'Частично оплачено', 
        'paid': 'Оплачено',
        'overpaid': 'Переплачено'
    };
    return statusMap[getPaymentStatus(order)] || 'Не оплачено';
}

export function getStatusBadgeClass(status) {
    const classMap = {
        'not_paid': 'status-not_paid',
        'partial': 'status-partial', 
        'paid': 'status-paid',
        'overpaid': 'status-overpaid',
        'Новый': 'status-new'
    };
    return classMap[status] || 'status-not_paid';
}

// ====== ПОЛУЧЕНИЕ ИМЕНИ МЕНЕДЖЕРА ИЗ ЗАКАЗА ======
export function getUserNameFromOrder(order) {
    return order?.managerFullName || 'Неизвестно';
}

export function isAdmin() {
    const user = JSON.parse(localStorage.getItem('userData') || 'null');
    return user?.role === 'Admin';
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
        'all': 0,      // All
        'not_paid': 1, // NotPaid
        'partial': 2,  // Partial  
        'paid': 3,     // Paid
        'overpaid': 4  // Overpaid
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

    // Admin toggle
    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (typeof window.handleLogout === 'function') window.handleLogout();
        });
    }

    // Nav toggle
    const burger = document.getElementById('burgerBtn') || document.querySelector('.burger-btn');
    if (burger) {
        burger.addEventListener('click', () => toggleNav());
    }

    // Nav links: close mobile, set active
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) toggleNav(false); // Close
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
        if (item.dataset.page === pageType) item.classList.add('active');
    });

    // Resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (window.innerWidth > 768) toggleNav(false);
        }, 250);
    });
}

export function toggleNav(open = null) {
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    const main = document.getElementById('mainContent') || document.querySelector('.main-content');
    const burger = document.getElementById('burgerBtn') || document.querySelector('.burger-btn');
    const isOpen = sidebar?.classList.contains('open') || false;

    if (open !== null) {
        if (open && !isOpen) {
            sidebar?.classList.add('open');
            main?.classList.add('shifted');
            burger?.setAttribute('aria-expanded', 'true');
            createBackdrop();
        } else if (!open && isOpen) {
            sidebar?.classList.remove('open');
            main?.classList.remove('shifted');
            burger?.setAttribute('aria-expanded', 'false');
            removeBackdrop();
        }
        return;
    }

    // Toggle
    sidebar?.classList.toggle('open');
    main?.classList.toggle('shifted');
    burger?.setAttribute('aria-expanded', !isOpen);
    if (sidebar?.classList.contains('open')) createBackdrop();
    else removeBackdrop();
}

function createBackdrop() {
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1001;';
        backdrop.addEventListener('click', () => toggleNav(false));
        document.body.appendChild(backdrop);
    }
}

function removeBackdrop() {
    const backdrop = document.querySelector('.sidebar-backdrop');
    if (backdrop) backdrop.remove();
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

export function isValidPhone(phone) {
    return /^\+?[\d\s\-\(\)]{10,}$/.test(phone);
}

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