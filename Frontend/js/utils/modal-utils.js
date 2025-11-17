import { 
    formatDate, 
    formatCurrency, 
    getPaymentStatus, 
    getPaymentStatusText, 
    escapeHtml,
    getUserNameFromOrder,
    formatFileSize
} from '../utils/utils';

export class ModalUtils {
    // ====== КОНФИРМАЦИОННЫЕ ОКНА ======
    
    static confirm(options) {
        return new Promise((resolve) => {
            const modal = this.createModalBase();
            
            modal.innerHTML = `
                <div class="modal-content" style="
                    background: var(--glass-background);
                    backdrop-filter: var(--backdrop-blur);
                    padding: 2rem;
                    border-radius: var(--radius-xl);
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: var(--glass-shadow);
                    border: 1px solid var(--glass-border);
                    color: var(--text-primary);
                ">
                    <h3 style="margin-bottom: 1rem; color: var(--text-primary); font-size: 1.25rem;">
                        ${options.title || 'Подтверждение'}
                    </h3>
                    <p style="margin-bottom: 1.5rem; color: var(--text-secondary); line-height: 1.5;">
                        ${options.message}
                    </p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-outline" id="modalCancel" style="min-width: 100px;">
                            ${options.cancelText || 'Отмена'}
                        </button>
                        <button class="btn ${options.danger ? 'btn-danger' : 'btn-primary'}" 
                                id="modalConfirm" style="min-width: 100px;">
                            ${options.confirmText || 'Подтвердить'}
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            this.setupModalEvents(modal, resolve);
        });
    }

    // ====== БАЗОВЫЕ ФУНКЦИИ ======
    
    static createModalBase() {
        this.closeAllModals();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        return modal;
    }
    
    static setupModalEvents(modal, resolve) {
        const confirmHandler = () => {
            modal.remove();
            resolve(true);
        };
        
        const cancelHandler = () => {
            modal.remove();
            resolve(false);
        };
        
        modal.querySelector('#modalConfirm').addEventListener('click', confirmHandler);
        modal.querySelector('#modalCancel').addEventListener('click', cancelHandler);
        this.setupModalClose(modal, cancelHandler);
    }
    
    static setupModalClose(modal, closeHandler) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeHandler();
            }
        });
        
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeHandler();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        const originalClose = closeHandler;
        closeHandler = () => {
            document.removeEventListener('keydown', escapeHandler);
            originalClose();
        };
    }
    
    static closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
    }

    /**
     * Показывает модальное окно просмотра архивного заказа
     */
    static showArchivedOrderModal(order) {
        // Рассчитываем общую стоимость
        const totalPrice = order.workItems?.reduce((sum, item) => {
            return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }, 0) || 0;
        const paymentStatus = getPaymentStatus(order);
        const statusText = getPaymentStatusText(order);
        
        const modalContent = `
            <div class="archived-order-modal">
                <div class="modal-header">
                    <div class="header-content">
                        <h2>Архивный заказ №${escapeHtml(order.orderNumber)}</h2>
                        <div class="order-meta">
                            <span class="status-badge ${paymentStatus}">${escapeHtml(statusText)}</span>
                            <span class="deleted-date">Удалён: ${formatDate(order.deletedAt)}</span>
                        </div>
                    </div>
                    <button class="modal-close" id="modalCloseBtn" aria-label="Закрыть окно">✕</button>
                </div>
                
                <!-- Основная информация в две колонки -->
                <div class="modal-grid">
                    <div class="info-section">
                        <h3>Информация о заказе</h3>
                        
                        <div class="info-card">
                            <p><strong>Участок:</strong> ${escapeHtml(order.place)}</p>
                            <p><strong>Место осмотра:</strong> ${escapeHtml(order.inspectionPlace || '—')}</p>
                            <p><strong>Дата заказа:</strong> ${formatDate(order.orderDate)}</p>
                        </div>
                        
                        <div class="info-card">
                            <p><strong>Тип памятника:</strong> ${escapeHtml(order.monumentType || '—')}</p>
                            <p><strong>Размер:</strong> ${escapeHtml(order.monumentSize || '—')}</p>
                            <p><strong>Доп. информация:</strong> ${escapeHtml(order.additionalInfo || '—')}</p>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <h3>Контакты</h3>
                        
                        <div class="info-card">
                            <p><strong>Клиент:</strong> ${escapeHtml(order.customerFullName)}</p>
                            <p><strong>Телефон:</strong> ${escapeHtml(order.phone)}</p>
                            <p><strong>Email:</strong> ${escapeHtml(order.customerEmail || '—')}</p>
                            <p><strong>Адрес:</strong> ${escapeHtml(order.address)}</p>
                        </div>
                        
                        <div class="info-card">
                            <p><strong>Усопший:</strong> ${escapeHtml(order.deceasedFullName)}</p>
                            <p><strong>Менеджер:</strong> ${getUserNameFromOrder(order)}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Финансовая информация -->
                <div class="finance-section">
                    <h3>Финансовая информация</h3>
                    
                    <div class="finance-cards">
                        <div class="finance-card total-price">
                            <h4>Общая стоимость</h4>
                            <p>${formatCurrency(totalPrice)}</p>
                        </div>
                        
                        <div class="finance-card payment-status">
                            <h4>Статус оплаты</h4>
                            <p class="status-badge ${paymentStatus}">${escapeHtml(statusText)}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Таблицы работ и платежей -->
                <div class="modal-grid">
                    <div class="table-section">
                        <h3>Виды работ</h3>
                        ${ModalUtils.renderWorksTableCompact(order.workItems)}
                    </div>
                    
                    <div class="table-section">
                        <h3>Платежи</h3>
                        ${ModalUtils.renderPaymentsTableCompact(order.payments)}
                    </div>
                </div>
                
                <!-- Фотографии -->
                <div class="photos-section">
                    <h3>Фотографии</h3>
                    <div id="archivedPhotos" class="photos-container"></div>
                </div>
            </div>
        `;

        this.showModal({
            title: '',
            content: modalContent,
            width: '900px',
            className: 'archived-order-modal-wrapper'
        });

        // Рендерим фото
        if (order.photos && order.photos.length > 0) {
            ModalUtils.renderCompactPhotoGrid(order.photos, 'archivedPhotos');
        } else {
            document.getElementById('archivedPhotos').innerHTML = 
                '<p class="no-photos">Фото отсутствуют</p>';
        }
        setTimeout(() => {
            const closeBtn = document.getElementById('modalCloseBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeCurrentModal());
            }
        }, 100);
    }

    /**
     * Вспомогательная функция для компактного отображения таблицы работ
     */
    static renderWorksTableCompact(workItems) {
        if (!workItems || workItems.length === 0) {
            return '<p class="no-data">Работы не указаны</p>';
        }

        return `
            <div class="compact-table works-table">
                ${workItems.map(item => `
                    <div class="table-row">
                        <div class="work-description">${escapeHtml(item.workDescription || '—')}</div>
                        <div class="work-price">${formatCurrency(Number(item.price) || 0)} × ${item.quantity || 1}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Вспомогательная функция для компактного отображения таблицы платежей
     */
    static renderPaymentsTableCompact(payments) {
        if (!payments || payments.length === 0) {
            return '<p class="no-data">Платежи не указаны</p>';
        }

        return `
            <div class="compact-table payments-table">
                ${payments.map(payment => `
                    <div class="table-row">
                        <div class="payment-type">${escapeHtml(payment.paymentType || '—')}</div>
                        <div class="payment-amount">${formatCurrency(Number(payment.amount) || 0)}</div>
                        <div class="payment-date">${formatDate(payment.paymentDate)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Компактный рендер фото (миниатюры) - только информация без изображений
     */
    static renderCompactPhotoGrid(photos, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!photos || photos.length === 0) {
            container.innerHTML = '<p class="no-photos">Фото отсутствуют</p>';
            return;
        }

        // Рендерим фото (максимум 12 для preview)
        const photosToShow = photos.slice(0, 12);
        
        photosToShow.forEach(photo => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.dataset.photoId = photo.id;
            
            // Показываем информацию о фото вместо самого изображения
            photoItem.innerHTML = `
                <div class="photo-info">
                    <div class="photo-icon">📷</div>
                    <div class="photo-name">${escapeHtml(photo.originalFileName || 'Фото')}</div>
                    <div class="photo-size">${formatFileSize(photo.size)}</div>
                    <div class="photo-date">${formatDate(photo.uploadedAt)}</div>
                </div>
            `;

            // Добавляем обработчик клика
            photoItem.addEventListener('click', () => {
                ModalUtils.alert({
                    title: 'Информация о фото',
                    message: `
                        <div style="text-align: left;">
                            <p><strong>Название файла:</strong> ${escapeHtml(photo.originalFileName || 'Не указано')}</p>
                            <p><strong>Размер:</strong> ${formatFileSize(photo.size)}</p>
                            <p><strong>Дата загрузки:</strong> ${formatDate(photo.uploadedAt)}</p>
                            <p><strong>ID фото:</strong> ${photo.id}</p>
                            <p><strong>Разрешение:</strong> ${photo.width || '?'} × ${photo.height || '?'} px</p>
                        </div>
                        <div style="margin-top: 15px; padding: 10px; background: var(--glass-background); border-radius: 6px;">
                            <small>⚠️ Фото недоступно для просмотра в архивных заказах</small>
                        </div>
                    `,
                    icon: '📷'
                });
            });
            
            container.appendChild(photoItem);
        });

        // Элемент "еще фото" если их больше 12
        if (photos.length > 12) {
            const morePhotos = document.createElement('div');
            morePhotos.className = 'more-photos';
            morePhotos.textContent = `+${photos.length - 12}`;
            
            morePhotos.addEventListener('click', () => {
                ModalUtils.renderAllPhotosCompact(photos, container);
            });
            
            container.appendChild(morePhotos);
        }
    }

    /**
     * Функция для отображения всех фото (при клике на "еще")
     */
    static renderAllPhotosCompact(photos, container) {
        container.innerHTML = '';
        
        photos.forEach(photo => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.dataset.photoId = photo.id;
            
            // Показываем информацию о фото
            photoItem.innerHTML = `
                <div class="photo-info">
                    <div class="photo-icon">📷</div>
                    <div class="photo-name">${escapeHtml(photo.originalFileName || 'Фото')}</div>
                    <div class="photo-size">${formatFileSize(photo.size)}</div>
                    <div class="photo-date">${formatDate(photo.uploadedAt)}</div>
                </div>
            `;

            photoItem.addEventListener('click', () => {
                ModalUtils.alert({
                    title: 'Информация о фото',
                    message: `
                        <div style="text-align: left;">
                            <p><strong>Название файла:</strong> ${escapeHtml(photo.originalFileName || 'Не указано')}</p>
                            <p><strong>Размер:</strong> ${formatFileSize(photo.size)}</p>
                            <p><strong>Дата загрузки:</strong> ${formatDate(photo.uploadedAt)}</p>
                            <p><strong>ID фото:</strong> ${photo.id}</p>
                            <p><strong>Разрешение:</strong> ${photo.width || '?'} × ${photo.height || '?'} px</p>
                        </div>
                        <div style="margin-top: 15px; padding: 10px; background: var(--glass-background); border-radius: 6px;">
                            <small>⚠️ Фото недоступно для просмотра в архивных заказах</small>
                        </div>
                    `,
                    icon: '📷'
                });
            });

            container.appendChild(photoItem);
        });
    }

    /**
     * Закрывает текущее модальное окно
     */
    static closeCurrentModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Показывает кастомное модальное окно
     */
    static showModal(options) {
        this.closeAllModals();
        
        const modal = this.createModalBase();
        
        modal.innerHTML = `
            <div class="modal-content ${options.className || ''}" style="
                background: var(--glass-background);
                backdrop-filter: var(--backdrop-blur);
                padding: 0;
                border-radius: var(--radius-xl);
                max-width: ${options.width || '400px'};
                width: 95%;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: var(--glass-shadow);
                border: 1px solid var(--glass-border);
            ">
                ${options.content}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeCurrentModal();
            }
        });
        
        // Закрытие по Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeCurrentModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    // ====== ИНФОРМАЦИОННЫЕ ОКНА ======
    
    static alert(options) {
        return new Promise((resolve) => {
            const modal = this.createModalBase();
            
            modal.innerHTML = `
                <div class="modal-content" style="
                    background: var(--glass-background);
                    backdrop-filter: var(--backdrop-blur);
                    padding: 2rem;
                    border-radius: var(--radius-xl);
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: var(--glass-shadow);
                    border: 1px solid var(--glass-border);
                    color: var(--text-primary);
                ">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">
                        ${options.icon || 'ℹ️'}
                    </div>
                    <h3 style="margin-bottom: 1rem; color: var(--text-primary); font-size: 1.25rem;">
                        ${options.title || 'Информация'}
                    </h3>
                    <p style="margin-bottom: 1.5rem; color: var(--text-secondary); line-height: 1.5;">
                        ${options.message}
                    </p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" id="modalOk" style="min-width: 100px;">
                            ${options.okText || 'OK'}
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const closeModal = () => {
                modal.remove();
                resolve(true);
            };
            
            modal.querySelector('#modalOk').addEventListener('click', closeModal);
            this.setupModalClose(modal, closeModal);
        });
    }
}

// Глобальные для legacy (если в HTML onclick)
window.ModalUtils = ModalUtils;