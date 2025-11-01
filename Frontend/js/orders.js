import { apiService } from './api.js';
import { formatDate, formatCurrency, escapeHtml, showTempMessage, debounce, getPaymentStatus, getPaymentStatusText, getUserNameFromOrder } from './utils.js';
import { ModalUtils } from './modal-utils.js';

let currentPage = 1;
const pageSize = 10;
let allOrders = [];
let filteredOrders = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeOrdersPage();
});

async function initializeOrdersPage() {
    try {
        const userData = apiService.getCurrentUser();
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }

        setupPageUI(userData);
        setupOrdersEventListeners();
        await loadOrders();
        
    } catch (error) {
        console.error('Orders page initialization error:', error);
        showTempMessage('Ошибка инициализации', 'error');
    }
}

function setupPageUI(userData) {
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

function setupOrdersEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => apiService.logout());
    }

    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);
    
    // Поиск с debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }

    // Новый фильтр по менеджеру
    const managerFilter = document.getElementById('managerFilter');
    if (managerFilter) {
        managerFilter.addEventListener('change', applyFilters);
    }
}

async function loadOrders() {
    try {
        showLoadingState(true);
        
        const response = await apiService.getOrders({
            page: currentPage,
            pageSize: pageSize
        });

        if (response && Array.isArray(response.items)) {
            allOrders = response.items;
        } else {
            allOrders = [];
        }
        
        applyFilters();
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        showTempMessage('Не удалось загрузить заказы: ' + error.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

function applyFilters() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const managerFilter = document.getElementById('managerFilter')?.value || 'all';
    
    if (!Array.isArray(allOrders)) {
        allOrders = [];
    }
    
    filteredOrders = allOrders.filter(order => {
        if (!order) return false;
        
        const matchesSearch = matchesOrderSearch(order, searchText);
        const matchesStatus = matchesOrderStatus(order, statusFilter);
        const matchesManager = matchesOrderManager(order, managerFilter);
        
        return matchesSearch && matchesStatus && matchesManager;
    });
    
    currentPage = 1;
    renderOrdersTable();
}

function matchesOrderSearch(order, searchText) {
    if (!searchText) return true;
    
    const searchFields = [
        order.orderNumber || '',
        order.customerFullName || '',
        order.phone || '',
        order.deceasedFullName || ''
    ];
    
    return searchFields.some(field => 
        field.toString().toLowerCase().includes(searchText)
    );
}

function matchesOrderStatus(order, statusFilter) {
    if (statusFilter === 'all') return true;
    
    const paymentStatus = getPaymentStatus(order);
    return paymentStatus === statusFilter;
}

function matchesOrderManager(order, managerFilter) {
    if (managerFilter === 'all') return true;
    
    const managerName = getUserNameFromOrder(order);
    return managerName.toLowerCase().includes(managerFilter.toLowerCase());
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('managerFilter').value = 'all';
    applyFilters();
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (!Array.isArray(filteredOrders)) {
        filteredOrders = [];
    }
    
    const startIndex = (currentPage - 1) * pageSize;
    const pageOrders = filteredOrders.slice(startIndex, startIndex + pageSize);
    
    if (pageOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">Заказы не найдены</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = pageOrders.map(order => createOrderRow(order)).join('');
    }
    
    updatePagination();
}

function createOrderRow(order) {
    if (!order) return '';
    
    const orderNumber = order.orderNumber || 'Н/Д';
    const customerFullName = order.customerFullName || 'Н/Д';
    const phone = order.phone || 'Н/Д';
    const createdAt = formatDate(order.createdAt);
    const totalPrice = order.totalPrice || 0;
    const paymentStatus = getPaymentStatus(order);
    const managerName = getUserNameFromOrder(order);  // П.1: Менеджер
    
    return `
        <tr>
            <td>${escapeHtml(orderNumber)}</td>
            <td>${escapeHtml(customerFullName)}</td>
            <td>${escapeHtml(phone)}</td>
            <td>${createdAt}</td>
            <td>${formatCurrency(totalPrice)}</td>
            <td>
                <span class="status-badge status-${paymentStatus}">
                    ${getPaymentStatusText(order)}
                </span>
            </td>
            <td>${escapeHtml(managerName)}</td>  <!-- П.1: Колонка менеджера -->
            <td class="actions">
                <button class="btn btn-primary btn-sm" onclick="viewOrder(${order.id})">👁️</button>
                <button class="btn btn-warning btn-sm" onclick="window.location.href='create-order.html?edit=${order.id}'">✏️</button>  <!-- Edit -->
                <button class="btn btn-danger btn-sm" onclick="deleteOrder(${order.id})">🗑️</button>
            </td>
        </tr>
    `;
}

async function deleteOrder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showTempMessage('Заказ не найден', 'error');
        return;
    }
    
    const orderNumber = order.orderNumber || 'Н/Д';
    
    try {
        const confirmed = await ModalUtils.confirm({
            title: 'Удаление заказа',
            message: `Вы уверены, что хотите удалить заказ №${orderNumber}? Заказ будет перемещен в архив.`,
            confirmText: 'Удалить',
            danger: true
        });
        
        if (confirmed) {
            await apiService.deleteOrder(orderId);
            showTempMessage(`Заказ №${orderNumber} перемещен в архив`, 'success');
            await loadOrders(); // Reload
            // Опционально: window.location.href = 'archived-orders.html';  // Если сразу в архив
        }
    } catch (error) {
        console.error('Ошибка удаления заказа:', error);
        showTempMessage('Ошибка удаления: ' + error.message, 'error');
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredOrders.length / pageSize);
    const pageInfo = document.getElementById('pageInfo');
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    
    if (pageInfo) {
        pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
    }
    
    if (prevButton) {
        prevButton.disabled = currentPage === 1;
    }
    
    if (nextButton) {
        nextButton.disabled = currentPage === totalPages || totalPages === 0;
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderOrdersTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredOrders.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderOrdersTable();
    }
}

function showLoadingState(loading) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    
    if (loading) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="loading">Загрузка заказов...</td>
            </tr>
        `;
    }
}

// Глобальные для HTML onclick
window.viewOrder = function(orderId) {
    window.location.href = `view-order.html?id=${orderId}`;
};

window.deleteOrder = deleteOrder;