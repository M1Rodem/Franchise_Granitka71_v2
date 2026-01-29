import { PageManager } from '../core/page-manager.js';
import { apiService } from '../api/api.js';
import { 
    formatDate, formatCurrency, escapeHtml, showTempMessage, handleApiError,
    getPaymentStatus, getPaymentStatusText, getUserNameFromOrder, getStatusBadgeClass, 
    formatPaymentType, formatFileSize 
} from '../utils/utils.js';
import { renderPhotoGrid, attachPhotoEvents, cleanupPhotoBlobs, openPhotoPreview } from '../utils/photo-utils.js';
import { ModalUtils } from '../utils/modal-utils.js';
import { printOrder, downloadOrderExcel } from '../utils/print-utils.js';
import { checkBlocking, handleNavigationWithBlockingCheck } from '../notification/notification-blocking.js';

export class ViewOrderManager {
    constructor(pageManager) {
        this.pageManager = pageManager;
        this.orderId = null;
        this.orderData = null;
        
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        // Основные контейнеры
        this.orderContainer = document.getElementById('orderContainer');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        
        // Элементы для рендеринга
        this.orderView = document.getElementById('orderView');
        this.workItemsContainer = document.getElementById('workItemsContainer');
        this.paymentsContainer = document.getElementById('paymentsContainer');
        this.orderPhotos = document.getElementById('orderPhotos');
        
        // Кнопки действий
        this.editBtn = document.getElementById('editBtn');
        this.deleteBtn = document.getElementById('deleteBtn');
        this.excelBtn = document.getElementById('excelBtn');
        this.printBtn = document.getElementById('printBtn');
    }

    async checkPageAccess() {
        // Для Admin/SuperAdmin всегда разрешаем
        const userData = apiService.getCurrentUser();
        if (userData?.role === 'Admin' || userData?.role === 'SuperAdmin') {
            return;
        }
        
        try {
            const blockingResult = await checkBlocking();
            
            if (blockingResult?.isBlocked) {
                // Блокировка! Редирект на уведомления
                if (blockingResult.message) {
                    showTempMessage(blockingResult.message, 'error');
                }
                
                setTimeout(() => {
                    window.location.href = 'notifications.html';
                }, 1000);
                
                // Бросаем ошибку чтобы остановить дальнейшую инициализацию
                throw new Error('Доступ заблокирован');
            }
        } catch (error) {
            console.warn('[CreateOrder] Ошибка проверки доступа:', error);
            // Продолжаем загрузку при ошибке (fail-open)
        }
    }

    bindEvents() {
        if (this.editBtn) {
            this.editBtn.addEventListener('click', () => this.editOrder());
        }
        
        if (this.deleteBtn) {
            this.deleteBtn.addEventListener('click', () => this.deleteOrder());
        }

        if (this.excelBtn) {
            this.excelBtn.addEventListener('click', () => this.downloadExcel());
        }

        if (this.printBtn) {
            this.printBtn.addEventListener('click', () => this.printOrder());
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
    }

    handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        localStorage.removeItem('orderFilters');
        localStorage.removeItem('lastOrderView');
        
        // Перенаправляем на страницу логина
        window.location.href = 'login.html';
    }

    async initialize() {
        this.orderId = this.getOrderIdFromURL();
        
        if (!this.orderId) {
            showTempMessage('Некорректный ID заказа', 'error');
            setTimeout(() => window.location.href = 'orders.html', 2000);
            return;
        }

        await this.loadOrderData();
    }

    getOrderIdFromURL() {
        const params = new URLSearchParams(window.location.search);
        const id = parseInt(params.get('id'), 10);
        return isNaN(id) ? null : id;
    }

    async loadOrderData() {
        try {
            this.showLoadingState(true);

            const order = await apiService.getOrder(this.orderId);

            if (!order) {
                throw new Error('Заказ не найден');
            }

            this.orderData = order;
            this.renderOrderDetails(order);
            this.renderWorkItems(order.workItems || []);
            this.renderPayments(order.payments || []);
            await this.renderOrderPhotos(order.photos || []);

            if (order.isDeleted) {
                this.renderArchiveBadge(order);
            }

            this.showLoadingState(false);
        } catch (error) {
            console.error('Load order error:', error);
            handleApiError(error);
            this.showLoadingState(false);
        }
    }

