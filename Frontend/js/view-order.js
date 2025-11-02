import { apiService } from './api.js';
import { formatDate, formatCurrency, escapeHtml, showTempMessage, getPaymentStatus, getPaymentStatusText, getUserNameFromOrder } from './utils.js';
import { renderPhotoGrid, attachPhotoEvents  } from './photo-utils.js';
import { ModalUtils } from './modal-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initializeViewOrderPage();
});

window.addEventListener('beforeunload', () => {
    if (typeof cleanupPhotoBlobs === 'function') {
        cleanupPhotoBlobs();
    }
});

async function initializeViewOrderPage() {
    try {
        const userData = apiService.getCurrentUser();
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }

        setupViewOrderUI(userData);
        await loadOrderData();
        
    } catch (error) {
        console.error('View order page initialization error:', error);
        showTempMessage('Ошибка инициализации', 'error');
    }
}

function setupViewOrderUI(userData) {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        userNameEl.textContent = userData.fullName || 'Пользователь';
    }

    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => apiService.logout());
    }
}

async function loadOrderData() {
    const orderId = getOrderIdFromURL();
    if (!orderId) {
        showTempMessage('Некорректный ID заказа', 'error');
        return;
    }

    try {
        showLoadingState(true);
        
        const [order, photos] = await Promise.all([
            apiService.getOrder(orderId),
            apiService.getOrderPhotos(orderId)
        ]);

        renderOrderDetails(order);
        renderOrderPhotos(photos);
        setupOrderActions(orderId, order);
        
    } catch (error) {
        console.error('Error loading order data:', error);
        showTempMessage('Ошибка загрузки: ' + error.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

function getOrderIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'), 10);
    return isNaN(id) ? null : id;
}

function setupOrderActions(orderId, order) {
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            window.location.href = `create-order.html?edit=${orderId}`;  // П.8: в create с edit mode
        });
    }

    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            await deleteOrder(orderId, order.orderNumber);
        });
    }
}

function renderOrderDetails(order) {
    const view = document.getElementById('orderView');
    if (!view) return;

    view.innerHTML = createOrderHTML(order);
}

function createOrderHTML(order) {
    const paymentStatus = getPaymentStatus(order);
    const statusText = getPaymentStatusText(order);
    
    // ВАЖНО: рассчитываем сумму из workItems, а не берем из базы
    const calculatedTotal = calculateOrderTotalFromWorkItems(order);

    return `
        <header class="order-header refined-header">
            <h1 class="refined-h1">Заказ №${escapeHtml(order.orderNumber)}</h1>
            <div class="refined-meta">
                <div class="meta-line">
                    <span class="meta-icon">📅</span>
                    <strong class="meta-label">Дата создания:</strong>
                    <span class="meta-value">${formatDate(order.createdAt)}</span>
                </div>
                <div class="meta-line">
                    <span class="status-badge refined-badge ${paymentStatus}">${escapeHtml(statusText)}</span>
                </div>
                <div class="meta-line">
                    <span class="meta-icon">💰</span>
                    <strong class="meta-label">Общая сумма:</strong>
                    <span class="meta-value bold-sum">${formatCurrency(calculatedTotal)}</span>
                </div>
                <!-- П.1: Менеджер -->
                <div class="meta-line">
                    <span class="meta-icon">👤</span>
                    <strong class="meta-label">Заказ принял:</strong>
                    <span class="meta-value">${getUserNameFromOrder(order)}</span>
                </div>
            </div>
        </header>

        <div class="refined-sections">
            ${createCustomerSection(order)}
            ${createDeceasedSection(order)}
            ${createMonumentSection(order)}
            ${createManagerSection(order)}
        </div>

        <div class="refined-tables">
            <section class="refined-table-section">
                <h2 class="refined-h2">Виды работ</h2>
                ${renderWorksTable(order.workItems)}
            </section>

            <section class="refined-table-section">
                <h2 class="refined-h2">Платежи</h2>
                ${renderPaymentsTable(order.payments)}
            </section>
        </div>
    `;
}

// Добавляем функцию расчета суммы из workItems
function calculateOrderTotalFromWorkItems(order) {
    if (!order || !order.workItems || !Array.isArray(order.workItems)) {
        return order?.totalPrice || 0;
    }
    
    const total = order.workItems.reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        return sum + (price * quantity);
    }, 0);
    return total;
}

