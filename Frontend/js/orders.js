let currentPage = 1;
const pageSize = 10;
let allOrders = [];
let filteredOrders = [];

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadOrders();
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
    
    // Поиск при вводе
    document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));
}

async function loadOrders() {
    try {
        showLoading();
        const response = await apiService.getOrders();
        
        // 🔥 ИСПРАВЛЕНИЕ: Извлекаем массив заказов из ответа
        console.log('📦 Ответ от API:', response);
        
        if (response && Array.isArray(response.items)) {
            // Если ответ в формате { items: [], totalCount: number }
            allOrders = response.items;
            console.log(`✅ Загружено ${allOrders.length} заказов из response.items`);
        } else if (Array.isArray(response)) {
            // Если ответ - просто массив
            allOrders = response;
            console.log(`✅ Загружено ${allOrders.length} заказов из response`);
        } else if (response && response.data && Array.isArray(response.data)) {
            // Если ответ в формате { data: [] }
            allOrders = response.data;
            console.log(`✅ Загружено ${allOrders.length} заказов из response.data`);
        } else {
            console.warn('⚠️ Неожиданный формат ответа:', response);
            allOrders = [];
        }
        
        console.log('📋 Заказы для отображения:', allOrders);
        applyFilters();
    } catch (error) {
        console.error('❌ Ошибка загрузки заказов:', error);
        showError('Не удалось загрузить заказы: ' + error.message);
    }
}

function applyFilters() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    
    // 🔥 ЗАЩИТА: Убеждаемся, что allOrders - массив
    if (!Array.isArray(allOrders)) {
        console.error('❌ allOrders не является массивом:', allOrders);
        allOrders = [];
    }
    
    console.log(`🔍 Применение фильтров. Заказов: ${allOrders.length}, поиск: "${searchText}", статус: ${statusFilter}`);
    
    filteredOrders = allOrders.filter(order => {
        // 🔥 ЗАЩИТА: Проверяем, что order существует
        if (!order) return false;
        
        // 🔥 ЗАЩИТА: Проверяем наличие полей перед использованием
        const orderNumber = order.orderNumber || '';
        const customerFullName = order.customerFullName || '';
        const phone = order.phone || '';
        
        // Поиск
        const matchesSearch = 
            orderNumber.toString().toLowerCase().includes(searchText) ||
            customerFullName.toLowerCase().includes(searchText) ||
            phone.includes(searchText);
        
        // Фильтр по статусу
        const paymentStatus = getPaymentStatus(order);
        const matchesStatus = 
            statusFilter === 'all' ||
            (statusFilter === 'not_paid' && paymentStatus === 'unpaid') ||
            (statusFilter === 'partial' && paymentStatus === 'partial') ||
            (statusFilter === 'paid' && paymentStatus === 'paid');
        
        return matchesSearch && matchesStatus;
    });
    
    console.log(`✅ Отфильтровано заказов: ${filteredOrders.length}`);
    currentPage = 1;
    renderOrders();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    applyFilters();
}

function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    
    // 🔥 ЗАЩИТА: Убеждаемся, что filteredOrders - массив
    if (!Array.isArray(filteredOrders)) {
        console.error('❌ filteredOrders не является массивом:', filteredOrders);
        filteredOrders = [];
    }
    
    const startIndex = (currentPage - 1) * pageSize;
    const pageOrders = filteredOrders.slice(startIndex, startIndex + pageSize);
    
    console.log(`📄 Рендеринг страницы ${currentPage}: ${pageOrders.length} заказов`);
    
    if (pageOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading">Заказы не найдены</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = pageOrders.map(order => {
            // 🔥 ЗАЩИТА: Проверяем наличие полей
            if (!order) return '';
            
            const orderNumber = order.orderNumber || 'Н/Д';
            const customerFullName = order.customerFullName || 'Н/Д';
            const phone = order.phone || 'Н/Д';
            const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString('ru-RU') : 'Н/Д';
            const totalPrice = order.totalPrice || 0;
            
            return `
            <tr>
                <td>${orderNumber}</td>
                <td>${customerFullName}</td>
                <td>${phone}</td>
                <td>${createdAt}</td>
                <td>${formatCurrency(totalPrice)}</td>
                <td>
                    <span class="status-badge status-${getPaymentStatus(order)}">
                        ${getPaymentStatusText(order)}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-primary btn-sm" onclick="viewOrder(${order.id})">👁️</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteOrder(${order.id})">🗑️</button>
                </td>
            </tr>
        `}).join('');
    }
    
    updatePagination();
}

function getPaymentStatus(order) {
    if (!order) return 'unpaid';
    
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount)||0), 0);
    const totalPrice = Number(order.totalPrice) || 0;
    
    if (totalPaid === 0) return 'unpaid';
    if (totalPaid < totalPrice) return 'partial';
    return 'paid';
}

function getPaymentStatusText(order) {
    if (!order) return 'Не оплачено';
    
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount)||0), 0);
    const totalPrice = Number(order.totalPrice) || 0;
    
    if (totalPaid === 0) return 'Не оплачено';
    if (totalPaid < totalPrice) return 'Частично оплачено';
    return 'Оплачено';
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB'
    }).format(amount || 0);
}

function updatePagination() {
    const totalPages = Math.ceil(filteredOrders.length / pageSize);
    document.getElementById('pageInfo').textContent = `Страница ${currentPage} из ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderOrders();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredOrders.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderOrders();
    }
}

function showLoading() {
    document.getElementById('ordersTableBody').innerHTML = `
        <tr>
            <td colspan="7" class="loading">Загрузка...</td>
        </tr>
    `;
}

function showError(message) {
    document.getElementById('ordersTableBody').innerHTML = `
        <tr>
            <td colspan="7" class="loading" style="color: #dc3545;">${message}</td>
        </tr>
    `;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.href = 'login.html';
}

// Вспомогательная функция для задержки поиска
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Заглушки для действий
function viewOrder(id) {
    window.location.href = `view-order.html?id=${id}`;
}

async function deleteOrder(id) {
    if (!confirm('Удалить заказ?')) return;
    try {
        await apiService.deleteOrder(id);
        // Обновим данные и фильтры
        await loadOrders();
    } catch (e) {
        alert(e.message || 'Не удалось удалить заказ');
    }
}