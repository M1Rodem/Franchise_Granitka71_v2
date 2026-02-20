import { PageManager } from '../core/page-manager.js';
import { apiService } from '../api/api.js';
import { formatDate, formatCurrency, escapeHtml, showTempMessage, handleApiError, 
    getUrlParam, updateUrlParam, mapStatusToEnum, getPaymentStatus, 
    getPaymentStatusText, getUserNameFromOrder, getStatusBadgeClass, debounce } from '../utils/utils.js';
import { ModalUtils } from '../utils/modal-utils.js';

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
            localStorage.removeItem('dashboardFilter'); // Очищаем фильтр дашборда
            window.location.href = 'login.html';
        });
    }
});

async function initializeOrdersPage() {
    setupOrdersEventListeners();
    loadFiltersFromUrl();
    
    // Применяем фильтр из дашборда, если он есть
    await applyDashboardFilter();
    
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

    // Date filters
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    if (dateFrom) {
        dateFrom.addEventListener('change', applyFilters);
    }
    if (dateTo) {
        dateTo.addEventListener('change', applyFilters);
    }

    // Pagination
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);

    // Attach events to order rows (делегирование событий)
    attachOrderEvents();
}

/**
 * Применяет фильтр из дашборда при переходе с dashboard
 */
async function applyDashboardFilter() {
    const dashboardFilter = localStorage.getItem('dashboardFilter');
    
    if (!dashboardFilter) return;
    
    // Очищаем фильтр после применения
    localStorage.removeItem('dashboardFilter');
    
    switch (dashboardFilter) {
        case 'all':
            // Все заказы - сбрасываем фильтры
            await resetFilters();
            showTempMessage('Показаны все заказы', 'info');
            break;
            
        case 'unpaid':
            // Неоплаченные заказы (теперь это статус 1 - Аванс)
            const statusFilter = document.getElementById('statusFilter');
            // Ищем option со значением 'advance'
            const advanceOption = Array.from(statusFilter.options).find(opt => 
                opt.value === 'advance'
            );
            
            if (advanceOption) {
                statusFilter.value = advanceOption.value;
            } else {
                // Fallback
                statusFilter.value = 'advance';
            }
            
            // Обновляем URL параметр с числовым значением
            updateUrlParam('Status', '1');
            // Загружаем заказы с фильтром
            await loadOrdersWithFilters({
                page: 1,
                pageSize: pageSize,
                sortBy: 'UpdatedAt',
                sortDesc: true,
                PaymentStatus: 1
            });
            showTempMessage('Показаны заказы с авансом', 'info');
            break;
            
        case 'today':
            // Заказы за сегодня (без изменений)
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('dateFrom').value = today;
            document.getElementById('dateTo').value = today;
            updateUrlParam('dateFrom', today);
            updateUrlParam('dateTo', today);
            await loadOrdersWithFilters({
                page: 1,
                pageSize: pageSize,
                sortBy: 'UpdatedAt',
                sortDesc: true,
                OrderDateFrom: today + 'T00:00:00.000Z',
                OrderDateTo: today + 'T23:59:59.999Z'
            });
            showTempMessage('Показаны заказы за сегодня', 'info');
            break;
    }
}

function handleSearchInput() {
    applyFilters(); // Debounced
}

function loadFiltersFromUrl() {
    const search = getUrlParam('search') || '';
    const statusStr = getUrlParam('Status');
    
    // Конвертируем числовой статус обратно в строку для select
    let statusValue = 'all';
    if (statusStr) {
        const statusNum = parseInt(statusStr);
        const statusMap = {
            1: 'advance',    // Изменено с 'not_paid' на 'advance'
            2: 'partial',
            3: 'paid'
        };
        statusValue = statusMap[statusNum] || 'all';
    }
    
    const dateFrom = getUrlParam('dateFrom') || '';
    const dateTo = getUrlParam('dateTo') || '';
    
    document.getElementById('searchInput').value = search;
    document.getElementById('statusFilter').value = statusValue;
    document.getElementById('dateFrom').value = dateFrom;
    document.getElementById('dateTo').value = dateTo;
}

