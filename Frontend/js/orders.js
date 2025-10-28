let currentPage = 1;
const pageSize = 10;
let allOrders = [];
let filteredOrders = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeOrdersPage();
});

async function initializeOrdersPage() {
    try {
        // Используем глобальную проверку авторизации
        const userData = checkAuth();
        if (!userData) return;

        setupPageUI(userData);
        setupOrdersEventListeners();
        await loadOrders();
        
    } catch (error) {
        console.error('Orders page initialization error:', error);
        showErrorMessage('Ошибка инициализации страницы заказов');
    }
}

function setupPageUI(userData) {
    // Устанавливаем имя пользователя
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'Пользователь';
    }

    // Показываем админские пункты меню
    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = 'block';
        });
    }
}

function setupOrdersEventListeners() {
    // Используем глобальную функцию выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Локальные обработчики для заказов
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);
    
    // Поиск при вводе (debounce должен быть в utils.js)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }
}

async function loadOrders() {
    try {
        showLoadingState(true);
        
        // Используем пагинацию из API
        const response = await apiService.getOrders({
            page: currentPage,
            pageSize: pageSize
        });

        // Обрабатываем ответ API
        if (response && Array.isArray(response.items)) {
            allOrders = response.items;
            console.log(`Загружено ${allOrders.length} заказов`);
        } else {
            console.warn('Неожиданный формат ответа:', response);
            allOrders = [];
        }
        
        applyFilters();
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        showErrorMessage('Не удалось загрузить заказы: ' + error.message);
    } finally {
        showLoadingState(false);
    }
}

function applyFilters() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    
    // Защита от некорректных данных
    if (!Array.isArray(allOrders)) {
        allOrders = [];
    }
    
    filteredOrders = allOrders.filter(order => {
        if (!order) return false;
        
        const matchesSearch = matchesOrderSearch(order, searchText);
        const matchesStatus = matchesOrderStatus(order, statusFilter);
        
        return matchesSearch && matchesStatus;
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
    
    const paymentStatus = calculatePaymentStatus(order);
    return paymentStatus === statusFilter;
}

function calculatePaymentStatus(order) {
    if (!order || !order.payments) return 'not_paid';
    
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const totalPrice = Number(order.totalPrice) || 0;
    
    if (totalPaid === 0) return 'not_paid';
    if (totalPaid < totalPrice) return 'partial';
    return 'paid';
}

function getPaymentStatusText(order) {
    const status = calculatePaymentStatus(order);
    const statusMap = {
        'not_paid': 'Не оплачено',
        'partial': 'Частично оплачено', 
        'paid': 'Оплачено'
    };
    return statusMap[status] || 'Не оплачено';
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    applyFilters();
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    // Защита от некорректных данных
    if (!Array.isArray(filteredOrders)) {
        filteredOrders = [];
    }
    
    const startIndex = (currentPage - 1) * pageSize;
    const pageOrders = filteredOrders.slice(startIndex, startIndex + pageSize);
    
    if (pageOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-data">Заказы не найдены</td>
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
    const paymentStatus = calculatePaymentStatus(order);
    
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
            <td class="actions">
                <button class="btn btn-primary btn-sm" onclick="viewOrder(${order.id})">👁️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteOrder(${order.id})">🗑️</button>
            </td>
        </tr>
    `;
}

async function deleteOrder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showErrorMessage('Заказ не найден');
        return;
    }
    
    const orderNumber = order.orderNumber || 'Н/Д';
    
    try {
        const confirmed = await showConfirmModal({
            title: 'Удаление заказа',
            message: `Вы уверены, что хотите удалить заказ №${orderNumber}? Заказ будет перемещен в архив.`,
            confirmText: 'Удалить',
            danger: true
        });
        
        if (confirmed) {
            await apiService.deleteOrder(orderId);
            showSuccessMessage(`Заказ №${orderNumber} перемещен в архив`);
            await loadOrders(); // Перезагружаем список
        }
    } catch (error) {
        console.error('Ошибка удаления заказа:', error);
        showErrorMessage('Ошибка удаления заказа: ' + error.message);
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
                <td colspan="7" class="loading">Загрузка заказов...</td>
            </tr>
        `;
    }
}

function showErrorMessage(message) {
    showTempMessage(message, 'error');
}

function showSuccessMessage(message) {
    showTempMessage(message, 'success');
}

// Глобальные функции для использования в HTML
window.viewOrder = function(orderId) {
    window.location.href = `view-order.html?id=${orderId}`;
};

window.deleteOrder = deleteOrder;