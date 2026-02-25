import { PageManager } from '../core/page-manager.js';
import { apiService } from '../api/api.js';
import { 
    formatDate, formatCurrency, escapeHtml, showTempMessage, handleApiError,
    getPaymentStatus, getPaymentStatusText, getUserNameFromOrder, getStatusBadgeClass, 
    formatPaymentType, formatFileSize 
} from '../utils/utils.js';
import { 
    renderPhotoGrid, 
    attachMediaEvents, 
    cleanupPhotoBlobs, 
    openPhotoPreview,
    openVideoPreview  // ДОБАВИТЬ ЭТОТ ИМПОРТ
} from '../utils/photo-utils.js';
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
            
            // Загружаем данные участка если есть plotId
            if (order.plotId) {
                try {
                    const plots = await apiService.getPlots(true); // true = includeInactive
                    this.selectedPlot = plots.find(p => p.id === order.plotId);
                } catch (error) {
                    console.warn('Could not load plot details:', error);
                }
            }
            
            this.renderOrderDetails(order); // Теперь рендерит с картой
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

        // ИСПОЛЬЗУЕМ paymentStatus С СЕРВЕРА!
        const paymentStatus = order.paymentStatus; // Число: 1, 2, 3
        const statusText = getPaymentStatusText(order);
        const statusClass = getStatusBadgeClass(paymentStatus);
        const totalPrice = order.totalPrice || 0; // ИСПОЛЬЗУЕМ totalPrice С СЕРВЕРА!
        
        // Форматируем телефон
        const formattedPhone = this.formatPhoneNumber(order.phone);

        // Данные для карты - используем this.selectedPlot
        const hasMapData = order.latitude && order.longitude && this.selectedPlot;
        const plotCoords = hasMapData ? { 
            lat: this.selectedPlot.latitude, 
            lng: this.selectedPlot.longitude 
        } : null;
        const clientCoords = hasMapData ? { 
            lat: order.latitude, 
            lng: order.longitude 
        } : null;
        
        // Находим работу "Расстояние" для получения времени
        const distanceWork = order.workItems?.find(w => w.workDescription === 'Расстояние');
        const distanceText = distanceWork?.note || '';

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
                    <p><strong>Email:</strong> ${order.customerEmail ? escapeHtml(order.customerEmail) : '—'}</p>
                    <p><strong>Телефон:</strong> 
                        <a href="tel:${order.phone}" text-decoration: none;">
                            ${this.formatPhoneNumber(order.phone)}
                        </a>
                    </p>
                    <p><strong>Адрес:</strong> ${escapeHtml(order.address || '')}</p>
                </div>
                <div class="order-section">
                    <h3>Покойный</h3>
                    <p><strong>ФИО и Даты:</strong> ${escapeHtml(order.deceasedFullName || '')}</p>
                </div>                
                <div class="order-section">
                    <h3>Монумент</h3>
                    <p><strong>Тип:</strong> ${escapeHtml(order.monumentType || '—')}</p>
                    <p><strong>Размер:</strong> ${escapeHtml(order.monumentSize || '—')}</p>
                    <p><strong>Дополнительно:</strong> ${escapeHtml(order.additionalInfo || '—')}</p>
                </div>
                <div class="order-section">
                    <h3>Метаданные</h3>
                    <p><strong>Менеджер:</strong> ${escapeHtml(getUserNameFromOrder(order))}</p>
                    <p><strong>Дата заказа:</strong> ${formatDate(order.orderDate)}</p>
                    <p><strong>Обновлена:</strong> ${formatDate(order.updatedAt)}</p>
                </div>
                <div class="order-section order-section-large">
                    <h3>Место установки</h3>
                    <p><strong>Участок:</strong> ${escapeHtml(order.place || '')}</p>
                    <p><strong>Место смотрел:</strong> ${escapeHtml(order.inspectionPlace || '')}</p>
                    
                    ${hasMapData ? `
                        <div class="mini-map-container" id="orderMiniMap" style="height: 200px; margin: 15px 0; border-radius: 8px; border: 1px solid var(--glass-border);"></div>
                        <div class="distance-info" style="margin: 10px 0; padding: 8px; background: rgba(16, 185, 129, 0.1); border-radius: 4px;">
                            <strong>Расстояние до участка:</strong> ${escapeHtml(distanceText)}
                        </div>
                        <a href="${this.buildNavigatorUrl(plotCoords.lat, plotCoords.lng, clientCoords.lat, clientCoords.lng)}" 
                        target="_blank" 
                        class="navigator-link" 
                        style="display: inline-block; margin-top: 5px; padding: 8px 15px; background: #f0f0f0; border-radius: 4px; text-decoration: none; color: #333;">
                            Открыть в Яндекс.Навигаторе
                        </a>
                    ` : '<p><em>Координаты не указаны</em></p>'}
                </div>
            </div>
        `;

        // Инициализируем мини-карту если есть координаты
        if (hasMapData) {
            this.orderMapContainer = document.getElementById('orderMiniMap');
            // Небольшая задержка, чтобы DOM успел отрисоваться
            setTimeout(() => {
                this.initMiniMap(plotCoords, clientCoords);
            }, 100);
        }
    }

    /**
     * НОВАЯ ФУНКЦИЯ: Валидация суммы платежа по правилу 30%
     */
    validatePaymentAmount(amount) {
        if (!this.orderData) return { valid: false, error: 'Данные заказа не загружены' };
        
        const totalPrice = this.orderData.totalPrice || 0;
        if (totalPrice === 0) {
            return { valid: false, error: 'Нулевая сумма заказа' };
        }
        
        const existingPayments = this.orderData.payments || [];
        const totalPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return { valid: false, error: 'Введите корректную сумму' };
        }
        
        const minPayment = totalPrice * 0.3; // 30% от общей суммы
        
        // Первый платеж
        if (totalPaid === 0) {
            if (amountNum < minPayment) {
                return { 
                    valid: false, 
                    error: `Минимальный первый платеж должен быть не менее 30% (${formatCurrency(minPayment)})` 
                };
            }
        } 
        // Последующие платежи - проверяем итоговую сумму
        else {
            const newTotalPaid = totalPaid + amountNum;
            if (newTotalPaid < minPayment) {
                const neededAmount = Math.ceil(minPayment - totalPaid);
                return { 
                    valid: false, 
                    error: `Общая сумма платежей не может быть меньше 30% (нужно еще ${formatCurrency(neededAmount)})` 
                };
            }
        }
        
        return { valid: true };
    }

    /**
     * НОВАЯ ФУНКЦИЯ: Открытие модального окна для добавления платежа
     */
    async openAddPaymentModal() {
        const { ModalUtils } = await import('../utils/modal-utils.js');
        
        const content = `
            <div class="payment-form">
                <div class="form-group">
                    <label for="paymentAmount">Сумма платежа (₽)</label>
                    <input type="number" id="paymentAmount" class="form-control" min="0" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="paymentDate">Дата платежа</label>
                    <input type="date" id="paymentDate" class="form-control" value="${getTodayDate()}">
                </div>
                <div class="form-group">
                    <label for="paymentNote">Примечание</label>
                    <input type="text" id="paymentNote" class="form-control" placeholder="Назначение платежа">
                </div>
                <div id="paymentValidationMessage" class="validation-message" style="color: var(--error); margin-top: 10px; display: none;"></div>
            </div>
        `;
        
        const result = await ModalUtils.prompt({
            title: 'Добавить платеж',
            content: content,
            confirmText: 'Добавить',
            validate: () => {
                const amount = document.getElementById('paymentAmount')?.value;
                const validation = this.validatePaymentAmount(amount);
                
                const messageEl = document.getElementById('paymentValidationMessage');
                if (!validation.valid) {
                    if (messageEl) {
                        messageEl.textContent = validation.error;
                        messageEl.style.display = 'block';
                    }
                    return false;
                }
                
                if (messageEl) messageEl.style.display = 'none';
                return true;
            }
        });
        
        if (result) {
            const amount = document.getElementById('paymentAmount').value;
            const date = document.getElementById('paymentDate').value;
            const note = document.getElementById('paymentNote').value;
            
            await this.addPayment(amount, date, note);
        }
    }

    /**
     * НОВАЯ ФУНКЦИЯ: Отправка платежа на сервер
     */
    async addPayment(amount, date, note) {
        try {
            const paymentData = {
                amount: parseFloat(amount),
                paymentDate: date ? new Date(date).toISOString() : new Date().toISOString(),
                note: note || ''
            };
            
            const result = await apiService.addPayment(this.orderId, paymentData);
            
            showTempMessage('Платеж успешно добавлен', 'success');
            
            // Перезагружаем данные заказа
            await this.loadOrderData();
            
            return result;
        } catch (error) {
            console.error('Error adding payment:', error);
            
            // Показываем ошибку от сервера
            if (error.data?.message) {
                showTempMessage(error.data.message, 'error');
            } else {
                handleApiError(error);
            }
            throw error;
        }
    }

    renderWorkItems(workItems) {
        if (!this.workItemsContainer) return;

        if (workItems.length === 0) {
            this.workItemsContainer.innerHTML = '<p class="no-data">Нет работ</p>';
            return;
        }
        
        const total = workItems.reduce((sum, item) => 
            sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        
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
                    ${workItems.map(item => {
                        const quantity = Number(item.quantity || 1);
                        const price = Number(item.price || 0);
                        const itemTotal = price * quantity;
                        
                        return `
                            <tr>
                                <td data-label="Описание">${escapeHtml(item.workDescription || item.name || '')}</td>
                                <td data-label="Кол-во" class="quantity-cell">${this.formatQuantity(quantity)}</td>
                                <td data-label="Цена" class="price-cell">${this.formatPrice(price)}</td>
                                <td data-label="Итого" class="total-cell">${this.formatCurrency(itemTotal)}</td>
                                <td data-label="Примечание">${escapeHtml(item.note || '—')}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3"><strong>Итого по работам:</strong></td>
                        <td colspan="2"><strong>${this.formatCurrency(total)}</strong></td>
                    </tr>
                </tfoot>
            </table>
            <div class="table-total-mobile">
                <div class="total-card">
                    <div class="total-label">Итого по работам</div>
                    <div class="total-amount">${this.formatCurrency(total)}</div>
                </div>
            </div>
        `;
    }

    // НОВАЯ функция formatQuantity
    formatQuantity(quantity) {
        const num = Number(quantity);
        if (isNaN(num)) return '0';
        
        // Если число целое - показываем без дробной части
        if (Number.isInteger(num)) {
            return num.toString();
        }
        
        // Иначе показываем до 3 знаков, убирая лишние нули
        return num.toFixed(3).replace(/\.?0+$/, '');
    }

    // НОВАЯ функция formatPrice (для единообразия)
    formatPrice(price) {
        const num = Number(price);
        if (isNaN(num)) return '0 ₽';
        return num.toFixed(2) + ' ₽';
    }

    // НОВАЯ функция formatCurrency (уже есть в utils, но продублируем для надежности)
    formatCurrency(amount) {
        const num = Number(amount);
        if (isNaN(num)) return '0 ₽';
        return num.toLocaleString('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
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
            // Очищаем контейнер
            this.orderPhotos.innerHTML = '';
            
            // Загружаем каждое медиа и создаем для него элемент
            for (const media of photos) {
                const isVideo = media.mediaType === 1;
                const mediaType = isVideo ? 'video' : 'photo';
                
                const item = document.createElement('div');
                item.className = 'media-item';
                item.dataset.mediaId = media.id;
                item.dataset.mediaType = mediaType;
                item.dataset.mediaTypeCode = media.mediaType;
                item.dataset.photoIndex = photos.indexOf(media) + 1;
                item.dataset.orderNumber = this.orderData?.orderNumber;
                
                const container = document.createElement('div');
                container.className = 'media-container';
                
                if (isVideo) {
                    // Для видео пытаемся извлечь кадр
                    try {
                        // Получаем URL видео
                        const videoUrl = `/api/media/${media.id}/file`;
                        
                        // Создаем video элемент для извлечения кадра
                        const video = document.createElement('video');
                        video.src = videoUrl;
                        video.crossOrigin = 'anonymous';
                        video.preload = 'metadata';
                        
                        // Добавляем заголовок авторизации
                        const headers = new Headers();
                        headers.append('Authorization', `Bearer ${apiService.token}`);
                        
                        // Загружаем видео через fetch для получения blob
                        const response = await fetch(videoUrl, {
                            headers: { 'Authorization': `Bearer ${apiService.token}` }
                        });
                        const blob = await response.blob();
                        video.src = URL.createObjectURL(blob);
                        
                        // Создаем canvas для извлечения кадра
                        const canvas = document.createElement('canvas');
                        canvas.className = 'media-canvas';
                        
                        // Ждем загрузки метаданных
                        await new Promise((resolve, reject) => {
                            video.onloadedmetadata = () => {
                                // Устанавливаем время для извлечения кадра (0.5 секунды)
                                video.currentTime = Math.min(0.5, video.duration || 0.5);
                            };
                            
                            video.onseeked = () => {
                                // Рисуем кадр на canvas
                                canvas.width = video.videoWidth || 300;
                                canvas.height = video.videoHeight || 200;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                
                                // Очищаем URL
                                URL.revokeObjectURL(video.src);
                                video.remove();
                                resolve();
                            };
                            
                            video.onerror = () => {
                                console.warn(`Failed to load video ${media.id}`);
                                reject(new Error('Video load failed'));
                            };
                            
                            video.onstalled = () => reject(new Error('Video stalled'));
                        });
                        
                        container.appendChild(canvas);
                        
                    } catch (error) {
                        console.warn(`Could not extract frame from video ${media.id}:`, error);
                        
                        // Fallback - показываем иконку
                        const videoPlaceholder = document.createElement('div');
                        videoPlaceholder.className = 'video-placeholder';
                        videoPlaceholder.innerHTML = `
                            <div class="video-label">Видео</div>
                        `;
                        container.appendChild(videoPlaceholder);
                    }
                    
                    // Добавляем оверлей с play-кнопкой
                    const overlay = document.createElement('div');
                    overlay.className = 'video-play-overlay';
                    overlay.innerHTML = '<div class="video-play-icon">▶</div>';
                    container.appendChild(overlay);
                    
                } else {
                    // Для фото используем прямой URL
                    const img = document.createElement('img');
                    img.src = `/api/media/${media.id}/file`;
                    img.className = 'media-img';
                    img.alt = escapeHtml(media.originalFileName || 'Фото');
                    img.loading = 'lazy';
                    
                    // Добавляем заголовок авторизации через fetch
                    img.onerror = () => {
                        console.warn(`Failed to load image ${media.id}, trying with auth header`);
                        fetch(`/api/media/${media.id}/file`, {
                            headers: { 'Authorization': `Bearer ${apiService.token}` }
                        })
                        .then(response => response.blob())
                        .then(blob => {
                            const url = URL.createObjectURL(blob);
                            img.src = url;
                        })
                        .catch(err => {
                            console.error(`Error loading image ${media.id}:`, err);
                            img.style.display = 'none';
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'media-error';
                            errorDiv.textContent = 'Ошибка загрузки';
                            container.appendChild(errorDiv);
                        });
                    };
                    
                    container.appendChild(img);
                }
                
                // Бейдж типа
                const badge = document.createElement('div');
                badge.className = `media-type-badge ${mediaType}`;
                badge.textContent = isVideo ? 'Видео' : 'Фото';
                container.appendChild(badge);
                
                item.appendChild(container);
                
                // Информация
                const info = document.createElement('div');
                info.className = 'media-info';
                info.innerHTML = `
                    <div class="media-name" title="${escapeHtml(media.originalFileName || '')}">
                        ${escapeHtml(media.originalFileName || (isVideo ? 'Видео' : 'Фото'))}
                    </div>
                    <div class="media-meta">
                        <span>${formatFileSize(media.size)}</span>
                        <span>${formatDate(media.uploadedAt)}</span>
                    </div>
                `;
                item.appendChild(info);
                
                this.orderPhotos.appendChild(item);
            }
            
            // Навешиваем обработчики для просмотра
            this.orderPhotos.addEventListener('click', (e) => {
                const item = e.target.closest('.media-item');
                if (!item) return;
                
                const mediaId = item.dataset.mediaId;
                const mediaType = item.dataset.mediaType;
                const fileName = item.querySelector('.media-name')?.textContent || 'Файл';
                const orderNumber = item.dataset.orderNumber;
                const photoIndex = item.dataset.photoIndex;
                
                if (mediaType === 'video') {
                    if (typeof openVideoPreview === 'function') {
                        openVideoPreview(mediaId, fileName, orderNumber, false);
                    } else {
                        console.error('openVideoPreview is not defined');
                        showTempMessage('Функция просмотра видео недоступна', 'error');
                    }
                } else {
                    const img = item.querySelector('img');
                    if (img) {
                        openPhotoPreview(
                            img.src,
                            fileName,
                            mediaId,
                            orderNumber,
                            photoIndex
                        );
                    }
                }
            });            
        } catch (error) {
            console.error('Error rendering photos:', error);
            this.orderPhotos.innerHTML = '<div class="no-photos">Ошибка загрузки фото</div>';
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

    /**
     * Форматирует телефон в нужный формат
     */
    formatPhoneNumber(phone) {
        if (!phone) return '';
        
        // Очищаем от всего кроме цифр
        let digits = phone.replace(/\D/g, '');
        
        // Если номер начинается с 8, меняем на 7
        if (digits.length === 11 && digits[0] === '8') {
            digits = '7' + digits.substring(1);
        }
        
        // Если номер уже с 7 и 11 цифр
        if (digits.length === 11 && digits[0] === '7') {
            return `+7 (${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7, 9)}-${digits.substring(9, 11)}`;
        }
        
        // Если 10 цифр без 7
        if (digits.length === 10) {
            return `+7 (${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 8)}-${digits.substring(8, 10)}`;
        }
        
        // Если что-то другое - возвращаем как есть
        return phone;
    }

    /**
     * Инициализация мини-карты для просмотра заказа
     */
    async initMiniMap(plotCoords, clientCoords) {
        if (!plotCoords || !clientCoords || !this.orderMapContainer) {
            return;
        }
        
        try {            
            // Загружаем API если еще не загружен
            if (!window.ymaps) {
                await this.loadYandexMaps();
            }
            
            await new Promise(resolve => ymaps.ready(resolve));
            
            // Очищаем контейнер
            this.orderMapContainer.innerHTML = '';
            
            // Создаем мини-карту
            this.miniMap = new ymaps.Map(this.orderMapContainer, {
                center: [
                    (plotCoords.lat + clientCoords.lat) / 2,
                    (plotCoords.lng + clientCoords.lng) / 2
                ],
                zoom: 11,
                controls: ['zoomControl']
            });
            
            // Маркер участка (зеленый)
            const plotMarker = new ymaps.Placemark(
                [plotCoords.lat, plotCoords.lng],
                { 
                    hintContent: 'Участок',
                    balloonContent: 'Участок: ' + (this.orderData?.place || '')
                },
                { preset: 'islands#greenIcon' }
            );
            
            // Маркер захоронения (красный)
            const clientMarker = new ymaps.Placemark(
                [clientCoords.lat, clientCoords.lng],
                { 
                    hintContent: 'Место захоронения',
                    balloonContent: 'Место захоронения'
                },
                { preset: 'islands#redIcon' }
            );
            
            this.miniMap.geoObjects.add(plotMarker);
            this.miniMap.geoObjects.add(clientMarker);
            
            // ===== ДОБАВЛЯЕМ МАРШРУТ =====
            try {
                // Создаем мультимаршрут
                const multiRoute = new ymaps.multiRouter.MultiRoute({
                    referencePoints: [
                        [plotCoords.lat, plotCoords.lng],
                        [clientCoords.lat, clientCoords.lng]
                    ],
                    params: {
                        routingMode: 'auto',
                        avoidTrafficJams: true,
                        results: 1
                    }
                }, {
                    boundsAutoApply: false,
                    
                    // ОТКЛЮЧАЕМ ВСТРОЕННЫЕ МАРКЕРЫ
                    wayPointStartIconColor: '',           // Убираем цвет
                    wayPointStartIconFillColor: '',       // Убираем заливку
                    wayPointEndIconColor: '',             // Убираем цвет
                    wayPointEndIconFillColor: '',         // Убираем заливку
                    wayPointVisible: false,                // Скрываем точки маршрута
                    
                    // Оставляем только линию
                    activeRouteStrokeColor: '#0066ff',
                    activeRouteStrokeWidth: 4,
                    activeRouteStrokeStyle: 'solid',
                    
                    // Отключаем всё лишнее
                    balloonContentLayout: null,
                    iconColor: 'transparent',
                    pinVisible: false
                });
                
                this.miniMap.geoObjects.add(multiRoute);
                
            } catch (routeError) {
                console.error('Error creating route:', routeError);
            }
            
            // Принудительно обновляем размер карты
            this.miniMap.container.fitToViewport();            
        } catch (error) {
            console.error('Ошибка инициализации мини-карты:', error);
            this.orderMapContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Ошибка загрузки карты</div>';
        }
    }

    /**
     * Загрузка Яндекс.Карт
     */
    loadYandexMaps() {
        return new Promise((resolve, reject) => {
            if (window.ymaps) {
                resolve();
                return;
            }
            
            // Получаем ключ из конфига
            this.loadYandexConfig().then(config => {
                const script = document.createElement('script');
                script.src = `https://api-maps.yandex.ru/2.1/?apikey=${config.yandexMapsKey}&lang=ru_RU&load=package.full`;
                script.onload = () => {
                    resolve();
                };
                script.onerror = (error) => {
                    console.error('Failed to load Yandex Maps:', error);
                    reject(error);
                };
                document.head.appendChild(script);
            }).catch(reject);
        });
    }

    /**
     * Загрузка конфига для Яндекс.Карт
     */
    async loadYandexConfig() {
        try {
            const response = await fetch('/api/config', {
                headers: { 'Authorization': `Bearer ${apiService.token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Error loading Yandex config:', error);
            return { yandexMapsKey: '2789b7ef-c9eb-49a8-ba22-9711e05ad7f0' };
        }
    }

    /**
     * Построение ссылки для Яндекс.Навигатора
     */
    buildNavigatorUrl(fromLat, fromLng, toLat, toLng) {
        // Яндекс.Навигатор для мобильных устройств
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
            // Для мобильных - открываем в приложении Навигатора
            return `yandexnavi://build_route_on_map?lat_to=${toLat}&lon_to=${toLng}&lat_from=${fromLat}&lon_from=${fromLng}`;
        } else {
            // Для ПК - открываем в Яндекс.Картах с маршрутом
            return `https://yandex.ru/maps/?rtext=${fromLat},${fromLng}~${toLat},${toLng}&rtt=auto`;
        }
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