    renderOrderDetails(order) {
        if (!this.orderView) return;

        const paymentStatus = getPaymentStatus(order);
        const statusText = getPaymentStatusText(order);
        const statusClass = getStatusBadgeClass(paymentStatus);
        const totalPrice = order.totalPrice || 0;

        this.orderView.innerHTML = `
            <header class="order-header">
                <h2 class="order-title">Заказ №${escapeHtml(order.orderNumber || 'N/A')}</h2>
                <div class="status-badges">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
            </header>
            <div class="order-details-grid">
                <div class="order-section">
                    <h3>Клиент</h3>
                    <p><strong>ФИО:</strong> ${escapeHtml(order.customerFullName || '')}</p>
                    <p><strong>Email:</strong> ${escapeHtml(order.customerEmail || '')}</p>
                    <p><strong>Телефон:</strong> ${escapeHtml(order.phone || '')}</p>
                    <p><strong>Адрес:</strong> ${escapeHtml(order.address || '')}</p>
                </div>
                <div class="order-section">
                    <h3>Покойный</h3>
                    <p><strong>ФИО:</strong> ${escapeHtml(order.deceasedFullName || '')}</p>
                </div>
                <div class="order-section">
                    <h3>Место установки</h3>
                    <p><strong>Участок:</strong> ${escapeHtml(order.place || '')}</p>
                    <p><strong>Место осмотра:</strong> ${escapeHtml(order.inspectionPlace || '')}</p>
                    <p><strong>Дата заказа:</strong> ${formatDate(order.orderDate)}</p>
                </div>
                <div class="order-section">
                    <h3>Монумент</h3>
                    <p><strong>Тип:</strong> ${escapeHtml(order.monumentType || '')}</p>
                    <p><strong>Размер:</strong> ${escapeHtml(order.monumentSize || '')}</p>
                    <p><strong>Дополнительно:</strong> ${escapeHtml(order.additionalInfo || '—')}</p>
                </div>
                <div class="order-section">
                    <h3>Метаданные</h3>
                    <p><strong>Менеджер:</strong> ${escapeHtml(getUserNameFromOrder(order))}</p>
                    <p><strong>Создана:</strong> ${formatDate(order.createdAt)}</p>
                    <p><strong>Обновлена:</strong> ${formatDate(order.updatedAt)}</p>
                    <p><strong>Сумма:</strong> ${formatCurrency(totalPrice)}</p>
                </div>
            </div>
        `;
    }

    renderWorkItems(workItems) {
        if (!this.workItemsContainer) return;

        if (workItems.length === 0) {
            this.workItemsContainer.innerHTML = '<p class="no-data">Нет работ</p>';
            return;
        }
        
        const total = workItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        
        this.workItemsContainer.innerHTML = `
            <table class="orders-table work-items-table view-order-table">
                <thead>
                    <tr>
                        <th>Описание</th>
                        <th>Кол-во</th>
                        <th>Цена</th>
                        <th>Итого</th>
                        <th>Примечание</th>
                    </tr>
                </thead>
                <tbody>
                    ${workItems.map(item => `
                        <tr>
                            <td data-label="Описание">${escapeHtml(item.workDescription || item.name || '')}</td>
                            <td data-label="Кол-во">${item.quantity || 1}</td>
                            <td data-label="Цена">${formatCurrency(item.price || 0)}</td>
                            <td data-label="Итого">${formatCurrency((item.price || 0) * (item.quantity || 1))}</td>
                            <td data-label="Примечание">${escapeHtml(item.note || '—')}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3"><strong>Итого по работам:</strong></td>
                        <td colspan="2"><strong>${formatCurrency(total)}</strong></td>
                    </tr>
                </tfoot>
            </table>
            <div class="table-total-mobile">
                <div class="total-card">
                    <div class="total-label">Итого по работам</div>
                    <div class="total-amount">${formatCurrency(total)}</div>
                </div>
            </div>
        `;
    }

    renderPayments(payments) {
        if (!this.paymentsContainer) return;

        if (payments.length === 0) {
            this.paymentsContainer.innerHTML = '<p class="no-data">Нет платежей</p>';
            return;
        }

        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

        this.paymentsContainer.innerHTML = `
            <table class="orders-table payments-table view-order-table">
                <thead>
                    <tr>
                        <th>Тип</th>
                        <th>Сумма</th>
                        <th>Дата</th>
                        <th>Примечание</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => `
                        <tr>
                            <td data-label="Тип">${formatPaymentType(p.paymentType || '')}</td>
                            <td data-label="Сумма">${formatCurrency(p.amount || 0)}</td>
                            <td data-label="Дата">${formatDate(p.paymentDate || p.date)}</td>
                            <td data-label="Примечание">${escapeHtml(p.note || '—')}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3"><strong>Итого:</strong></td>
                        <td><strong>${formatCurrency(totalPaid)}</strong></td>
                    </tr>
                </tfoot>
            </table>
            <div class="table-total-mobile">
                <div class="total-card">
                    <div class="total-label">Итого по платежам</div>
                    <div class="total-amount">${formatCurrency(totalPaid)}</div>
                </div>
            </div>
        `;
    }