async function applyFilters() {
    const search = document.getElementById('searchInput').value.trim();
    let status = document.getElementById('statusFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    const filterParams = {
        page: 1,
        pageSize: pageSize,
        sortBy: 'UpdatedAt',
        sortDesc: true
    };

    if (search) {
        filterParams.SearchQuery = search;
    }

    if (status !== 'all') {
        filterParams.PaymentStatus = mapStatusToEnum(status);
    }

    if (dateFrom) {
        filterParams.OrderDateFrom = dateFrom + 'T00:00:00.000Z';
    }

    if (dateTo) {
        filterParams.OrderDateTo = dateTo + 'T23:59:59.999Z';
    }

    // Persist to URL
    updateUrlParam('search', search || null);
    if (status !== 'all') {
        updateUrlParam('Status', filterParams.PaymentStatus);
    } else {
        updateUrlParam('Status', null);
    }
    updateUrlParam('dateFrom', dateFrom || null);
    updateUrlParam('dateTo', dateTo || null);
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
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    
    updateUrlParam('search', null);
    updateUrlParam('Status', null);
    updateUrlParam('dateFrom', null);
    updateUrlParam('dateTo', null);
    updateUrlParam('page', 1);
    currentPage = 1;
    
    await loadOrdersWithFilters({
        page: 1,
        pageSize: pageSize,
        sortBy: 'UpdatedAt',
        sortDesc: true
    });
}

async function loadOrders() {
    const filterParams = {
        page: currentPage,
        pageSize: pageSize,
        sortBy: 'UpdatedAt',
        sortDesc: true
    };

    const search = getUrlParam('search');
    const statusEnum = getUrlParam('Status');
    const dateFrom = getUrlParam('dateFrom');
    const dateTo = getUrlParam('dateTo');

    if (search) {
        filterParams.SearchQuery = search;
    }

    if (statusEnum && statusEnum !== '0') {
        filterParams.PaymentStatus = parseInt(statusEnum);
    }

    if (dateFrom) {
        filterParams.OrderDateFrom = dateFrom + 'T00:00:00.000Z';
    }

    if (dateTo) {
        filterParams.OrderDateTo = dateTo + 'T23:59:59.999Z';
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
        // ИСПОЛЬЗУЕМ paymentStatus С СЕРВЕРА!
        const status = order.paymentStatus; // Число: 1, 2, 3
        const statusText = getPaymentStatusText(order);
        const statusClass = getStatusBadgeClass(status);
        const managerName = getUserNameFromOrder(order);
        const totalPrice = order.totalPrice || 0;
        return `
            <tr data-order-id="${order.id}">
                <td data-label="№ Заказа">${escapeHtml(order.orderNumber || 'N/A')}</td>
                <td data-label="Клиент">${escapeHtml(order.customerFullName || '')}</td>
                <td data-label="Телефон">${escapeHtml(order.phone || 'N/A')}</td>
                <td data-label="Дата">${formatDate(order.orderDate)}</td>
                <td data-label="Сумма" class="amount-cell">${formatCurrency(totalPrice)}</td>
                <td data-label="Статус оплаты" class="status-cell">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td data-label="Менеджер">${escapeHtml(managerName)}</td>
                <td data-label="Действия">
                    <div class="actions">
                        <button class="btn btn-small btn-view" data-order-id="${order.id}">Просмотр</button>
                        <button class="btn btn-small btn-delete" data-order-id="${order.id}">Удалить</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function attachOrderEvents() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.classList.contains('btn-view')) {
            const orderId = parseInt(target.dataset.orderId);
            if (!isNaN(orderId)) {
                viewOrder(orderId);
            }
        } else if (target.classList.contains('btn-delete')) {
            const orderId = parseInt(target.dataset.orderId);
            if (!isNaN(orderId)) {
                deleteOrder(orderId);
            }
        }
    });
}

// Функции должны быть доступны глобально для onclick (альтернативное решение)
function viewOrder(orderId) {
    window.location.href = `view-order.html?id=${orderId}`;
}

async function deleteOrder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showTempMessage('Заказ не найден', 'error');
        return;
    }

    try {
        const confirmed = await ModalUtils.confirm({
            title: 'Переместить в архив?',
            message: `Заказ №${order.orderNumber || 'N/A'} будет перемещен в архив. Вы сможете восстановить его в течение 7 дней.`,
            confirmText: 'Да, в архив',
            danger: true
        });
        
        if (confirmed) {
            await apiService.deleteOrder(orderId);
            showTempMessage('Заказ перемещен в архив', 'success');
            await loadOrders();
        }
    } catch (error) {
        handleApiError(error);
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