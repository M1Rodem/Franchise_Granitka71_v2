import { PageManager } from './page-manager.js';
import { apiService } from './api.js';
import { formatDate, escapeHtml, getPaymentStatus, getPaymentStatusText, getUserNameFromOrder, getStatusBadgeClass } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    PageManager.initialize('dashboard', loadDashboardData);
    
    // ФИКС: Прямой обработчик для кнопки выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('Logout button clicked'); // для отладки
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            localStorage.removeItem('orderFilters');
            localStorage.removeItem('lastOrderView');
            window.location.href = 'login.html';
        });
    }
    
    // Инициализация пользовательского интерфейса
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userNameElement = document.getElementById('userName');
    if (userNameElement && userData.fullName) {
        userNameElement.textContent = userData.fullName;
    }
})

async function loadDashboardData() {
    try {
        showLoadingState(true);

        // Получаем ВСЕ заказы и фильтруем на клиенте
        const allOrdersResponse = await apiService.getOrders({ page: 1, pageSize: 1000 });
        const today = new Date().toISOString().split('T')[0];
        
        // Фильтруем заказы за сегодня на клиенте (учитываем UTC)
        const todayOrders = allOrdersResponse.items.filter(order => {
            const orderDate = new Date(order.orderDate).toISOString().split('T')[0];
            return orderDate === today;
        });

        const [unpaidCount, recentResponse] = await Promise.all([
            apiService.getUnpaidOrdersStats(),
            apiService.getOrders({ page: 1, pageSize: 5, sortBy: 'OrderDate', sortDesc: true }) 
        ]);
        
        const stats = {
            total: allOrdersResponse.totalCount || 0,
            today: todayOrders.length,
            unpaid: unpaidCount || 0,
            recent: recentResponse?.items || []
        };

        updateDashboardStats(stats);
        showLoadingState(false);
    } catch (error) {
        console.error('Dashboard data error:', error);
        showLoadingState(false);
        throw error;
    }
}

function updateDashboardStats(data) {
    updateStatElement('totalOrders', data.total);
    updateStatElement('todayOrders', data.today);
    updateStatElement('unpaidOrders', data.unpaid);
    showRecentOrders(data.recent);
}

function showRecentOrders(orders) {
    const recentOrders = orders.slice(0, 5).sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    const ordersList = document.getElementById('recentOrdersList');
    const noData = document.getElementById('noRecentOrders');

    if (!ordersList || !noData) return;

    if (recentOrders.length === 0) {
        ordersList.style.display = 'none';
        noData.style.display = 'block';
        return;
    }

    ordersList.style.display = 'grid';
    noData.style.display = 'none';
    ordersList.innerHTML = recentOrders.map(order => {
        const status = getPaymentStatus(order);
        const statusClass = getStatusBadgeClass(status); // Теперь использует единый класс
        const statusText = getPaymentStatusText(order);
        const managerName = getUserNameFromOrder(order);
        return `
            <div class="order-item" data-order-id="${order.id}" tabindex="0" role="button" aria-label="Открыть заказ ${order.orderNumber}">
                <div class="order-info">
                    <h4>${escapeHtml(order.orderNumber || 'N/A')} — ${escapeHtml(order.customerFullName || '')}</h4>
                    <div class="order-meta">
                        ${escapeHtml(order.phone || 'N/A')} • ${formatDate(order.orderDate)} • ${escapeHtml(managerName)}
                    </div>
                </div>
                <div class="order-status ${statusClass}">${statusText}</div>
            </div>
        `;
    }).join('');

    // Click handlers
    ordersList.querySelectorAll('.order-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.order-item')) {
                const id = item.dataset.orderId;
                viewOrder(id);
            }
        });
    });
}

function updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value;
}

function showLoadingState(loading) {
    const stats = document.querySelectorAll('.stat-card');
    const list = document.getElementById('recentOrdersList');
    if (loading) {
        stats.forEach(stat => stat.classList.add('skeleton'));
        if (list) list.innerHTML = '<div class="skeleton-row"></div>'.repeat(3);
    } else {
        stats.forEach(stat => stat.classList.remove('skeleton'));
    }
}

function viewOrder(orderId) {
    window.location.href = `view-order.html?id=${orderId}`;
}

// Legacy global
window.viewOrder = viewOrder;