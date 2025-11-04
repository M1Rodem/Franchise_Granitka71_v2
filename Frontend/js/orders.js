import { PageManager } from './page-manager.js';
import { apiService } from './api.js';
import { formatDate, formatCurrency, escapeHtml, showTempMessage, handleApiError, 
    getUrlParam, updateUrlParam, mapStatusToEnum, getPaymentStatus, 
    getPaymentStatusText, getUserNameFromOrder, getStatusBadgeClass, debounce } from './utils.js';

let currentPage = parseInt(getUrlParam('page')) || 1;
const pageSize = 10;
let allOrders = [];
let totalCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    PageManager.initialize('orders', initializeOrdersPage);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            localStorage.removeItem('orderFilters');
            window.location.href = 'login.html';
        });
    }
});

async function initializeOrdersPage() {
    setupOrdersEventListeners();
    loadFiltersFromUrl();
    await loadOrders();
}

function setupOrdersEventListeners() {
    // Filters
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearchInput, 300));
    }
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }

    // Pagination
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);
}

function handleSearchInput() {
    applyFilters(); // Debounced
}

function loadFiltersFromUrl() {
    const search = getUrlParam('search') || '';
    const statusStr = getUrlParam('Status');
    const status = statusStr ? Object.keys(mapStatusToEnum).find(key => mapStatusToEnum[key] == statusStr) || 'all' : 'all';
    
    document.getElementById('searchInput').value = search;
    document.getElementById('statusFilter').value = status;
}

async function applyFilters() {
    const search = document.getElementById('searchInput').value.trim();
    let status = document.getElementById('statusFilter').value;

    // ✅ ФИКС: Добавляем сортировку по UpdatedAt DESC
    const filterParams = {
        page: 1,
        pageSize: pageSize,
        sortBy: 'UpdatedAt', // ✅ Сортируем по дате обновления
        sortDesc: true       // ✅ Сначала новые
    };

    if (search) {
        filterParams.SearchQuery = search;
    }

    if (status !== 'all') {
        filterParams.PaymentStatus = mapStatusToEnum(status);
    }

    // Persist to URL
    updateUrlParam('search', search || null);
    if (status !== 'all') {
        updateUrlParam('Status', filterParams.PaymentStatus);
    } else {
        updateUrlParam('Status', null);
    }
    updateUrlParam('page', 1);
    currentPage = 1;

    await loadOrdersWithFilters(filterParams);
}

async function loadOrdersWithFilters(filterParams) {
    try {
        showLoadingState(true);

        const response = await apiService.getOrders(filterParams);

        if (response && Array.isArray(response.items)) {
            allOrders = response.items;
            totalCount = response.totalCount;
        } else {
            allOrders = [];
            totalCount = 0;
        }

        renderOrders(allOrders);
        updatePagination();
        showLoadingState(false);
    } catch (error) {
        handleApiError(error);
        showLoadingState(false);
    }
}

async function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    updateUrlParam('search', null);
    updateUrlParam('Status', null);
    updateUrlParam('page', 1);
    currentPage = 1;
    
    // ✅ ФИКС: Сбрасываем с сортировкой по UpdatedAt
    await loadOrdersWithFilters({
        page: 1,
        pageSize: pageSize,
        sortBy: 'UpdatedAt',
        sortDesc: true
    });
}

async function loadOrders() {
    // ✅ ФИКС: Всегда сортируем по UpdatedAt DESC
    const filterParams = {
        page: currentPage,
        pageSize: pageSize,
        sortBy: 'UpdatedAt',
        sortDesc: true
    };

    const search = getUrlParam('search');
    const statusEnum = getUrlParam('Status');

    if (search) {
        filterParams.SearchQuery = search;
    }

    if (statusEnum && statusEnum !== '0') {
        filterParams.PaymentStatus = parseInt(statusEnum);
    }

    await loadOrdersWithFilters(filterParams);
}


function renderOrders(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">Нет заказов</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => {
        const status = getPaymentStatus(order);
        const statusText = getPaymentStatusText(order);
        const statusClass = getStatusBadgeClass(status);
        const managerName = getUserNameFromOrder(order);
        const totalPrice = order.workItems?.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0) || 0;
        return `
            <tr data-order-id="${order.id}">
                <td>${escapeHtml(order.orderNumber || 'N/A')}</td>
                <td>${escapeHtml(order.customerFullName || '')}</td>
                <td>${escapeHtml(order.phone || 'N/A')}</td>
                <td>${formatDate(order.orderDate)}</td>
                <td>${formatCurrency(totalPrice)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${escapeHtml(managerName)}</td>
                <td>
                    <button class="btn btn-small" onclick="viewOrder(${order.id})">Просмотр</button>
                    <button class="btn btn-small danger" onclick="deleteOrder(${order.id})">Удалить</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function deleteOrder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showTempMessage('Заказ не найден', 'error');
        return;
    }

    const confirmed = confirm(`Удалить заказ №${order.orderNumber || 'N/A'}? Переместится в архив.`);
    if (confirmed) {
        try {
            await apiService.deleteOrder(orderId);
            showTempMessage('Заказ перемещен в архив', 'success');
            await loadOrders();
        } catch (error) {
            handleApiError(error);
        }
    }
}

function updatePagination() {
    const totalPages = Math.ceil(totalCount / pageSize);
    document.getElementById('pageInfo').textContent = `Страница ${currentPage} из ${totalPages || 1}`;

    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage >= totalPages;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        updateUrlParam('page', currentPage);
        loadOrders();
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        updateUrlParam('page', currentPage);
        loadOrders();
    }
}

function showLoadingState(loading) {
    const tbody = document.getElementById('ordersTableBody');
    if (loading) {
        tbody.innerHTML = '<tr><td colspan="8" class="skeleton-row"></td></tr>'.repeat(5);
    }
}

// Globals
window.viewOrder = (id) => window.location.href = `view-order.html?id=${id}`;
window.deleteOrder = deleteOrder;