function createCustomerSection(order) {
    return `
        <section class="refined-section">
            <h3>Заказчик</h3>
            <p><strong>ФИО:</strong> ${escapeHtml(order.customerFullName)}</p>
            <p><strong>Телефон:</strong> ${escapeHtml(order.phone)}</p>
            <p><strong>Email:</strong> ${escapeHtml(order.customerEmail || 'Не указан')}</p>
            <p><strong>Адрес:</strong> ${escapeHtml(order.address)}</p>
        </section>
    `;
}

function createDeceasedSection(order) {
    return `
        <section class="refined-section">
            <h3>Усопший</h3>
            <p><strong>ФИО:</strong> ${escapeHtml(order.deceasedFullName)}</p>
            <p><strong>Место осмотра:</strong> ${escapeHtml(order.inspectionPlace || 'Не указано')}</p>
        </section>
    `;
}

function createMonumentSection(order) {
    return `
        <section class="refined-section">
            <h3>Памятник</h3>
            <p><strong>Тип:</strong> ${escapeHtml(order.monumentType)}</p>
            <p><strong>Размер:</strong> ${escapeHtml(order.monumentSize)}</p>
            <p><strong>Доп. info:</strong> ${escapeHtml(order.additionalInfo || 'Нет')}</p>
        </section>
    `;
}

function createManagerSection(order) {
    return `
        <section class="refined-section">
            <h3>Участок</h3>
            <p><strong>Участок:</strong> ${escapeHtml(order.place)}</p>
        </section>
    `;
}

function renderWorksTable(workItems) {
    if (!workItems || workItems.length === 0) return '<p>Нет работ</p>';
    return `
        <table class="refined-table">
            <thead><tr><th>Вид работы</th><th>Стоимость</th><th>Кол-во</th><th>Примечание</th><th>Итого</th></tr></thead>
            <tbody>${workItems.map(wi => `<tr><td>${escapeHtml(wi.workDescription)}</td><td>${formatCurrency(wi.price)}</td><td>${wi.quantity}</td><td>${escapeHtml(wi.note || '')}</td><td>${formatCurrency(wi.price * wi.quantity)}</td></tr>`).join('')}</tbody>
        </table>
    `;
}

function renderPaymentsTable(payments) {
    if (!payments || payments.length === 0) return '<p>Нет платежей</p>';
    return `
        <table class="refined-table">
            <thead><tr><th>Тип</th><th>Сумма</th><th>Дата</th><th>Примечание</th></tr></thead>
            <tbody>${payments.map(p => `<tr><td>${escapeHtml(p.paymentType)}</td><td>${formatCurrency(p.amount)}</td><td>${formatDate(p.paymentDate)}</td><td>${escapeHtml(p.note || '')}</td></tr>`).join('')}</tbody>
        </table>
    `;
}

async function renderOrderPhotos(photos) {
    const container = document.getElementById('orderPhotos');
    if (!container) return;
    
    
    if (!photos || photos.length === 0) {
        container.innerHTML = '<div class="no-photos">Нет фотографий</div>';
        return;
    }
    
    await renderPhotoGrid(photos, 'orderPhotos', 'view');
    
    attachPhotoEvents('orderPhotos');

}

async function deleteOrder(orderId, orderNumber) {
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
            setTimeout(() => {
                window.location.href = 'orders.html';
            }, 1500);
        }
    } catch (error) {
        console.error('Delete order error:', error);
        showTempMessage('Ошибка удаления: ' + error.message, 'error');
    }
}

function showLoadingState(loading) {
    const orderView = document.getElementById('orderView');
    const orderPhotos = document.getElementById('orderPhotos');
    
    if (loading) {
        if (orderView) orderView.innerHTML = '<div class="loading">Загрузка заказа...</div>';
        if (orderPhotos) orderPhotos.innerHTML = '<div class="loading">Загрузка фотографий...</div>';
    }
}

// Глобальные для HTML onclick (если нужно, но теперь через photo-utils)
window.openPhotoViewer = (photoId, fileName) => { /* Если legacy */ };
window.downloadPhoto = async (photoId, fileName) => {
    try {
        await apiService.downloadPhoto(photoId);  // П.7: Авто-скачивание
    } catch (error) {
        showTempMessage('Ошибка скачивания: ' + error.message, 'error');
    }
};