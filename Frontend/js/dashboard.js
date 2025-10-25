// dashboard.js - упрощенная версия
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Просто показываем имя из localStorage
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    document.getElementById('userName').textContent = userData.fullName || 'Пользователь';
    
    // Пытаемся загрузить данные, но не блокируем интерфейс при ошибке
    loadDashboardData().catch(console.error);

        // Показываем админские пункты меню если пользователь админ
    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
    }
}

function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }
}

async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        const orders = await apiService.getOrders();
        console.log('Orders loaded:', orders);
        
        // Простая статистика
        updateDashboardStats(orders);
        showRecentOrders(orders);
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        document.getElementById('recentOrdersList').innerHTML = 
            '<div class="error">Ошибка загрузки данных</div>';
    }
}

function updateDashboardStats(orders) {
    // Простая логика - считаем что orders это массив
    const ordersArray = Array.isArray(orders) ? orders : (orders.items || []);
    
    document.getElementById('totalOrders').textContent = ordersArray.length;
    document.getElementById('todayOrders').textContent = '0'; // временно
    document.getElementById('unpaidOrders').textContent = '0'; // временно
}

function showRecentOrders(orders) {
    const ordersArray = Array.isArray(orders) ? orders : (orders.items || []);
    const recentOrders = ordersArray.slice(0, 5);
    const ordersList = document.getElementById('recentOrdersList');
    
    if (recentOrders.length === 0) {
        ordersList.innerHTML = '<div class="order-item"><p>Заказов пока нет</p></div>';
        return;
    }
    
    ordersList.innerHTML = recentOrders.map(order => `
        <div class="order-item">
            <div class="order-info">
                <h4>${order.orderNumber} - ${order.customerFullName}</h4>
                <div class="order-meta">
                    ${order.phone} • ${new Date(order.createdAt).toLocaleDateString('ru-RU')}
                </div>
            </div>
            <div class="order-status">
                ${order.status || 'Новый'}
            </div>
        </div>
    `).join('');
}