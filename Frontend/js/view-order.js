document.addEventListener('DOMContentLoaded', async () => {
    await initializeViewOrderPage();
});

async function initializeViewOrderPage() {
    try {
        // Используем глобальную проверку авторизации
        const userData = checkAuth();
        if (!userData) return;

        setupViewOrderUI(userData);
        await loadOrderData();
        
    } catch (error) {
        console.error('View order page initialization error:', error);
        showErrorMessage('Ошибка инициализации страницы просмотра заказа');
    }
}

function setupViewOrderUI(userData) {
    // Устанавливаем имя пользователя
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        userNameEl.textContent = userData.fullName || 'Пользователь';
    }

    // Показываем админские пункты меню
    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    // Настраиваем кнопку выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

async function loadOrderData() {
    const orderId = getOrderIdFromURL();
    if (!orderId) {
        showErrorMessage('Некорректный ID заказа');
        return;
    }

    try {
        showLoadingState(true);
        
        // Параллельно загружаем заказ и фото
        const [order, photos] = await Promise.all([
            apiService.getOrder(orderId),
            apiService.getOrderPhotos(orderId)
        ]);

        renderOrderDetails(order);
        renderOrderPhotos(photos);
        setupOrderActions(orderId, order);
        
    } catch (error) {
        console.error('Error loading order data:', error);
        showErrorMessage('Ошибка загрузки данных заказа: ' + error.message);
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
    const deleteBtn = document.getElementById('deleteBtn');

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            window.location.href = `edit-order.html?id=${orderId}`;
        });
    }

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
    const paymentStatus = calculatePaymentStatus(order);
    const statusText = getPaymentStatusText(order);

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
                    <span class="meta-value bold-sum">${formatCurrency(order.totalPrice)}</span>
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

        ${order.additionalInfo ? createAdditionalInfoSection(order.additionalInfo) : ''}
    `;
}

function createCustomerSection(order) {
    return `
        <section class="refined-section customer-section">
            <h2 class="refined-h2">Заказчик</h2>
            <div class="refined-info">
                <div class="info-line">
                    <strong class="info-label">ФИО:</strong>
                    <span class="info-value">${escapeHtml(order.customerFullName)}</span>
                </div>
                <div class="info-line">
                    <strong class="info-label">Телефон:</strong>
                    <span class="info-value">${formatPhone(order.phone)}</span>
                </div>
                ${order.customerEmail ? `
                <div class="info-line">
                    <strong class="info-label">Email:</strong>
                    <span class="info-value">${escapeHtml(order.customerEmail)}</span>
                </div>
                ` : ''}
            </div>
        </section>
    `;
}

function createDeceasedSection(order) {
    return `
        <section class="refined-section deceased-section">
            <h2 class="refined-h2">Усопший</h2>
            <div class="refined-info">
                <div class="info-line">
                    <strong class="info-label">ФИО:</strong>
                    <span class="info-value">${escapeHtml(order.deceasedFullName)}</span>
                </div>
                <div class="info-line">
                    <strong class="info-label">Адрес участка:</strong>
                    <span class="info-value">${escapeHtml(order.address)}</span>
                </div>
            </div>
        </section>
    `;
}

function createMonumentSection(order) {
    return `
        <section class="refined-section monument-section">
            <h2 class="refined-h2">Памятник</h2>
            <div class="refined-info">
                <div class="info-line">
                    <strong class="info-label">Тип:</strong>
                    <span class="info-value">${escapeHtml(order.monumentType || order.monument || '')}</span>
                </div>
                <div class="info-line">
                    <strong class="info-label">Размер:</strong>
                    <span class="info-value">${escapeHtml(order.monumentSize)}</span>
                </div>
                <div class="info-line">
                    <strong class="info-label">Место установки:</strong>
                    <span class="info-value">${escapeHtml(order.place)}</span>
                </div>
                ${order.inspectionPlace ? `
                <div class="info-line">
                    <strong class="info-label">Место осмотра:</strong>
                    <span class="info-value">${escapeHtml(order.inspectionPlace)}</span>
                </div>
                ` : ''}
            </div>
        </section>
    `;
}

function createManagerSection(order) {
    return `
        <section class="refined-section manager-section">
            <h2 class="refined-h2">Менеджер</h2>
            <div class="refined-info">
                <div class="info-line">
                    <strong class="info-label">Ответственный:</strong>
                    <span class="info-value">${escapeHtml(order.managerFullName || order.manager?.fullName || 'Не назначен')}</span>
                </div>
            </div>
        </section>
    `;
}

function createAdditionalInfoSection(additionalInfo) {
    return `
        <section class="refined-section additional-section">
            <h2 class="refined-h2">Дополнительная информация</h2>
            <div class="refined-info-text">
                <p class="refined-p">${escapeHtml(additionalInfo)}</p>
            </div>
        </section>
    `;
}

function renderWorksTable(workItems) {
    if (!workItems || workItems.length === 0) {
        return '<div class="refined-no-data">Нет работ</div>';
    }

    const rows = workItems.map((work, index) => `
        <tr class="refined-tr ${index % 2 === 0 ? 'refined-even' : 'refined-odd'}">
            <td class="refined-td refined-description">${escapeHtml(work.workDescription || '')}</td>
            <td class="refined-td refined-price">${formatCurrency(work.price || 0)}</td>
            <td class="refined-td refined-quantity">${work.quantity || 1}</td>
            <td class="refined-td refined-note">${escapeHtml(work.note || '')}</td>
        </tr>
    `).join('');

    return `
        <table class="refined-table">
            <thead>
                <tr>
                    <th class="refined-th">Вид работы</th>
                    <th class="refined-th">Цена</th>
                    <th class="refined-th">Кол-во</th>
                    <th class="refined-th">Примечание</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderPaymentsTable(payments) {
    if (!payments || payments.length === 0) {
        return '<div class="refined-no-data">Нет платежей</div>';
    }

    const rows = payments.map((payment, index) => `
        <tr class="refined-tr ${index % 2 === 0 ? 'refined-even' : 'refined-odd'}">
            <td class="refined-td refined-type">${escapeHtml(payment.paymentType || '')}</td>
            <td class="refined-td refined-price">${formatCurrency(payment.amount || 0)}</td>
            <td class="refined-td refined-date">${formatDate(payment.paymentDate)}</td>
            <td class="refined-td refined-note">${escapeHtml(payment.note || '')}</td>
        </tr>
    `).join('');

    return `
        <table class="refined-table">
            <thead>
                <tr>
                    <th class="refined-th">Тип</th>
                    <th class="refined-th">Сумма</th>
                    <th class="refined-th">Дата</th>
                    <th class="refined-th">Примечание</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderOrderPhotos(photos) {
    const container = document.getElementById('orderPhotos');
    if (!container) return;

    if (!photos || photos.length === 0) {
        container.innerHTML = '<div class="no-data">Нет фотографий</div>';
        return;
    }

    container.innerHTML = photos.map(photo => createPhotoViewItem(photo)).join('');
}

function createPhotoViewItem(photo) {
    const previewUrl = `/api/Photos/proxy/${photo.id}`;
    
    return `
        <div class="photo-item view-mode">
            <img src="${previewUrl}" 
                 alt="${escapeHtml(photo.originalFileName)}" 
                 style="cursor: pointer; max-height: 150px; object-fit: cover;"
                 onclick="openPhotoViewer(${photo.id}, '${escapeHtml(photo.originalFileName)}')">
            <div class="photo-caption">${escapeHtml(photo.originalFileName)}</div>
        </div>
    `;
}

function openPhotoViewer(photoId, fileName) {
    const previewUrl = `/api/Photos/proxy/${photoId}`;
    
    const modal = document.createElement('div');
    modal.className = 'photo-modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div class="photo-modal-content" style="position: relative; max-width: 90%; max-height: 90%; text-align: center;">
            <span class="photo-modal-close" style="position: absolute; top: 10px; right: 10px; font-size: 30px; color: white; cursor: pointer; z-index: 10001;">&times;</span>
            <img src="${previewUrl}" alt="${fileName}" style="max-width: 100%; max-height: 80vh; object-fit: contain;">
            <div style="color: white; margin-top: 10px;">${fileName}</div>
            <button onclick="downloadPhoto(${photoId}, '${escapeHtml(fileName)}')" 
                    class="btn btn-primary" 
                    style="margin-top: 10px;">📥 Скачать фото</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Закрытие модального окна
    const closeModal = () => {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
    };
    
    modal.querySelector('.photo-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    const handleEscape = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleEscape);
}

async function downloadPhoto(photoId, fileName) {
    try {
        const downloadUrl = await apiService.downloadPhoto(photoId);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName || `photo_${photoId}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Очищаем URL после скачивания
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        
        showSuccessMessage('Фото скачивается...');
    } catch (error) {
        console.error('Download photo error:', error);
        showErrorMessage('Ошибка скачивания фото: ' + error.message);
    }
}

async function deleteOrder(orderId, orderNumber) {
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
            setTimeout(() => {
                window.location.href = 'orders.html';
            }, 1500);
        }
    } catch (error) {
        console.error('Delete order error:', error);
        showErrorMessage('Ошибка удаления заказа: ' + error.message);
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

function showErrorMessage(message) {
    showTempMessage(message, 'error');
}

function showSuccessMessage(message) {
    showTempMessage(message, 'success');
}

// Глобальные функции для использования в HTML
window.openPhotoViewer = openPhotoViewer;
window.downloadPhoto = downloadPhoto;