import { escapeHtml, formatValue, formatFileSize } from './notification-utils.js';
import { NOTIFICATION_STATUS, NOTIFICATION_TYPES } from './notification-types.js';
import { showTempMessage, formatDate } from '../utils/utils.js';
import { getState } from './notification-state.js';
import { openPhotoPreview } from '../utils/photo-utils.js';

export class NotificationViewModal {
    constructor(manager) {
        this.manager = manager;
        this.isInitialized = false;
        this.currentNotificationId = null;
        this.currentNotificationData = null;
        
        this.photoPreviewCache = new Map();
    }

    async getPhotoPreviewUrl(id, type) {
        const cacheKey = `${type}_${id}`;
        
        if (this.photoPreviewCache.has(cacheKey)) {
            return this.photoPreviewCache.get(cacheKey);
        }
        
        try {
            const { apiService } = await import('../api/api.js');
            let photoUrl;
            
            if (type === 'added') {
                // Загружаем временное фото
                photoUrl = await apiService.getTempPreview(id);
            } else {
                // Загружаем постоянное фото
                photoUrl = await apiService.getPhotoUrl(id);
            }
            
            this.photoPreviewCache.set(cacheKey, photoUrl);
            return photoUrl;
            
        } catch (error) {
            console.warn(`Не удалось загрузить фото ${id}:`, error.message);
            
            // Fallback только при ошибке
            const fallbackUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+0J/RgNC+0LTRg9C60YI8L3RleHQ+PC9zdmc+';
            this.photoPreviewCache.set(cacheKey, fallbackUrl);
            return fallbackUrl;
        }
    }

