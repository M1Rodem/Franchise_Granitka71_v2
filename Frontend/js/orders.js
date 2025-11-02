import { apiService } from './api.js';
import { formatDate, formatCurrency, escapeHtml, showTempMessage, debounce, getPaymentStatus, getPaymentStatusText, getUserNameFromOrder } from './utils.js';
import { ModalUtils } from './modal-utils.js';

let currentPage = 1;
const pageSize = 10;
let allOrders = [];
let filteredOrders = [];
let totalCount = 0;

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
            filteredOrders = allOrders;
            totalCount = response.totalCount; 
        } else {
            allOrders = [];
            filteredOrders = [];
            totalCount = 0;
        }
        
        renderOrdersTable();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки заказов:', error);
        showTempMessage('Не удалось загрузить заказы: ' + error.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

async function applyFilters() {
    try {
        showLoadingState(true);
        
        const searchText = document.getElementById('searchInput').value;
        const statusFilter = document.getElementById('statusFilter').value;
        
        // Собираем параметры для сервера
        const filterParams = {
            page: currentPage,
            pageSize: pageSize
        };
        
        // Добавляем параметры фильтрации
        if (searchText) {
            filterParams.searchQuery = searchText;
        }
        
        // ФИКС: Правильные значения PaymentStatus для бэкенда
        if (statusFilter && statusFilter !== 'all') {
            // Конвертируем frontend статусы в backend PaymentStatus enum
            const statusMap = {
                'not_paid': 1,    // PaymentStatus.NotPaid
                'partial': 2,     // PaymentStatus.Partial  
                'paid': 3,        // PaymentStatus.Paid
                'overpaid': 4     // PaymentStatus.Overpaid
            };
            filterParams.paymentStatus = statusMap[statusFilter];
        }
        
        // Загружаем данные с сервера с фильтрами
        const response = await apiService.getOrders(filterParams);
        
        if (response && Array.isArray(response.items)) {
            allOrders = response.items;
            filteredOrders = allOrders;
            totalCount = response.totalCount;
        } else {
            allOrders = [];
            filteredOrders = [];
            totalCount = 0;
        }
        
        renderOrdersTable();
        
    } catch (error) {
        console.error('❌ Ошибка фильтрации заказов:', error);
        showTempMessage('Ошибка фильтрации: ' + error.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

// ЗАМЕНИТЕ функцию resetFilters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    const managerFilter = document.getElementById('managerFilter');
    if (managerFilter) managerFilter.value = 'all';
    
    currentPage = 1;
    loadOrders(); // Загружаем заново без фильтров
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const pageOrders = allOrders;

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
    
    // ИСПРАВЛЕНО: используем правильный расчет суммы
    const totalPrice = calculateOrderTotalFromWorkItems(order);
    const paymentStatus = getPaymentStatus(order);
    const managerName = getUserNameFromOrder(order);
    
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
            <td>${escapeHtml(managerName)}</td>
            <td class="actions">
                <button class="btn btn-primary btn-sm" onclick="viewOrder(${order.id})">👁️</button>
                <button class="btn btn-warning btn-sm" onclick="window.location.href='create-order.html?edit=${order.id}'">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteOrder(${order.id})">🗑️</button>
            </td>
        </tr>
    `;
}


function calculateOrderTotalFromWorkItems(order) {
    if (!order) return 0;
    
    // ВСЕГДА считаем из workItems, игнорируем order.totalPrice
    if (order.workItems && Array.isArray(order.workItems)) {
        const total = order.workItems.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 1;
            return sum + (price * quantity);
        }, 0);
        return total;
    }
    
    return order.totalPrice || 0;
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
    const totalPages = Math.ceil(totalCount / pageSize);
    const pageInfo = document.getElementById('pageInfo');
    


    if (pageInfo) {
        pageInfo.textContent = `Страница ${currentPage} из ${totalPages || 1}`;
    }
    
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    
    if (prevButton) {
        prevButton.disabled = currentPage === 1;
        prevButton.style.opacity = currentPage === 1 ? '0.5' : '1';
        prevButton.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
    }
    
    if (nextButton) {
        nextButton.disabled = currentPage >= totalPages;
        nextButton.style.opacity = currentPage >= totalPages ? '0.5' : '1';
        nextButton.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadOrders();
    } else {
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        loadOrders();
    } else {
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