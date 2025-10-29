import { apiService } from './api.js';
import { ModalUtils } from './modal-utils.js';
import { formatDate, formatCurrency, getStatusBadgeClass, getPaymentStatusText, escapeHtml, showTempMessage } from './utils.js';
import { renderPhotoGrid } from './photo-utils.js';

let currentPage = 1;
let totalPages = 1;
const pageSize = 10;
let allArchivedOrders = [];
let filteredOrders = [];

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

    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);

    // Поиск с debounce (если нужно, но для простоты — на apply)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            // Debounce if imported, but for now simple
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
            totalPages = Math.ceil(response.totalCount / pageSize);
        } else {
            allArchivedOrders = [];
            totalPages = 1;
        }

        applyFilters();
        
    } catch (error) {
        console.error('Ошибка загрузки архивных заказов:', error);
        showTempMessage('Не удалось загрузить архивные заказы: ' + error.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

function applyFilters() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    
    filteredOrders = allArchivedOrders.filter(order => {
        if (!order) return false;
        
        const searchFields = [
            order.orderNumber || '',
            order.customerFullName || '',
            order.phone || '',
            order.deceasedFullName || ''
        ];
        
        const matchesSearch = !searchText || searchFields.some(field => 
            field.toString().toLowerCase().includes(searchText)
        );
        
        return matchesSearch;
    });
    
    currentPage = 1;
    renderArchivedOrdersTable();
}

function renderArchivedOrdersTable() {
    const tbody = document.getElementById('archivedOrdersTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageOrders = filteredOrders.slice(start, end);

    if (pageOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">Архивные заказы не найдены</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = pageOrders.map(order => createArchivedOrderRow(order)).join('');
    }
    
    updatePagination();
}

function createArchivedOrderRow(order) {
    if (!order) return '';

    const orderNumber = order.orderNumber || 'Н/Д';
    const customerFullName = order.customerFullName || 'Н/Д';
    const phone = order.phone || 'Н/Д';
    const deletedAt = formatDate(order.deletedAt || order.updatedAt); // Fallback to updatedAt if no deletedAt
    const daysLeft = calculateDaysLeft(order.deletedAt); // Assume deletedAt is deletion date

    return `
        <tr>
            <td>${escapeHtml(orderNumber)}</td>
            <td>${escapeHtml(customerFullName)}</td>
            <td>${escapeHtml(phone)}</td>
            <td>${deletedAt}</td>
            <td>${daysLeft}</td>
            <td class="actions">
                <button class="btn btn-primary btn-sm" onclick="viewArchivedOrder(${order.id})">👁️</button>
                <button class="btn btn-success btn-sm" onclick="restoreArchivedOrder(${order.id})">🔄 Восстановить</button>
                <button class="btn btn-danger btn-sm" onclick="permanentDeleteArchivedOrder(${order.id})">🗑️ Удалить навсегда</button>
            </td>
        </tr>
    `;
}

function calculateDaysLeft(deletedAt) {
    if (!deletedAt) return '—';
    const deletionDate = new Date(deletedAt);
    const today = new Date();
    const diffTime = today - deletionDate;
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysLeft = 7 - daysPassed;
    return daysLeft > 0 ? `${daysLeft} дней` : 'Истёк';
}

async function viewArchivedOrder(id) {
    try {
        const order = await apiService.getArchivedOrder(id);
        const modal = ModalUtils.createModalBase();  // Assume ModalUtils has this
        modal.innerHTML = `
            <div class="modal-content" style="width: 80%; max-height: 80%; overflow-y: auto;">
                <h2>Архивный заказ ${escapeHtml(order.orderNumber)}</h2>
                <p><strong>Участок:</strong> ${escapeHtml(order.place)}</p>
                <p><strong>ФИО усопшего:</strong> ${escapeHtml(order.deceasedFullName)}</p>
                <p><strong>Клиент:</strong> ${escapeHtml(order.customerFullName)}</p>
                <p><strong>Телефон:</strong> ${escapeHtml(order.phone)}</p>
                <p><strong>Удалён:</strong> ${formatDate(order.deletedAt)}</p>
                <div id="archivedPhotos"></div>
                <button onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        `;
        document.body.appendChild(modal);
        if (order.photos && order.photos.length > 0) {
            renderPhotoGrid(order.photos, 'archivedPhotos', 'view');
        } else {
            document.getElementById('archivedPhotos').innerHTML = '<p>Фото отсутствуют</p>';
        }
    } catch (err) {
        showTempMessage('Ошибка просмотра: ' + err.message, 'error');
    }
}

async function restoreArchivedOrder(id) {
    try {
        const confirmed = await ModalUtils.confirm({
            title: 'Восстановить заказ?',
            message: 'Вернуть в активные заказы?',
            confirmText: 'Да',
            danger: false
        });
        
        if (confirmed) {
            await apiService.restoreArchivedOrder(id);  // Assume API method
            showTempMessage('Заказ восстановлен', 'success');
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
            message: 'Это действие нельзя отменить!',
            confirmText: 'Да',
            danger: true
        });
        
        if (confirmed) {
            await apiService.permanentDeleteArchivedOrder(id);  // Assume API method
            showTempMessage('Заказ удалён навсегда', 'success');
            loadArchivedOrders();
        }
    } catch (error) {
        showTempMessage('Ошибка удаления: ' + error.message, 'error');
    }
}

function updatePagination() {
    const totalPagesCalc = Math.ceil(filteredOrders.length / pageSize);
    const pageInfo = document.getElementById('pageInfo');
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    
    if (pageInfo) {
        pageInfo.textContent = `Страница ${currentPage} из ${totalPagesCalc}`;
    }
    
    if (prevButton) {
        prevButton.disabled = currentPage === 1;
    }
    
    if (nextButton) {
        nextButton.disabled = currentPage >= totalPagesCalc || totalPagesCalc === 0;
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderArchivedOrdersTable();
    }
}

function nextPage() {
    const totalPagesCalc = Math.ceil(filteredOrders.length / pageSize);
    if (currentPage < totalPagesCalc) {
        currentPage++;
        renderArchivedOrdersTable();
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
    filteredOrders = allArchivedOrders;
    currentPage = 1;
    renderArchivedOrdersTable();
}

// Глобальные для onclick
window.viewArchivedOrder = viewArchivedOrder;
window.restoreArchivedOrder = restoreArchivedOrder;
window.permanentDeleteArchivedOrder = permanentDeleteArchivedOrder;