    async renderOrderPhotos(photos) {
        if (!this.orderPhotos) return;

        if (photos.length === 0) {
            this.orderPhotos.innerHTML = '<div class="no-photos">Нет фотографий</div>';
            return;
        }

        try {
            if (typeof renderPhotoGrid === 'function') {
                await renderPhotoGrid(photos, 'orderPhotos', { 
                    mode: 'view',
                    orderNumber: this.orderData.orderNumber
                });
                
                if (typeof attachPhotoEvents === 'function') {
                    attachPhotoEvents('orderPhotos', { 
                        mode: 'view',
                        orderNumber: this.orderData.orderNumber
                    });
                }
            } else {
                // Fallback render
                this.renderPhotosFallback(photos);
            }
        } catch (error) {
            console.error('Error rendering photos:', error);
            this.renderPhotosFallback(photos);
        }
    }

    renderPhotosFallback(photos) {
        this.orderPhotos.innerHTML = photos.map((photo, index) => `
            <div class="photo-item" 
                 data-photo-id="${photo.id}" 
                 data-photo-index="${index + 1}" 
                 data-order-number="${this.orderData.orderNumber}">
                <img src="${photo.url || photo.previewUrl || ''}" 
                     alt="${escapeHtml(photo.originalFileName || 'Фото')}" 
                     class="photo-img">
                <div class="photo-info">
                    ${formatFileSize(photo.size)} | ${formatDate(photo.uploadedAt)}
                </div>
            </div>
        `).join('');
        
        // Fallback обработчик
        this.orderPhotos.addEventListener('click', (e) => {
            const item = e.target.closest('.photo-item');
            if (item) {
                const orderNumber = item.dataset.orderNumber;
                const photoIndex = item.dataset.photoIndex;
                openPhotoPreview(
                    e.target.src, 
                    e.target.alt, 
                    item.dataset.photoId, 
                    orderNumber, 
                    photoIndex
                );
            }
        });
    }

    renderArchiveBadge(order) {
        const header = document.querySelector('#orderView .order-header');
        if (header) {
            header.innerHTML += `
                <span class="status-badge bg-warning">
                    Архивный (удален ${formatDate(order.deletedAt)})
                </span>
            `;
        }
    }

    editOrder() {
        window.location.href = `create-order.html?edit=${this.orderId}`;
    }

    async deleteOrder() {
        if (!this.orderData) return;

        const confirmed = await ModalUtils.confirm({
            title: 'Удаление заказа',
            message: `Вы уверены? Заказ №${this.orderData.orderNumber} будет перемещен в архив.`,
            confirmText: 'Удалить',
            danger: true
        });

        if (confirmed) {
            try {
                await apiService.deleteOrder(this.orderId);
                showTempMessage(`Заказ №${this.orderData.orderNumber} перемещен в архив`, 'success');
                setTimeout(() => window.location.href = 'orders.html', 1500);
            } catch (error) {
                handleApiError(error);
            }
        }
    }

    async downloadExcel() {
        if (!this.orderId) {
            showTempMessage('ID заказа не найден', 'error');
            return;
        }

        try {
            await downloadOrderExcel(this.orderId);
        } catch (error) {
            console.error('Excel download error:', error);
            showTempMessage('Ошибка при скачивании Excel', 'error');
        }
    }

    async printOrder() {
        if (!this.orderId) {
            showTempMessage('ID заказа не найден', 'error');
            return;
        }

        try {
            await printOrder(this.orderId);
        } catch (error) {
            console.error('Print error:', error);
            showTempMessage('Ошибка при печати заказа', 'error');
        }
    }
    
    showLoadingState(loading) {
        if (loading) {
            if (this.orderContainer) this.orderContainer.style.display = 'none';
            if (this.loadingSpinner) this.loadingSpinner.style.display = 'block';
        } else {
            if (this.orderContainer) this.orderContainer.style.display = 'block';
            if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';
        }
    }

    // Cleanup при уничтожении
    destroy() {
        cleanupPhotoBlobs();
    }
}

// Инициализация через PageManager
document.addEventListener('DOMContentLoaded', () => {
    PageManager.initialize('orders', async () => {
        const viewOrderManager = new ViewOrderManager(PageManager);
        await viewOrderManager.initialize();
        
        // Сохраняем ссылку для возможного доступа извне
        window.viewOrderManager = viewOrderManager;
    });
});