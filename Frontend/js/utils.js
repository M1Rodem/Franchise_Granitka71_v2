// utils.js — Только non-photo utils

function normalizePhone(v) {
    if (!v) return '';
    return String(v).trim().replace(/\D/g, '');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB'
    }).format(amount || 0);
}

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

function showMessage(el, text) {
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
}

function hideMessage(el) {
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
}

function valueOrNull(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = el.value.trim();
    return v === '' ? null : v;
}