import { apiService } from './api.js';
import { formatDate, escapeHtml, showTempMessage, isToday, getPaymentStatus, getPaymentStatusText, getUserNameFromOrder } from './utils.js';  /* Добавил getUserNameFromOrder */

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
        showTempMessage('Ошибка инициализации дашборда', 'error');
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

    // Burger toggle (now in HTML, class .burger-btn)
    const burger = document.querySelector('.burger-btn');
    if (burger) {
        burger.addEventListener('click', toggleSidebar);
    }

    // Close on nav click (optional)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeSidebar();
        });
    });
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    const burger = document.querySelector('.burger-btn');
    sidebar.classList.toggle('open');
    main.classList.toggle('shifted');
    burger.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
        createBackdrop();  // Dim bg
    } else {
        removeBackdrop();
    }
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    const burger = document.querySelector('.burger-btn');
    sidebar.classList.remove('open');
    main.classList.remove('shifted');
    burger.classList.remove('open');
    removeBackdrop();
}

function createBackdrop() {
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0, 0, 0, 0.5); z-index: 998; opacity: 0; 
            transition: opacity 0.3s ease;
        `;
        backdrop.addEventListener('click', closeSidebar);
        document.body.appendChild(backdrop);
    }
    setTimeout(() => backdrop.style.opacity = '1', 10);
}

function removeBackdrop() {
    const backdrop = document.querySelector('.sidebar-backdrop');
    if (backdrop) {
        backdrop.style.opacity = '0';
        setTimeout(() => backdrop.remove(), 300);
    }
}

async function loadDashboardData() {
    try {
        showLoadingState(true);
        
        const ordersResponse = await apiService.getOrders({
            page: 1,
            pageSize: 50  // Для stats
        });

        if (ordersResponse && Array.isArray(ordersResponse.items)) {
            updateDashboardStats(ordersResponse.items);
            showRecentOrders(ordersResponse.items);
        } else {
            throw new Error('Invalid response');
        }
        
    } catch (error) {
        console.error('Dashboard data load error:', error);
        showTempMessage('Не удалось загрузить данные дашборда', 'error');
        document.getElementById('recentOrdersList').innerHTML = '<div class="no-data">Ошибка загрузки. Обновите страницу.</div>';
    } finally {
        showLoadingState(false);
    }
}

function showLoadingState(loading) {
    const stats = document.querySelector('.dashboard-stats');
    const recent = document.getElementById('recentOrdersList');
    if (loading) {
        if (stats) {
            const cards = Array.from(stats.children);
            cards.forEach(card => {
                const h3 = card.querySelector('h3');
                const number = card.querySelector('.stat-number');
                if (h3 && number) {
                    number.innerHTML = '<div style="width: 24px; height: 24px; border: 2px solid var(--border-light); border-top: 2px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>';
                }
            });
        }
        if (recent) {
            recent.innerHTML = '<div class="loading">Загрузка последних заказов...</div>';
        }
    }
}

function updateDashboardStats(orders) {
    const totalOrders = orders.length;
    const todayOrders = countTodayOrders(orders);
    const unpaidOrders = countUnpaidOrders(orders);

    updateStatElement('totalOrders', totalOrders);
    updateStatElement('todayOrders', todayOrders);
    updateStatElement('unpaidOrders', unpaidOrders);
}

function countTodayOrders(orders) {
    return orders.filter(order => isToday(order.orderDate || order.createdAt)).length;
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

function showRecentOrders(orders) {
    const recentOrders = orders.slice(0, 5).sort((a, b) => new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt));
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
        const statusClass = getStatusClass(getPaymentStatus(order));
        const statusText = getPaymentStatusText(order);
        const managerName = getUserNameFromOrder(order) || 'Неизвестно';  /* Fallback */
        return `
            <div class="order-item" onclick="viewOrder(${order.id})" tabindex="0" role="button" aria-label="Открыть заказ ${order.orderNumber}">
                <div class="order-info">
                    <h4>${escapeHtml(order.orderNumber || 'N/A')} — ${escapeHtml(order.customerFullName)}</h4>
                    <div class="order-meta">
                        ${escapeHtml(order.phone || 'N/A')} • ${formatDate(order.orderDate || order.createdAt)} • ${escapeHtml(managerName)}
                    </div>
                </div>
                <div class="order-status ${statusClass}">
                    ${statusText}
                </div>
            </div>
        `;
    }).join('');
}

function getStatusClass(status) {
    const statusMap = {
        'paid': 'status-paid',
        'partial': 'status-partial',
        'not_paid': 'status-unpaid',
        'overpaid': 'status-overpaid',
        'Новый': 'status-new'
    };
    return statusMap[status] || 'status-default';
}

function viewOrder(orderId) {
    window.location.href = `view-order.html?id=${orderId}`;
}

// Глобальные
window.viewOrder = viewOrder;

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        closeSidebar();  // Auto close + remove shifted
        removeBackdrop();
    }
})