    async generatePhotoItem(id, type, index) {
        const isAdded = type === 'added';
        const label = isAdded ? `Новое фото #${id}` : `Удаляем фото #${id}`;
        const statusText = isAdded ? 'Будет добавлено' : 'Будет удалено';
        
        try {
            const previewUrl = await this.getPhotoPreviewUrl(id, type);
            
            // СОЗДАЕМ УНИКАЛЬНЫЙ ID ДЛЯ УВЕДОМЛЕНИЯ
            const uniquePhotoId = `${type}_${id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            return `
                <div class="photo-item ${isAdded ? 'photo-added' : 'photo-removed'}" 
                    data-photo-id="${id}"
                    data-photo-type="${type}"
                    data-photo-index="${index + 1}"
                    data-unique-id="${uniquePhotoId}"
                    ${this.currentNotificationData?.orderNumber ? `data-order-number="${this.currentNotificationData.orderNumber}"` : ''}>
                    <div class="photo-preview" role="button" tabindex="0" aria-label="Открыть фото ${label}" data-open-photo>
                        <img src="${previewUrl}" 
                            alt="${label}"
                            class="photo-img"
                            loading="lazy"
                            data-src="${previewUrl}"
                            data-filename="${label}">
                        <div class="photo-overlay"></div>
                    </div>
                    <div class="photo-info">
                        <div class="photo-name" title="${label}">${label}</div>
                        <div class="photo-meta">
                            <span class="photo-status">${statusText}</span>
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            return `
                <div class="photo-item photo-error">
                    <div class="photo-preview" style="background: var(--glass-background);">
                        <span class="photo-icon">❌</span>
                    </div>
                    <div class="photo-info">
                        <div class="photo-name">${label}</div>
                        <div class="photo-meta">Ошибка загрузки</div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Инициализирует обработчики кликов для фото в модалке
     */
    initPhotoClickHandlers() {
        // Используем делегирование событий
        if (this.contentElement) {
            this.contentElement.addEventListener('click', (e) => {
                this.handlePhotoClick(e);
            });
            
            // Также обрабатываем нажатие Enter для accessibility
            this.contentElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    this.handlePhotoClick(e);
                }
            });
        }
    }

    /**
     * Обрабатывает клик по фото
     */
    handlePhotoClick(event) {
        // Находим ближайший элемент photo-preview или photo-img
        const photoPreview = event.target.closest('[data-open-photo]');
        const photoImg = event.target.closest('.photo-img');
        
        if (!photoPreview && !photoImg) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        // Находим родительский photo-item
        const photoItem = (photoPreview || photoImg).closest('.photo-item');
        if (!photoItem) return;
        
        // Получаем данные фото
        const imgElement = photoItem.querySelector('.photo-img');
        if (!imgElement) return;
        
        const imageSrc = imgElement.src || imgElement.dataset.src;
        const fileName = imgElement.alt || imgElement.dataset.filename || 'Фото';
        const photoId = photoItem.dataset.photoId;
        const photoIndex = photoItem.dataset.photoIndex;
        const orderNumber = photoItem.dataset.orderNumber || this.currentNotificationData?.orderNumber;
        
        if (!imageSrc || imageSrc.includes('data:image/svg+xml')) {
            console.warn('Не удалось получить URL фото для просмотра');
            return;
        }
        
        // Открываем фото в полноэкранном режиме
        try {
            // Используем существующую функцию из photo-utils.js
            if (typeof openPhotoPreview === 'function') {
                openPhotoPreview(imageSrc, fileName, photoId, orderNumber, photoIndex);
            } else {
                // Fallback: простая модалка
                this.openSimplePhotoPreview(imageSrc, fileName);
            }
        } catch (error) {
            console.error('Ошибка открытия фото:', error);
            this.openSimplePhotoPreview(imageSrc, fileName);
        }
    }

    /**
     * Простой fallback просмотр фото (если openPhotoPreview недоступен)
     */
    openSimplePhotoPreview(imageSrc, fileName) {
        const modal = document.createElement('div');
        modal.className = 'photo-modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="max-width: 90vw; max-height: 90vh; position: relative;">
                <img src="${imageSrc}" alt="${fileName}" style="max-width: 100%; max-height: 90vh; object-fit: contain;">
                <button style="position: absolute; top: 10px; right: 10px; background: #fff; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 20px;">×</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Обработчик закрытия
        const closeModal = () => {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', handleKeydown);
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        
        modal.querySelector('button').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', handleKeydown);
    }

    async renderPhotoItems(photoIds, type) {
        if (!photoIds || photoIds.length === 0) {
            return '<div class="no-photos">Нет фотографий</div>';
        }
        
        const photoPromises = photoIds.map((id, index) => 
            this.generatePhotoItem(id, type, index)
        );
        
        try {
            const photoElements = await Promise.all(photoPromises);
            return `<div class="photos-grid">${photoElements.join('')}</div>`;
            
        } catch (error) {
            console.error('Ошибка при рендеринге фото:', error);
            return '<div class="photo-error-container">Ошибка загрузки фотографий</div>';
        }
    }

    async generatePhotosDiff(photosChange) {
        const addedIds = photosChange.addedTempIds || [];
        const removedIds = photosChange.removedPhotoIds || [];
        
        const addedCount = addedIds.length;
        const removedCount = removedIds.length;
        
        if (addedCount === 0 && removedCount === 0) {
            return '<div class="no-changes">Нет изменений в фотографиях</div>';
        }
        
        const [addedPhotosHtml, removedPhotosHtml] = await Promise.all([
            addedCount > 0 ? this.renderPhotoItems(addedIds, 'added') : '',
            removedCount > 0 ? this.renderPhotoItems(removedIds, 'removed') : ''
        ]);
        
        return `
            <div class="photos-diff">
                ${removedCount > 0 ? `
                    <div class="photos-section removed">
                        <h6>Удалено (${removedCount})</h6>
                        ${removedPhotosHtml}
                    </div>
                ` : ''}
                
                ${addedCount > 0 ? `
                    <div class="photos-section added">
                        <h6>Добавлено (${addedCount})</h6>
                        ${addedPhotosHtml}
                    </div>
                ` : ''}
            </div>
        `;
    }

    async generateGroupContent(proposedChanges, fields) {
        let content = '';
        
        for (const field of fields) {
            const change = proposedChanges[field];
            
            if (field === 'Photos' && (change.addedTempIds !== undefined || change.removedPhotoIds !== undefined)) {
                content += await this.generatePhotosDiff(change);
            } else if (['WorkItems', 'Payments', 'Photos'].includes(field)) {
                content += this.generateCollectionDiff(field, change);
            } else {
                content += this.generateSimpleFieldDiff(field, change);
            }
        }
        
        return content;
    }

    async generateAccordionGroups(proposedChanges) {
        if (!proposedChanges || Object.keys(proposedChanges).length === 0) {
            return '<p class="no-changes">Нет информации об изменениях</p>';
        }
        
        const groups = {
            'Основная информация': ['Status', 'TotalPrice', 'OrderDate', 'MonumentType', 'MonumentSize', 'AdditionalInfo'],
            'Клиент и место': ['CustomerFullName', 'CustomerEmail', 'Phone', 'Address', 'Place', 'InspectionPlace', 'DeceasedFullName'],
            'Работы': ['WorkItems'],
            'Платежи': ['Payments'],
            'Фотографии': ['Photos']
        };
        
        let accordionHtml = '<div class="notification-accordion">';
        
        for (const [groupName, fields] of Object.entries(groups)) {
            const changedFields = fields.filter(field => proposedChanges[field]);
            if (changedFields.length === 0) continue;
            
            const changeCount = this.countChangesInGroup(proposedChanges, changedFields);
            
            accordionHtml += `
                <div class="accordion-group">
                    <div class="accordion-header">
                        <div class="accordion-title">
                            <span>${groupName}</span>
                            <span class="change-count">(${changeCount} ${this.getChangeWord(changeCount)})</span>
                        </div>
                        <span class="accordion-icon">▼</span>
                    </div>
                    <div class="accordion-content">
                        ${await this.generateGroupContent(proposedChanges, changedFields)}
                    </div>
                </div>
            `;
        }
        
        accordionHtml += '</div>';
        
        return accordionHtml;
    }

    // Проверяем, доступна ли модалка на этой странице
    isModalAvailable() {
        // Быстрая проверка по URL
        if (!window.location.pathname.includes('notifications.html') && 
            !window.location.href.includes('notifications')) {
            return false;
        }
        
        // Проверяем наличие элементов
        return !!document.getElementById('notificationDetailsModal');
    }

    // Инициализируем DOM элементы при необходимости
    async ensureInitialized() {
        if (this.isInitialized) return true;
        
        // Проверяем, нужна ли модалка на этой странице
        if (!this.isModalAvailable()) {
            return false;
        }

        try {
            this.modalElement = document.getElementById('notificationDetailsModal');
            this.contentElement = document.getElementById('notificationDetailsContent');
            this.titleElement = document.getElementById('modalDetailsTitle');
            
            if (!this.modalElement) {
                console.warn('[NotificationViewModal] Модалка не найдена в DOM');
                return false;
            }

            // Инициализируем обработчики закрытия
            this.modalElement.querySelectorAll('[data-close-modal], .modal-close').forEach(el => {
                el.addEventListener('click', () => this.hide());
            });

            this.modalElement.addEventListener('click', (e) => {
                if (e.target === this.modalElement) this.hide();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modalElement.style.display === 'flex') this.hide();
            });

            this.isInitialized = true;
            return true;
            
        } catch (error) {
            console.error('[NotificationViewModal] Ошибка инициализации:', error);
            return false;
        }
    }

    async show(notification) {
        // Проверяем инициализацию
        const isReady = await this.ensureInitialized();
        if (!isReady) return;
        
        if (!this.modalElement || !this.contentElement) return;
        
        this.currentNotificationId = notification.id;
        this.currentNotificationData = notification;
        
        // ЗАГОЛОВОК
        let title = 'Детали уведомления';
        if (notification.orderNumber) {
            title = `Просмотр: Заказ #${notification.orderNumber}`;
        } else if (notification.isInformation) {
            title = 'Информационное уведомление';
        }
        
        if (this.titleElement) {
            this.titleElement.textContent = title;
        }
        
        // ПРОСТАЯ СТРУКТУРА - без лишних оберток
        let html = '';
        
        // КОММЕНТАРИЙ ИНИЦИАТОРА
        if (!notification.isInformation && notification.data?.comment) {
            html += `
                <div class="details-section glass-card">
                    <div class="details-section-header">
                        <h4 class="details-section-title">Комментарий инициатора</h4>
                    </div>
                    <div class="details-section-body">
                        <div class="text-muted">${escapeHtml(notification.data.comment)}</div>
                    </div>
                </div>
            `;
        }
        
        // ОСНОВНАЯ ИНФОРМАЦИЯ - таблица как в users.html
        html += `
            <div class="details-section glass-card">
                <div class="details-section-header">
                    <h4 class="details-section-title">Основная информация</h4>
                </div>
                <div class="details-section-body p-0">
                    <div class="details-table">
                        <div class="details-row">
                            <div class="details-label text-muted">Тип уведомления</div>
                            <div class="details-value ${notification.isInformation ? 'text-info' : 'text-warning'}">
                                ${notification.isInformation ? 'Информационное' : 'Влияющее на заказ'}
                            </div>
                        </div>
                        
                        <div class="details-row">
                            <div class="details-label text-muted">Дата создания</div>
                            <div class="details-value">${formatDate(notification.createdAt)}</div>
                        </div>
        `;
        
        if (notification.orderNumber) {
            html += `
                        <div class="details-row">
                            <div class="details-label text-muted">Заказ</div>
                            <div class="details-value text-accent font-semibold">#${notification.orderNumber}</div>
                        </div>
            `;
        }
        
        if (notification.initiator) {
            html += `
                        <div class="details-row">
                            <div class="details-label text-muted">Инициатор</div>
                            <div class="details-value">${escapeHtml(notification.initiator)}</div>
                        </div>
            `;
        }
        
        html += `
                    </div>
                </div>
            </div>
        `;
        
        // СООБЩЕНИЕ
        if (notification.message) {
            html += `
                <div class="details-section glass-card">
                    <div class="details-section-header">
                        <h4 class="details-section-title">Сообщение</h4>
                    </div>
                    <div class="details-section-body">
                        <div class="text-secondary">${escapeHtml(notification.message)}</div>
                    </div>
                </div>
            `;
        }
        
        // АККОРДЕОН С ИЗМЕНЕНИЯМИ (асинхронный рендеринг)
        if (!notification.isInformation && notification.data?.proposedChanges) {
            html += await this.generateAccordionGroups(notification.data.proposedChanges);
        }
        
        // ИНФОРМАЦИОННЫЕ УВЕДОМЛЕНИЯ
        if (notification.isInformation && !notification.data?.proposedChanges) {
            html += `
                <div class="details-section glass-card">
                    <div class="details-section-body text-center text-muted">
                        <p><em>Это информационное уведомление. Для его закрытия нажмите кнопку "Убрать".</em></p>
                    </div>
                </div>
            `;
        }
        
        // ОБНОВЛЯЕМ КОНТЕНТ
        this.contentElement.innerHTML = html;

        // ИНИЦИАЛИЗИРУЕМ ОБРАБОТЧИКИ ДЛЯ ФОТО
        this.initPhotoClickHandlers();

        // ИНИЦИАЛИЗИРУЕМ АККОРДЕОН
        if (!notification.isInformation) {
            this.initAccordion();
        }
        
        // СОЗДАЕМ КНОПКИ ДЕЙСТВИЙ
        this.createActionButtons(notification);
        
        // ПОКАЗЫВАЕМ МОДАЛКУ
        this.modalElement.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    createActionButtons(notification) {
        // Удаляем старые кнопки
        this.removeExistingActionButtons();
        
        // Определяем тип уведомления
        const isInformation = notification.isInformation || notification.type === NOTIFICATION_TYPES.SYSTEM;
        const isHistory = notification.status === NOTIFICATION_STATUS.APPROVED || 
                        notification.status === NOTIFICATION_STATUS.REJECTED;
        const isPostponed = notification.status === NOTIFICATION_STATUS.POSTPONED;
        
        if (isHistory) {
            // Read-only режим для истории
            this.showReadOnlyMessage(notification);
            return;
        }
        
        // СОЗДАЕМ КОНТЕЙНЕР ДЛЯ КНОПОК
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'notification-action-buttons';
        
        // РАЗНЫЕ КНОПКИ ДЛЯ РАЗНЫХ ТИПОВ УВЕДОМЛЕНИЙ
        if (isInformation) {
            // ИНФОРМАЦИОННОЕ УВЕДОМЛЕНИЕ: только кнопка "Убрать"
            buttonsContainer.innerHTML = `
                <button id="dismissBtn" class="btn btn-primary modal-action-btn" 
                        data-action="dismiss" data-id="${notification.id}">
                    Убрать
                </button>
            `;
            
        } else {
            // ВЛИЯЮЩЕЕ УВЕДОМЛЕНИЕ
            let buttonsHTML = '';
            
            // Кнопка "Отложить" - только для НЕ отложенных
            if (!isPostponed) {
                buttonsHTML += `
                    <button id="postponeBtn" class="btn btn-outline modal-action-btn"" 
                            data-action="postpone" data-id="${notification.id}">
                        Отложить
                    </button>
                `;
            }
            
            // Кнопки "Отклонить" и "Принять"
            buttonsHTML += `
                <button id="rejectBtn" class="btn btn-danger modal-action-btn"" 
                        data-action="reject" data-id="${notification.id}">
                    Отклонить
                </button>
                <button id="approveBtn" class="btn btn-primary modal-action-btn"" 
                        data-action="approve" data-id="${notification.id}">
                    Принять
                </button>
            `;
            
            buttonsContainer.innerHTML = buttonsHTML;
        }
        
        // ДОБАВЛЯЕМ КНОПКИ В МОДАЛКУ
        this.addButtonsToModal(buttonsContainer);
        
        // ДОБАВЛЯЕМ ОБРАБОТЧИКИ СОБЫТИЙ
        this.addButtonEventListeners(notification);
        
        // ДОБАВЛЯЕМ СТИЛИ
        this.addButtonStyles();
    }

    /**
     * Получает все фото в текущем уведомлении для навигации
     */
    getCurrentNotificationPhotos() {
        if (!this.contentElement) return [];
        
        const photoItems = this.contentElement.querySelectorAll('.photo-item:not(.photo-error)');
        return Array.from(photoItems).map(item => {
            const img = item.querySelector('.photo-img');
            return {
                element: item,
                src: img?.src || img?.dataset.src,
                alt: img?.alt || img?.dataset.filename,
                photoId: item.dataset.photoId,
                photoIndex: item.dataset.photoIndex,
                orderNumber: item.dataset.orderNumber
            };
        }).filter(photo => photo.src && !photo.src.includes('data:image/svg+xml'));
    }

    removeExistingActionButtons() {
        const existingButtons = this.modalElement?.querySelectorAll('.notification-action-buttons');
        existingButtons?.forEach(btn => btn.remove());
    }

    // Добавление кнопок в модалку
    addButtonsToModal(buttonsContainer) {
        // Ищем существующий футер модалки
        let modalFooter = this.modalElement?.querySelector('.modal-footer');
        
        // Если футера нет в текущей структуре, создаем его
        if (!modalFooter) {
            modalFooter = document.createElement('div');
            modalFooter.className = 'modal-footer glass-background';
            
            // Находим контейнер для футера
            const modalContent = this.modalElement?.querySelector('.modal-content');
            if (modalContent) {
                modalContent.appendChild(modalFooter);
            } else {
                // Если нет .modal-content, добавляем в конец модалки
                this.modalElement.appendChild(modalFooter);
            }
        }
        
        // Очищаем и добавляем кнопки
        modalFooter.innerHTML = '';
        modalFooter.appendChild(buttonsContainer);
    }

    // Добавление обработчиков событий для кнопок
    addButtonEventListeners(notification) {
        const buttons = this.modalElement?.querySelectorAll('.modal-action-btn');
        buttons?.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const action = button.dataset.action;
                const notificationId = parseInt(button.dataset.id);
                
                if (!notificationId) return;
                
                // ОБРАБАТЫВАЕМ ДЕЙСТВИЯ
                switch(action) {
                    case 'dismiss':
                        // Для информационных уведомлений
                        this.handleDismiss(notificationId);
                        break;
                        
                    case 'postpone':
                        this.handlePostpone(notificationId);
                        break;
                        
                    case 'reject':
                        this.handleReject(notificationId);
                        break;
                        
                    case 'approve':
                        this.handleApprove(notificationId);
                        break;
                }
            });
        });
    }

    showReadOnlyMessage(notification) {
        // Создаем read-only сообщение для истории
        const readOnlyMessage = document.createElement('div');
        readOnlyMessage.className = 'notification-action-buttons read-only-mode';
        
        const statusText = notification.status === 'approved' ? 'Принято' : 
                        notification.status === 'rejected' ? 'Отклонено' : 'Обработано';
        
        readOnlyMessage.innerHTML = `
            <div style="padding: 15px; text-align: center; color: #666;">
                <p><em>Уведомление уже обработано (${statusText})</em></p>
                <small>Просмотр только для ознакомления</small>
            </div>
        `;

        // Добавляем сообщение в модалку
        const modalBody = this.modalElement.querySelector('.modal-body') || this.contentElement.parentElement;
        const modalFooter = this.modalElement.querySelector('.modal-footer');
        
        if (modalFooter) {
            modalFooter.innerHTML = '';
            modalFooter.appendChild(readOnlyMessage);
        } else if (modalBody) {
            modalBody.appendChild(readOnlyMessage);
        } else {
            this.modalElement.appendChild(readOnlyMessage);
        }

        // Добавляем стили
        const style = document.createElement('style');
        style.textContent = `
            .read-only-mode {
                background: #f9f9f9;
                border-top: 1px solid #e0e0e0;
                margin-top: 20px;
            }
            .read-only-mode p {
                margin: 0 0 8px 0;
                font-style: italic;
            }
            .read-only-mode small {
                color: #888;
                font-size: 12px;
            }
        `;
        
        const oldStyle = document.getElementById('read-only-styles');
        if (oldStyle) oldStyle.remove();
        
        style.id = 'read-only-styles';
        document.head.appendChild(style);
    }

    addReadOnlyStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .read-only-message {
                padding: 20px;
                text-align: center;
                color: #666;
                border-top: 1px solid #e0e0e0;
                margin-top: 20px;
                background: #f9f9f9;
            }
            
            .read-only-message p {
                margin: 0 0 8px 0;
                font-style: italic;
            }
            
            .read-only-message small {
                color: #888;
                font-size: 12px;
            }
        `;
        
        // Удаляем старые стили, если есть
        const oldStyle = document.getElementById('notification-readonly-styles');
        if (oldStyle) oldStyle.remove();
        
        style.id = 'notification-readonly-styles';
        document.head.appendChild(style);
    }

    addButtonStyles() {
        const style = document.createElement('style');
        style.id = 'notification-modal-styles';
        style.textContent = `
            /* ==========================================================================
            Стили для блока кнопок действий в модальном окне уведомлений
            ========================================================================== */

            .notification-action-buttons {
                display: flex;
                gap: var(--space-4);
                padding: var(--space-5) var(--space-6);
                border-top: 1px solid var(--glass-border);
                background: var(--glass-background);
                backdrop-filter: var(--backdrop-blur);
                -webkit-backdrop-filter: var(--backdrop-blur);
                box-shadow: var(--glass-shadow);
                margin-top: var(--space-6);
                position: sticky;
                bottom: 0;
                z-index: 10;
            }

            .notification-action-buttons .btn {
                padding: var(--space-3) var(--space-5);
                font-size: var(--text-base);
                font-weight: 500;
                min-height: 44px;
                border-radius: var(--radius-lg);
                transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            }

            .notification-action-buttons .btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
            }

            /* Конкретные кнопки */
            .notification-action-buttons .btn-outline {
                background: transparent;
                border: 1px solid var(--glass-border);
                color: var(--text-secondary);
            }

            .notification-action-buttons .btn-outline:hover {
                background: var(--accent);
                color: var(--text-on-primary);
                border-color: var(--accent);
            }

            .notification-action-buttons .btn-danger {
                background: var(--error);
                color: white;
                border: none;
            }

            .notification-action-buttons .btn-danger:hover {
                background: #c82333;
            }

            .notification-action-buttons .btn-success,
            .notification-action-buttons .btn-primary {
                background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
                color: white;
                border: 1px solid var(--accent);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
            }

            .notification-action-buttons .btn-success:hover,
            .notification-action-buttons .btn-primary:hover {
                background: linear-gradient(135deg, var(--accent-hover) 0%, var(--accent-active) 100%);
                box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
                transform: translateY(-2px);
            }

            /* Мобильная адаптивность */
            @media (max-width: 768px) {
                .notification-action-buttons {
                    flex-direction: column;
                    gap: var(--space-3);
                    padding: var(--space-4) var(--space-5);
                }

                .notification-action-buttons .btn {
                    width: 100%;
                }
            }

            /* ==========================================================================
            Аккордеон (notification-accordion)
            ========================================================================== */

            .notification-accordion {
                margin-top: var(--space-5);
            }

            .accordion-group {
                background: var(--glass-background);
                backdrop-filter: var(--backdrop-blur);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-lg);
                margin-bottom: var(--space-4);
                overflow: hidden;
                box-shadow: var(--glass-shadow);
            }

            .accordion-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--space-4) var(--space-5);
                background: rgba(30, 41, 59, 0.4);
                backdrop-filter: blur(8px);
                cursor: pointer;
                transition: background 0.25s ease;
            }

            .accordion-header:hover {
                background: rgba(59, 130, 246, 0.15);
            }

            .accordion-title {
                display: flex;
                align-items: center;
                gap: var(--space-3);
                font-weight: 600;
                font-size: var(--text-base);
                color: var(--text-primary);
            }

            .change-count {
                font-size: var(--text-sm);
                color: var(--accent);
                background: rgba(59, 130, 246, 0.18);
                padding: 2px 10px;
                border-radius: var(--radius-sm);
            }

            .accordion-icon {
                font-size: var(--text-lg);
                color: var(--text-muted);
                transition: transform 0.3s ease;
            }

            .accordion-group.expanded .accordion-icon {
                transform: rotate(180deg);
            }

            .accordion-content {
                padding: var(--space-5);
                background: rgba(30, 41, 59, 0.25);
            }

            /* ==========================================================================
            Diff-таблица
            ========================================================================== */

            .changed-row {
                background: rgba(59, 130, 246, 0.12) !important;
            }

            .strikethrough.red {
                text-decoration: line-through;
                color: var(--error) !important;
            }

            .bold.green {
                font-weight: 700;
                color: var(--success) !important;
            }

            .border-left-red {
                border-left: 4px solid var(--error);
                padding-left: var(--space-4);
            }

            .border-left-green {
                border-left: 4px solid var(--success);
                padding-left: var(--space-4);
            }

            /* ==========================================================================
            Секция комментария инициатора
            ========================================================================== */

            .initiator-comment-section {
                background: rgba(59, 130, 246, 0.12);
                border-left: 4px solid var(--accent);
                padding: var(--space-5);
                margin: var(--space-5) 0;
                border-radius: var(--radius-lg);
                backdrop-filter: blur(8px);
            }

            .initiator-comment-section h4 {
                margin: 0 0 var(--space-3) 0;
                color: var(--accent);
                font-size: var(--text-lg);
                font-weight: 600;
            }

            .comment-content {
                color: var(--text-secondary);
                line-height: var(--line-height-loose);
                white-space: pre-line;
            }
        `;

        // Удаляем старые стили, если они уже есть
        const oldStyle = document.getElementById('notification-modal-styles');
        if (oldStyle) oldStyle.remove();

        document.head.appendChild(style);
    }

    countChangesInGroup(proposedChanges, fields) {
        let count = 0;
        fields.forEach(field => {
            const change = proposedChanges[field];
            
            // ОСОБАЯ ОБРАБОТКА ДЛЯ ФОТОГРАФИЙ
            if (field === 'Photos') {
                if (change.addedTempIds !== undefined || change.removedPhotoIds !== undefined) {
                    // Новый формат: считаем по ID
                    const addedCount = change.addedTempIds?.length || 0;
                    const removedCount = change.removedPhotoIds?.length || 0;
                    count += (addedCount + removedCount);
                } else if (Array.isArray(change.old) && Array.isArray(change.new)) {
                    // Старый формат: сравниваем массивы
                    const oldJson = JSON.stringify(change.old);
                    const newJson = JSON.stringify(change.new);
                    if (oldJson !== newJson) count++;
                }
            } 
            // СТАНДАРТНАЯ ЛОГИКА ДЛЯ ДРУГИХ ПОЛЕЙ
            else if (Array.isArray(change.old) && Array.isArray(change.new)) {
                const oldJson = JSON.stringify(change.old);
                const newJson = JSON.stringify(change.new);
                if (oldJson !== newJson) count++;
            } else if (change.old !== change.new) {
                count++;
            }
        });
        return count;
    }
    
    getChangeWord(count) {
        if (count % 10 === 1 && count % 100 !== 11) return 'изменение';
        if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'изменения';
        return 'изменений';
    }

    async generateGroupContent(proposedChanges, fields) {
        let content = '';
        
        for (const field of fields) {
            const change = proposedChanges[field];
            
            // ОСОБАЯ ОБРАБОТКА ДЛЯ ФОТОГРАФИЙ
            if (field === 'Photos' && (change.addedTempIds !== undefined || change.removedPhotoIds !== undefined)) {
                content += await this.generatePhotosDiff(change);
            } else if (['WorkItems', 'Payments', 'Photos'].includes(field)) {
                content += this.generateCollectionDiff(field, change);
            } else {
                content += this.generateSimpleFieldDiff(field, change);
            }
        }
        
        return content;
    }
    
    initAccordion() {
        const accordionHeaders = this.contentElement.querySelectorAll('.accordion-header');
        
        // СНАЧАЛА ЗАКРЫВАЕМ ВСЕ АККОРДЕОНЫ
        accordionHeaders.forEach(header => {
            const group = header.closest('.accordion-group');
            const content = group.querySelector('.accordion-content');
            const icon = header.querySelector('.accordion-icon');
            
            // Закрываем все группы
            group.classList.remove('expanded');
            if (content) content.style.display = 'none';
            if (icon) icon.textContent = '▼';
        });
        
        // ПОТОМ ДОБАВЛЯЕМ ОБРАБОТЧИКИ
        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const group = header.closest('.accordion-group');
                const content = group.querySelector('.accordion-content');
                const icon = header.querySelector('.accordion-icon');
                
                const isExpanded = group.classList.contains('expanded');
                
                // Закрываем все группы
                this.contentElement.querySelectorAll('.accordion-group.expanded').forEach(expandedGroup => {
                    if (expandedGroup !== group) {
                        expandedGroup.classList.remove('expanded');
                        expandedGroup.querySelector('.accordion-content').style.display = 'none';
                        expandedGroup.querySelector('.accordion-icon').textContent = '▼';
                    }
                });
                
                // Переключаем текущую группу
                if (isExpanded) {
                    group.classList.remove('expanded');
                    content.style.display = 'none';
                    icon.textContent = '▼';
                } else {
                    group.classList.add('expanded');
                    content.style.display = 'block';
                    icon.textContent = '▲';
                }
            });
        });
    }

    async handleAction(status) {
        if (!this.currentNotificationId || !this.currentNotificationData) return;
        
        // ПРОВЕРЯЕМ ТИП УВЕДОМЛЕНИЯ
        const isInformation = this.currentNotificationData.isInformation || 
                            this.currentNotificationData.type === NOTIFICATION_TYPES.SYSTEM;
        
        // ДЛЯ ИНФОРМАЦИОННЫХ УВЕДОМЛЕНИЙ: разрешен только статус Approved (1)
        if (isInformation && status !== NOTIFICATION_STATUS.APPROVED) {
            showTempMessage('Для информационных уведомлений доступно только действие "Убрать"', 'error', 4000);
            return;
        }
        
        // ДЛЯ ВЛИЯЮЩИХ УВЕДОМЛЕНИЙ: разрешены Approved (1) и Rejected (2)
        if (!isInformation && 
            status !== NOTIFICATION_STATUS.APPROVED && 
            status !== NOTIFICATION_STATUS.REJECTED) {
            showTempMessage('Для уведомлений доступны только действия "Принять" или "Отклонить"', 'error', 4000);
            return;
        }
        
        // ЗАПРАШИВАЕМ КОММЕНТАРИЙ при необходимости
        let comment = '';
        if (status === NOTIFICATION_STATUS.REJECTED) {
            comment = prompt('Причина отклонения (необязательно):', '') || '';
            if (comment === null) return; // Пользователь отменил
        } else if (status === NOTIFICATION_STATUS.APPROVED && !isInformation) {
            comment = prompt('Примечание (необязательно):', '') || '';
        }
        
        try {
            // УСТАНАВЛИВАЕМ СОСТОЯНИЕ ЗАГРУЗКИ
            if (this.manager?.setButtonsLoading) {
                this.manager.setButtonsLoading(this.currentNotificationId, true);
            }
            
            // ВЫПОЛНЯЕМ ДЕЙСТВИЕ
            if (this.manager?.resolveNotification) {
                await this.manager.resolveNotification(this.currentNotificationId, status, comment);
            } else {
                throw new Error('NotificationManager не доступен');
            }
            
            // ЗАКРЫВАЕМ МОДАЛКУ
            this.hide();
            
        } catch (error) {
            console.error('Ошибка обработки уведомления:', error);
            showTempMessage('Ошибка обработки уведомления', 'error');
            
            // СБРАСЫВАЕМ СОСТОЯНИЕ ЗАГРУЗКИ
            if (this.manager?.setButtonsLoading) {
                this.manager.setButtonsLoading(this.currentNotificationId, false);
            }
        }
    }

    // ФУНКЦИИ для обработки конкретных действий
    async handleDismiss(notificationId) {
        // Для информационных уведомлений - статус Approved (1)
        await this.handleAction(NOTIFICATION_STATUS.APPROVED);
    }

    async handleReject(notificationId) {
        // Для влияющих уведомлений - статус Rejected (2)
        await this.handleAction(NOTIFICATION_STATUS.REJECTED);
    }

    async handleApprove(notificationId) {
        // Для влияющих уведомлений - статус Approved (1)
        await this.handleAction(NOTIFICATION_STATUS.APPROVED);
    }

    async handlePostpone() {
        if (!this.currentNotificationId || !this.currentNotificationData) return;
        
        // ПРОВЕРЯЕМ: информационные уведомления нельзя отложить
        if (this.currentNotificationData.isInformation || 
            this.currentNotificationData.type === NOTIFICATION_TYPES.SYSTEM) {
            showTempMessage('Информационные уведомления нельзя отложить', 'warning', 3000);
            return;
        }
        
        try {
            // ЗАКРЫВАЕМ МОДАЛКУ
            this.hide();
            
            // ВЫПОЛНЯЕМ ОПТИМИСТИЧНОЕ ОТКЛАДЫВАНИЕ
            if (this.manager?.handleOptimisticPostpone) {
                this.manager.handleOptimisticPostpone(this.currentNotificationId);
            }
            
            // ОТПРАВЛЯЕМ ЗАПРОС В ФОНЕ
            if (this.manager?.postponeNotification) {
                this.manager.postponeNotification(this.currentNotificationId, 30, '')
                    .then(() => {
                        showTempMessage('Уведомление отложено на 30 минут', 'success');
                    })
                    .catch(err => {
                        console.error('Ошибка откладывания уведомления:', err);
                        // UI уже обновлен, ошибка только в логах
                    });
            }
            
        } catch (err) {
            console.error('Ошибка в handlePostpone:', err);
            showTempMessage('Ошибка откладывания уведомления', 'error');
        }
    }

    async handlePostpone() {
        if (!this.currentNotificationId) return;

        try {
            this.hide();
            
            const notificationManager = window.NotificationManager?.getInstance?.();
            if (notificationManager && notificationManager.handleOptimisticPostpone) {
                notificationManager.handleOptimisticPostpone(this.currentNotificationId);
            }
            
            // НЕ ЖДЕМ! Отправляем в фоне
            this.manager.postponeNotification(this.currentNotificationId)
                .then(() => {
                    showTempMessage('Уведомление отложено на 30 минут', 'success');
                })
                .catch(err => {
                    console.error('Ошибка откладывания уведомления:', err);
                    showTempMessage('Ошибка откладывания уведомления', 'error');
                    // НЕ перезагружаем список при ошибке!
                });
            
        } catch (err) {
            console.error('Ошибка в handlePostpone:', err);
            showTempMessage('Ошибка откладывания уведомления', 'error');
        }
    }

    hide() {
        if (this.modalElement) {
            this.modalElement.style.display = 'none';
            document.body.style.overflow = '';
        }
        this.contentElement.innerHTML = '';
        this.currentNotificationId = null;
        this.currentNotificationData = null;
    }

    getTypeName(type) {
        switch(type) {
            case 0: return 'Запрос на изменение заказа';
            case 1: return 'Подтверждение выполнения';
            default: return 'Уведомление';
        }
    }

    // ────────────────────────────────────────────────
    // Методы diff остаются без изменений
    // ────────────────────────────────────────────────
    generateSimpleFieldDiff(fieldName, change) {
        const fieldLabels = {
            'Status': 'Статус',
            'TotalPrice': 'Общая стоимость',
            'OrderDate': 'Дата заказа',
            'MonumentType': 'Тип памятника',
            'MonumentSize': 'Размер памятника',
            'AdditionalInfo': 'Дополнительная информация',
            'CustomerFullName': 'ФИО клиента',
            'CustomerEmail': 'Email клиента',
            'Phone': 'Телефон',
            'Address': 'Адрес',
            'Place': 'Участок',
            'InspectionPlace': 'Место осмотра',
            'DeceasedFullName': 'ФИО усопшего'
        };

        const label = fieldLabels[fieldName] || fieldName;
        const oldValue = formatValue(change.old, fieldName);
        const newValue = formatValue(change.new, fieldName);
        const isChanged = oldValue !== newValue;

        // ЗАМЕНЯЕМ ТАБЛИЦУ НА СТЕКЛЯННЫЕ СТРОКИ
        return `
            <div class="diff-row ${isChanged ? 'diff-changed' : ''}">
                <div class="diff-label">${label}</div>
                <div class="diff-values">
                    <div class="diff-old ${isChanged ? 'strikethrough red' : ''}">
                        <span class="diff-value-label">Было:</span>
                        ${oldValue}
                    </div>
                    <div class="diff-new ${isChanged ? 'bold green' : ''}">
                        <span class="diff-value-label">Стало:</span>
                        ${newValue}
                    </div>
                </div>
            </div>
        `;
    }

    generateCollectionDiff(fieldName, change) {
        const collectionLabels = {
            'WorkItems': 'Виды работ',
            'Payments': 'Платежи',
            'Photos': 'Фотографии'
        };

        const label = collectionLabels[fieldName] || fieldName;

        try {
            // ОСОБАЯ ОБРАБОТКА ДЛЯ ФОТОГРАФИЙ
            if (fieldName === 'Photos') {
                // Проверяем, это старый формат {old, new} или новый {addedTempIds, removedPhotoIds}
                if (change.addedTempIds !== undefined || change.removedPhotoIds !== undefined) {
                    // Это новый diff-формат от backend
                    return this.generatePhotosDiff(change);
                }
                // Иначе старый формат - обрабатываем как обычно
            }

            // СТАНДАРТНАЯ ЛОГИКА ДЛЯ WorkItems и Payments
            const oldItems = Array.isArray(change.old) ? change.old : [];
            const newItems = Array.isArray(change.new) ? change.new : [];

            const oldJson = JSON.stringify(oldItems);
            const newJson = JSON.stringify(newItems);

            if (oldJson === newJson) {
                return `
                    <div class="collection-diff no-changes">
                        <div class="collection-header">
                            <h5>${label}</h5>
                            <span class="collection-count">Нет изменений (${oldItems.length})</span>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="collection-diff">
                    <div class="collection-header">
                        <h5>${label}</h5>
                        <div class="collection-stats">
                            <span class="stat-old">Было: ${oldItems.length}</span>
                            <span class="stat-new">Стало: ${newItems.length}</span>
                        </div>
                    </div>
                    <div class="collection-comparison">
                        <div class="collection-old">
                            ${this.renderCollectionItems(oldItems, fieldName, 'old')}
                        </div>
                        <div class="collection-new">
                            ${this.renderCollectionItems(newItems, fieldName, 'new')}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error(`Ошибка рендера ${fieldName}:`, error);
            return `
                <div class="collection-error">
                    <div class="error-message">Ошибка отображения: ${error.message}</div>
                </div>
            `;
        }
    }

    /**
     * Генерирует diff для фотографий в новом формате {addedTempIds, removedPhotoIds}
     * @param {Object} photosChange - изменения фотографий {addedTempIds: [], removedPhotoIds: []}
     * @returns {string} HTML для отображения diff фотографий
     */
    async generatePhotosDiff(photosChange) {
        const addedIds = photosChange.addedTempIds || [];
        const removedIds = photosChange.removedPhotoIds || [];
        
        const addedCount = addedIds.length;
        const removedCount = removedIds.length;
        const totalChanges = addedCount + removedCount;
        
        // ЕСЛИ НЕТ ИЗМЕНЕНИЙ - показываем "Нет изменений"
        if (totalChanges === 0) {
            return `
                <div class="collection-diff no-changes">
                    <div class="collection-header">
                        <h5>Фотографии</h5>
                        <span class="collection-count">Нет изменений</span>
                    </div>
                </div>
            `;
        }
        
        // Загружаем фото асинхронно
        const [addedPhotosHtml, removedPhotosHtml] = await Promise.all([
            addedCount > 0 ? this.renderPhotoItems(addedIds, 'added') : '',
            removedCount > 0 ? this.renderPhotoItems(removedIds, 'removed') : ''
        ]);
        
        // ФОРМИРУЕМ ЗАГОЛОВОК С ПРАВИЛЬНЫМ СЧЕТЧИКОМ
        let changeText = '';
        if (addedCount > 0 && removedCount > 0) {
            changeText = `(${totalChanges} изменений: +${addedCount}, -${removedCount})`;
        } else if (addedCount > 0) {
            changeText = `(${addedCount} ${this.getPhotoWord(addedCount)} добавлено)`;
        } else if (removedCount > 0) {
            changeText = `(${removedCount} ${this.getPhotoWord(removedCount)} удалено)`;
        }
        
        return `
            <div class="collection-diff">
                <div class="collection-header">
                    <h5>Фотографии</h5>
                    <div class="collection-stats">
                        <span class="stat-old">Удалено: ${removedCount}</span>
                        <span class="stat-new">Добавлено: ${addedCount}</span>
                    </div>
                </div>
                <div class="photos-diff-container">
                    ${removedCount > 0 ? `
                    <div class="photos-section photos-removed">
                        <div class="photos-section-header">
                            <h6 class="text-error">Удалено (${removedCount})</h6>
                            <span class="photos-hint">Эти фотографии будут удалены</span>
                        </div>
                        <div class="photos-list removed-list">
                            ${removedPhotosHtml}
                        </div>
                    </div>` : ''}
                    
                    ${addedCount > 0 ? `
                    <div class="photos-section photos-added">
                        <div class="photos-section-header">
                            <h6 class="text-success">Добавлено (${addedCount})</h6>
                            <span class="photos-hint">Эти фотографии будут добавлены</span>
                        </div>
                        <div class="photos-list added-list">
                            ${addedPhotosHtml}
                        </div>
                    </div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Генерирует секцию удаленных фотографий
     */
    generateRemovedPhotosSection(removedIds) {
        if (removedIds.length === 0) return '';
        
        return `
            <div class="photos-section photos-removed">
                <div class="photos-section-header">
                    <h6 class="text-error">Удалено (${removedIds.length})</h6>
                    <span class="photos-hint">Эти фотографии будут удалены</span>
                </div>
                <div class="photos-list removed-list">
                    ${this.renderPhotoItems(removedIds, 'removed')}
                </div>
            </div>
        `;
    }

    /**
     * Генерирует секцию добавленных фотографий
     */
    generateAddedPhotosSection(addedIds) {
        if (addedIds.length === 0) return '';
        
        return `
            <div class="photos-section photos-added">
                <div class="photos-section-header">
                    <h6 class="text-success">Добавлено (${addedIds.length})</h6>
                    <span class="photos-hint">Эти фотографии будут добавлены</span>
                </div>
                <div class="photos-list added-list">
                    ${this.renderPhotoItems(addedIds, 'added')}
                </div>
            </div>
        `;
    }

    renderCollectionItems(items, collectionType, version) {
        if (!items || items.length === 0) {
            return '<div class="no-items text-muted">Нет элементов</div>';
        }

        switch(collectionType) {
            case 'WorkItems': return this.renderWorkItems(items, version);
            case 'Payments': return this.renderPayments(items, version);
            case 'Photos': 
                // Для обратной совместимости со старым форматом
                return this.renderPhotos(items, version);
            default: return `<pre>${JSON.stringify(items, null, 2)}</pre>`;
        }
    }

   renderWorkItems(items, version) {
        let html = '<div class="work-items-list">';
        
        items.forEach((item, index) => {
            html += `
                <div class="work-item ${version}">
                    <div class="work-item-row">
                        <span class="work-item-label">Описание:</span>
                        <span class="work-item-value">${escapeHtml(item.workDescription || '—')}</span>
                    </div>
                    <div class="work-item-row">
                        <span class="work-item-label">Количество:</span>
                        <span class="work-item-value">${item.quantity || 1}</span>
                    </div>
                    <div class="work-item-row">
                        <span class="work-item-label">Цена:</span>
                        <span class="work-item-value">${formatValue(item.price, 'TotalPrice')}</span>
                    </div>
                    ${item.notes ? `
                    <div class="work-item-row">
                        <span class="work-item-label">Примечания:</span>
                        <span class="work-item-value small-text">${escapeHtml(item.notes)}</span>
                    </div>` : ''}
                </div>
            `;
        });

        const total = items.reduce((sum, item) => {
            return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }, 0);

        html += `
            <div class="work-total ${version}">
                Итого: ${formatValue(total, 'TotalPrice')}
            </div>
        </div>`;
        
        return html;
    }

    renderPayments(items, version) {
        let html = '<div class="payments-list">';
        
        items.forEach((payment, index) => {
            html += `
                <div class="payment-item ${version}">
                    <div class="payment-item-row">
                        <span class="payment-label">Тип:</span>
                        <span class="payment-value">${escapeHtml(payment.paymentType || '—')}</span>
                    </div>
                    <div class="payment-item-row">
                        <span class="payment-label">Сумма:</span>
                        <span class="payment-value">${formatValue(payment.amount, 'TotalPrice')}</span>
                    </div>
                    <div class="payment-item-row">
                        <span class="payment-label">Дата:</span>
                        <span class="payment-value">${formatValue(payment.paymentDate, 'OrderDate')}</span>
                    </div>
                    ${payment.notes ? `
                    <div class="payment-item-row">
                        <span class="payment-label">Примечания:</span>
                        <span class="payment-value small-text">${escapeHtml(payment.notes)}</span>
                    </div>` : ''}
                </div>
            `;
        });

        const total = items.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

        html += `
            <div class="payment-total ${version}">
                Всего оплачено: ${formatValue(total, 'TotalPrice')}
            </div>
        </div>`;

        return html;
    }

    /**
     * Возвращает правильное склонение для слова "фото"
     */
    getPhotoWord(count) {
        if (count % 10 === 1 && count % 100 !== 11) return 'фото';
        if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'фото';
        return 'фотографий';
    }

    renderPhotos(items) {
        let html = '<div class="photos-grid card-grid">';
        
        items.forEach((photo, index) => {
            html += `
                <div class="photo-item card">
                    <div class="photo-preview">
                        <span class="photo-icon">📷</span>
                    </div>
                    <div class="photo-info">
                        <div class="photo-name">${escapeHtml(photo.originalFileName || `Фото ${index + 1}`)}</div>
                        ${photo.size ? `<div class="photo-size">${formatFileSize(photo.size)}</div>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }
}