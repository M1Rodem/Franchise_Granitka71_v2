document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        // Используем улучшенную проверку авторизации
        const userData = checkAuth();
        if (!userData) return;

        setupDashboardUI(userData);
        setupEventListeners();
        await loadDashboardData();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showErrorMessage('Ошибка инициализации дашборда');
    }
}

function setupDashboardUI(userData) {
    // Устанавливаем имя пользователя
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'Пользователь';
    }

    // Показываем админские пункты меню
    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = 'block';
        });
    }
}

function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

async function loadDashboardData() {
    try {
        showLoadingState(true);
        
        // Загружаем заказы с базовыми фильтрами
        const ordersResponse = await apiService.getOrders({
            page: 1,
            pageSize: 50 // Больше заказов для точной статистики
        });

        updateDashboardStats(ordersResponse);
        showRecentOrders(ordersResponse);
        
    } catch (error) {
        console.error('Dashboard data load error:', error);
        showErrorMessage('Не удалось загрузить данные дашборда');
    } finally {
        showLoadingState(false);
    }
}

function updateDashboardStats(ordersResponse) {
    const orders = ordersResponse.items || [];
    
    // Подсчет статистики
    const totalOrders = orders.length;
    const todayOrders = countTodayOrders(orders);
    const unpaidOrders = countUnpaidOrders(orders);

    // Обновление DOM
    updateStatElement('totalOrders', totalOrders);
    updateStatElement('todayOrders', todayOrders);
    updateStatElement('unpaidOrders', unpaidOrders);
}

function countTodayOrders(orders) {
    const today = new Date().toDateString();
    return orders.filter(order => {
        const orderDate = new Date(order.orderDate || order.createdAt).toDateString();
        return orderDate === today;
    }).length;
}

function countUnpaidOrders(orders) {
    // Логика подсчета неоплаченных заказов
    // Можно улучшить когда будут реальные данные о платежах
    return orders.filter(order => {
        // Временная логика - считаем все заказы без статуса "Оплачено"
        return order.status !== 'Оплачено' && order.status !== 'paid';
    }).length;
}

function updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function showRecentOrders(ordersResponse) {
    const orders = ordersResponse.items || [];
    const recentOrders = orders.slice(0, 5); // Последние 5 заказов
    const ordersList = document.getElementById('recentOrdersList');
    
    if (!ordersList) return;

    if (recentOrders.length === 0) {
        ordersList.innerHTML = '<div class="order-item"><p>Заказов пока нет</p></div>';
        return;
    }
    
    ordersList.innerHTML = recentOrders.map(order => `
        <div class="order-item" onclick="viewOrder(${order.id})" style="cursor: pointer;">
            <div class="order-info">
                <h4>${escapeHtml(order.orderNumber)} - ${escapeHtml(order.customerFullName)}</h4>
                <div class="order-meta">
                    ${escapeHtml(order.phone)} • ${formatDate(order.orderDate || order.createdAt)}
                </div>
            </div>
            <div class="order-status ${getStatusClass(order.status)}">
                ${getStatusText(order.status)}
            </div>
        </div>
    `).join('');
}

function getStatusClass(status) {
    const statusMap = {
        'Новый': 'status-new',
        'paid': 'status-paid',
        'Оплачено': 'status-paid',
        'partial': 'status-partial',
        'not_paid': 'status-unpaid'
    };
    return statusMap[status] || 'status-default';
}

function getStatusText(status) {
    const statusMap = {
        'Новый': 'Новый',
        'paid': 'Оплачено',
        'Оплачено': 'Оплачено',
        'partial': 'Частично оплачено',
        'not_paid': 'Не оплачено'
    };
    return statusMap[status] || status || 'Новый';
}

function viewOrder(orderId) {
    window.location.href = `view-order.html?id=${orderId}`;
}

function showLoadingState(loading) {
    // Можно добавить индикатор загрузки если нужно
    const recentOrdersList = document.getElementById('recentOrdersList');
    if (recentOrdersList && loading) {
        recentOrdersList.innerHTML = '<div class="loading">Загрузка данных...</div>';
    }
}

function showErrorMessage(message) {
    const recentOrdersList = document.getElementById('recentOrdersList');
    if (recentOrdersList) {
        recentOrdersList.innerHTML = `<div class="error">${message}</div>`;
    }
}

// Вспомогательные функции которые вероятно дублируются в utils.js
function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
        return '—';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}