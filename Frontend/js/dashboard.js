import { apiService } from './api.js';
import { formatDate, escapeHtml, showTempMessage, isToday, getPaymentStatus, getPaymentStatusText } from './utils.js';

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        const userData = apiService.getCurrentUser();
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }

        setupDashboardUI(userData);
        setupEventListeners();
        await loadDashboardData();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showTempMessage('Ошибка инициализации', 'error');
    }
}

function setupDashboardUI(userData) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'Пользователь';
    }

    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = 'block';
        });
    }
}

function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => apiService.logout());
    }
}

async function loadDashboardData() {
    try {
        showLoadingState(true);
        
        const ordersResponse = await apiService.getOrders({
            page: 1,
            pageSize: 50  // Для точной статистики
        });

        updateDashboardStats(ordersResponse);
        showRecentOrders(ordersResponse);
        
    } catch (error) {
        console.error('Dashboard data load error:', error);
        showTempMessage('Не удалось загрузить данные', 'error');
    } finally {
        showLoadingState(false);
    }
}

function updateDashboardStats(ordersResponse) {
    const orders = ordersResponse.items || [];
    
    const totalOrders = orders.length;
    const todayOrders = countTodayOrders(orders);
    const unpaidOrders = countUnpaidOrders(orders);

    updateStatElement('totalOrders', totalOrders);
    updateStatElement('todayOrders', todayOrders);
    updateStatElement('unpaidOrders', unpaidOrders);
}

function countTodayOrders(orders) {
    return orders.filter(order => isToday(order.createdAt || order.orderDate)).length;
}

function countUnpaidOrders(orders) {
    return orders.filter(order => getPaymentStatus(order) === 'not_paid').length;
}

function updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function showRecentOrders(ordersResponse) {
    const orders = ordersResponse.items || [];
    const recentOrders = orders.slice(0, 5).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));  // Сортировка по дате desc
    const ordersList = document.getElementById('recentOrdersList');
    
    if (!ordersList) return;

    if (recentOrders.length === 0) {
        ordersList.innerHTML = '<div class="order-item"><p>Заказов пока нет</p></div>';
        return;
    }
    
    ordersList.innerHTML = recentOrders.map(order => {
        const statusClass = getStatusClass(getPaymentStatus(order));
        return `
            <div class="order-item" onclick="viewOrder(${order.id})" style="cursor: pointer;">
                <div class="order-info">
                    <h4>${escapeHtml(order.orderNumber)} - ${escapeHtml(order.customerFullName)}</h4>
                    <div class="order-meta">
                        ${escapeHtml(order.phone)} • ${formatDate(order.createdAt)}
                    </div>
                </div>
                <div class="order-status ${statusClass}">
                    ${getPaymentStatusText(order)}
                </div>
            </div>
        `;
    }).join('');
}

function getStatusClass(status) {
    const statusMap = {
        'not_paid': 'status-unpaid',
        'partial': 'status-partial',
        'paid': 'status-paid',
        'Новый': 'status-new'
    };
    return statusMap[status] || 'status-default';
}

function viewOrder(orderId) {
    window.location.href = `view-order.html?id=${orderId}`;
}

function showLoadingState(loading) {
    const recentOrdersList = document.getElementById('recentOrdersList');
    if (recentOrdersList && loading) {
        recentOrdersList.innerHTML = '<div class="loading">Загрузка данных...</div>';
    }
}

// Глобальные для HTML onclick
window.viewOrder = viewOrder;