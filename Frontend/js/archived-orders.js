// archived-orders.js
let currentPage = 1;
const pageSize = 10;
let archivedOrders = [];

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadArchivedOrders();
    setupEventListeners();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    document.getElementById('userName').textContent = userData.fullName || 'Пользователь';
    
    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
    }
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);
    
    document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));
}

async function loadArchivedOrders() {
    try {
        showLoading();
        // 🔥 НУЖНО ДОБАВИТЬ МЕТОД В API ДЛЯ ПОЛУЧЕНИЯ АРХИВНЫХ ЗАКАЗОВ
        const response = await apiService.getArchivedOrders();
        
        if (response && Array.isArray(response.items)) {
            archivedOrders = response.items;
        } else if (Array.isArray(response)) {
            archivedOrders = response;
        } else {
            console.warn('Неожиданный формат ответа:', response);
            archivedOrders = [];
        }
        
        console.log(`📦 Загружено архивных заказов: ${archivedOrders.length}`);
        applyFilters();
    } catch (error) {
        console.error('❌ Ошибка загрузки архивных заказов:', error);
        showError('Не удалось загрузить архивные заказы: ' + error.message);
    }
}

function applyFilters() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = archivedOrders.filter(order => {
        if (!order) return false;
        
        const orderNumber = order.orderNumber || '';
        const customerFullName = order.customerFullName || '';
        const phone = order.phone || '';
        
        return orderNumber.toString().toLowerCase().includes(searchText) ||
               customerFullName.toLowerCase().includes(searchText) ||
               phone.includes(searchText);
    });
    
    currentPage = 1;
    renderArchivedOrders(filtered);
}

function renderArchivedOrders(orders) {
    const tbody = document.getElementById('archivedOrdersTableBody');
    
    const startIndex = (currentPage - 1) * pageSize;
    const pageOrders = orders.slice(startIndex, startIndex + pageSize);
    
    if (pageOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading">Архивных заказов не найдено</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = pageOrders.map(order => {
            const orderNumber = order.orderNumber || 'Н/Д';
            const customerFullName = order.customerFullName || 'Н/Д';
            const phone = order.phone || 'Н/Д';
            const deletedAt = order.deletedAt ? new Date(order.deletedAt).toLocaleDateString('ru-RU') : 'Н/Д';
            const daysLeft = calculateDaysLeft(order.deletedAt);
            
            return `
            <tr>
                <td>${orderNumber}</td>
                <td>${customerFullName}</td>
                <td>${phone}</td>
                <td>${deletedAt}</td>
                <td>
                    <span class="days-badge ${daysLeft <= 1 ? 'danger' : daysLeft <= 3 ? 'warning' : 'normal'}">
                        ${daysLeft} ${getDaysText(daysLeft)}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-info btn-sm" onclick="viewArchivedOrder(${order.id})">👁️</button>
                    <button class="btn btn-success btn-sm" onclick="restoreOrder(${order.id}, '${orderNumber}')">↻</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmPermanentDelete(${order.id}, '${orderNumber}')">🗑️</button>
                </td>
            </tr>
        `}).join('');
    }
    
    updatePagination(orders.length);
}

function calculateDaysLeft(deletedAt) {
    if (!deletedAt) return 0;
    const deletedDate = new Date(deletedAt);
    const expiryDate = new Date(deletedDate);
    expiryDate.setDate(expiryDate.getDate() + 7); // +7 дней
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

function getDaysText(days) {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
}

// Действия с архивными заказами
async function viewArchivedOrder(id) {
    window.location.href = `view-archived-order.html?id=${id}`;
}

async function restoreOrder(id, orderNumber) {
    const confirmed = await ModalUtils.confirm({
        title: 'Восстановление заказа',
        message: `Восстановить заказ №${orderNumber}?`,
        confirmText: 'Восстановить'
    });
    
    if (confirmed) {
        try {
            await apiService.restoreOrder(id);
            showTempMessage(`Заказ №${orderNumber} восстановлен!`, 'success');
            await loadArchivedOrders(); // Перезагружаем список
        } catch (error) {
            showTempMessage('Ошибка восстановления: ' + error.message, 'error');
        }
    }
}

async function permanentDeleteOrder(id) {
    try {
        await apiService.permanentDeleteOrder(id);
        showTempMessage('Заказ полностью удален из архива!', 'success');
        await loadArchivedOrders(); // Перезагружаем список
    } catch (error) {
        showTempMessage('Ошибка удаления: ' + error.message, 'error');
    }
}

// Вспомогательные функции (аналогичные orders.js)
function showLoading() {
    document.getElementById('archivedOrdersTableBody').innerHTML = `
        <tr>
            <td colspan="6" class="loading">Загрузка...</td>
        </tr>
    `;
}

function showError(message) {
    document.getElementById('archivedOrdersTableBody').innerHTML = `
        <tr>
            <td colspan="6" class="loading" style="color: #dc3545;">${message}</td>
        </tr>
    `;
}

function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / pageSize);
    document.getElementById('pageInfo').textContent = `Страница ${currentPage} из ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        applyFilters();
    }
}

function nextPage() {
    const totalPages = Math.ceil(archivedOrders.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        applyFilters();
    }
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    applyFilters();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.href = 'login.html';
}