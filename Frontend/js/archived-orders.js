import { apiService } from './api.js';
import { ModalUtils } from './modal-utils.js';
import { 
    formatDate, 
    formatCurrency, 
    escapeHtml, 
    showTempMessage,
    getUserNameFromOrder,
    formatFileSize,
    getPaymentStatus,
    getPaymentStatusText
} from './utils.js';

let currentPage = 1;
let totalPages = 1;
const pageSize = 10;
let allArchivedOrders = [];
let filteredOrders = [];
let totalCount = 0;

document.addEventListener('DOMContentLoaded', function() {
    initializeArchivedOrdersPage();
});

function initializeArchivedOrdersPage() {
    const userData = apiService.getCurrentUser();
    if (!userData) {
        window.location.href = 'login.html';
        return;
    }

    setupPageUI(userData);
    setupEventListeners();
    loadArchivedOrders();
}

function setupPageUI(userData) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.fullName || userData.username || 'Пользователь';
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

    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            applyFilters();
        });
    }
}

async function loadArchivedOrders() {
    try {
        showLoadingState(true);

        const response = await apiService.getArchivedOrders({
            page: currentPage,
            pageSize: pageSize
        });

        if (response && Array.isArray(response.items)) {
            allArchivedOrders = response.items;
            filteredOrders = allArchivedOrders;
            totalCount = response.totalCount; 
        } else {
            allArchivedOrders = [];
            filteredOrders = [];
            totalCount = 0;
        }

        renderArchivedOrdersTable();
        
    } catch (error) {
        console.error('Ошибка загрузки архивных заказов:', error);
        showTempMessage('Не удалось загрузить архивные заказы: ' + error.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

async function applyFilters() {
    try {
        showLoadingState(true);
        
        const searchText = document.getElementById('searchInput').value;
        
        const filterParams = {
            page: currentPage,
            pageSize: pageSize
        };
        
        if (searchText) {
            filterParams.searchQuery = searchText;
        }
        
        const response = await apiService.getArchivedOrders(filterParams);
        
        if (response && Array.isArray(response.items)) {
            allArchivedOrders = response.items;
            filteredOrders = allArchivedOrders;
            totalCount = response.totalCount;
        } else {
            allArchivedOrders = [];
            filteredOrders = [];
            totalCount = 0;
        }
        
        renderArchivedOrdersTable();
        
    } catch (error) {
        console.error('Ошибка фильтрации архивных заказов:', error);
        showTempMessage('Ошибка фильтрации: ' + error.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

function renderArchivedOrdersTable() {
    const tbody = document.getElementById('archivedOrdersTableBody');
    if (!tbody) return;

    const pageOrders = allArchivedOrders;

    if (pageOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">Архивные заказы не найдены</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = pageOrders.map(order => createArchivedOrderRow(order)).join('');
        
        setTimeout(() => {
            document.querySelectorAll('.orders-table td').forEach((td, index) => {
                const headerText = document.querySelectorAll('.orders-table th')[index % 6]?.textContent;
                if (headerText) {
                    td.setAttribute('data-label', headerText);
                }
            });
        }, 100);
    }
    
    updatePagination();
}

function createArchivedOrderRow(order) {
    if (!order) return '';

    const orderNumber = order.orderNumber || 'Н/Д';
    const customerFullName = order.customerFullName || 'Н/Д';
    const phone = order.phone || 'Н/Д';
    const deletedAt = formatDate(order.deletedAt || order.updatedAt);
    const daysLeft = calculateDaysLeft(order.deletedAt || order.updatedAt);
    
    const daysClass = getDaysClass(daysLeft);

    return `
        <tr>
            <td data-label="№ Заказа">${escapeHtml(orderNumber)}</td>
            <td data-label="Клиент">${escapeHtml(customerFullName)}</td>
            <td data-label="Телефон">${escapeHtml(phone)}</td>
            <td data-label="Дата удаления">${deletedAt}</td>
            <td data-label="Осталось дней" class="${daysClass}">${daysLeft}</td>
            <td data-label="Действия" class="actions">
                <button class="btn btn-primary btn-sm" onclick="viewArchivedOrder(${order.id})" 
                        title="Просмотреть детали заказа">
                    Просмотр
                </button>
                <button class="btn btn-success btn-sm" onclick="restoreArchivedOrder(${order.id})" 
                        title="Вернуть заказ в активные">
                    Восстановить
                </button>
                <button class="btn btn-danger btn-sm" onclick="permanentDeleteArchivedOrder(${order.id})" 
                        title="Удалить заказ безвозвратно">
                    Удалить
                </button>
            </td>
        </tr>
    `;
}

function getDaysClass(daysLeft) {
    if (daysLeft.includes('Истёк')) return 'days-critical';
    if (daysLeft.includes('Последний')) return 'days-warning';
    return 'days-normal';
}

function calculateDaysLeft(deletedAt) {
    if (!deletedAt) return '—';
    
    try {
        const deletionDate = new Date(deletedAt);
        const today = new Date();
        
        deletionDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - deletionDate.getTime();
        const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const daysLeft = 7 - daysPassed;
        
        if (daysLeft > 0) {
            return `${daysLeft} дней`;
        } else if (daysLeft === 0) {
            return 'Последний день';
        } else {
            return 'Истёк';
        }
    } catch (error) {
        console.error('Ошибка расчета дней:', error);
        return '—';
    }
}

async function viewArchivedOrder(id) {
    try {
        const order = await apiService.getArchivedOrder(id);
        ModalUtils.showArchivedOrderModal(order);
    } catch (err) {
        console.error('Error viewing archived order:', err);
        showTempMessage('Ошибка просмотра: ' + err.message, 'error');
    }
}

async function restoreArchivedOrder(id) {
    try {
        const confirmed = await ModalUtils.confirm({
            title: 'Восстановить заказ?',
            message: 'Вы уверены, что хотите вернуть этот заказ в активные?',
            confirmText: 'Да, восстановить',
            danger: false
        });
        
        if (confirmed) {
            await apiService.restoreArchivedOrder(id);
            showTempMessage('Заказ успешно восстановлен', 'success');
            loadArchivedOrders();
        }
    } catch (error) {
        showTempMessage('Ошибка восстановления: ' + error.message, 'error');
    }
}

async function permanentDeleteArchivedOrder(id) {
    try {
        const confirmed = await ModalUtils.confirm({
            title: 'Удалить навсегда?',
            message: 'Это действие нельзя отменить! Заказ будет удалён безвозвратно.',
            confirmText: 'Да, удалить',
            danger: true
        });
        
        if (confirmed) {
            await apiService.permanentDeleteArchivedOrder(id);
            showTempMessage('Заказ удалён навсегда', 'success');
            loadArchivedOrders();
        }
    } catch (error) {
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
        loadArchivedOrders();
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        loadArchivedOrders();
    }
}

function showLoadingState(loading) {
    const tbody = document.getElementById('archivedOrdersTableBody');
    if (!tbody) return;
    
    if (loading) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading">Загрузка архивных заказов...</td>
            </tr>
        `;
    }
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    currentPage = 1;
    loadArchivedOrders();
}

// Расчет общей стоимости заказа
export function calculateOrderTotal(order) {
    if (!order || !order.workItems || !Array.isArray(order.workItems)) {
        return order?.totalPrice || 0;
    }
    
    return order.workItems.reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        return sum + (price * quantity);
    }, 0);
}

window.viewArchivedOrder = viewArchivedOrder;
window.restoreArchivedOrder = restoreArchivedOrder;
window.permanentDeleteArchivedOrder = permanentDeleteArchivedOrder;