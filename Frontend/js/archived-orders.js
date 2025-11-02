import { apiService } from './api.js';
import { ModalUtils } from './modal-utils.js';
import { formatDate, formatCurrency, getStatusBadgeClass, getPaymentStatusText, escapeHtml, showTempMessage } from './utils.js';
import { renderPhotoGrid } from './photo-utils.js';

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
        // ФИКС: Правильное отображение ФИО
        userNameElement.textContent = userData.fullName || userData.username || 'Пользователь';
    }

    // ФИКС: Показываем пункт "Пользователи" для админов
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
        console.error('❌ Ошибка загрузки архивных заказов:', error);
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

    // ФИКС: используем allArchivedOrders вместо filteredOrders
    const pageOrders = allArchivedOrders; // Все заказы с текущей страницы

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
    const deletedAt = formatDate(order.deletedAt || order.updatedAt);
    const daysLeft = calculateDaysLeft(order.deletedAt || order.updatedAt);

    return `
        <tr>
            <td>${escapeHtml(orderNumber)}</td>
            <td>${escapeHtml(customerFullName)}</td>
            <td>${escapeHtml(phone)}</td>
            <td>${deletedAt}</td>
            <td>${daysLeft}</td>
            <td class="actions">
                <button class="btn btn-primary btn-sm" onclick="viewArchivedOrder(${order.id})">Просмотр</button>
                <button class="btn btn-success btn-sm" onclick="restoreArchivedOrder(${order.id})">Восстановить</button>
                <button class="btn btn-danger btn-sm" onclick="permanentDeleteArchivedOrder(${order.id})">Удалить навсегда</button>
            </td>
        </tr>
    `;
}

// ФИКС: Исправленная функция расчета дней
function calculateDaysLeft(deletedAt) {
    if (!deletedAt) return '—';
    
    try {
        const deletionDate = new Date(deletedAt);
        const today = new Date();
        
        // Приводим к началу дня для точного расчета
        deletionDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - deletionDate.getTime();
        const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const daysLeft = 7 - daysPassed; // ФИКС: 7 дней как на бэке
        
        if (daysLeft > 0) {
            return `${daysLeft} дней`;
        } else if (daysLeft === 0) {
            return 'Последний день';
        } else {
            return 'Истёк';
        }
    } catch (error) {
        console.error('Ошибка расчета дней:', error);
        return '—';MapToResponseDto
    }
}

async function viewArchivedOrder(id) {
    try {
        const order = await apiService.getArchivedOrder(id);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; 
            width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); 
            display: flex; justify-content: center; 
            align-items: center; z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div class="modal-content" style="background: white; padding: 2rem; border-radius: 8px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h2>Архивный заказ ${escapeHtml(order.orderNumber)}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">✕</button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <p><strong>Участок:</strong> ${escapeHtml(order.place)}</p>
                        <p><strong>ФИО усопшего:</strong> ${escapeHtml(order.deceasedFullName)}</p>
                        <p><strong>Клиент:</strong> ${escapeHtml(order.customerFullName)}</p>
                        <p><strong>Телефон:</strong> ${escapeHtml(order.phone)}</p>
                    </div>
                    <div>
                        <p><strong>Email:</strong> ${escapeHtml(order.customerEmail || '—')}</p>
                        <p><strong>Тип памятника:</strong> ${escapeHtml(order.monumentType || '—')}</p>
                        <p><strong>Размер:</strong> ${escapeHtml(order.monumentSize || '—')}</p>
                        <p><strong>Удалён:</strong> ${formatDate(order.deletedAt)}</p>
                    </div>
                </div>
                
                <div>
                    <h3 style="margin-bottom: 0.5rem;">Фотографии</h3>
                    <div id="archivedPhotos"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
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
            await apiService.restoreArchivedOrder(id);
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
            await apiService.permanentDeleteArchivedOrder(id);
            showTempMessage('Заказ удалён навсегда', 'success');
            loadArchivedOrders();
        }
    } catch (error) {
        showTempMessage('Ошибка удаления: ' + error.message, 'error');
    }
}

function updatePagination() {
    const totalPages = Math.ceil(totalCount / pageSize); // ФИКС: используем totalCount
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
        loadArchivedOrders(); // ФИКС: загружаем данные для новой страницы
    } else {
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        loadArchivedOrders(); // ФИКС: загружаем данные для новой страницы
    } else {
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

window.viewArchivedOrder = viewArchivedOrder;
window.restoreArchivedOrder = restoreArchivedOrder;
window.permanentDeleteArchivedOrder = permanentDeleteArchivedOrder;