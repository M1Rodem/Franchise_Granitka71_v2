import { PageManager } from '../core/page-manager.js';
import { apiService } from '../api/api.js';
import { getTodayDate, isValidEmail, isValidPhone, populateForm, getFormValue, showTempMessage, escapeHtml, formatFileSize, formatDate  } from '../utils/utils.js';
import { 
    clearTempPhotos, 
    loadAndCleanupTemp,
    openVideoPreview,
    uploadTempMediaAndDisplay, 
    removeTempMedia,
    createMediaPreviewItem 
} from '../utils/photo-utils.js';
import { checkBlocking } from '../notification/notification-blocking.js';
import { YandexMapManager } from '../map/yandex-map-manager.js';
import { ModalUtils } from '../utils/modal-utils.js';


export class CreateOrderManager {
    constructor(pageManager) {
        this.pageManager = pageManager;
        this.editingOrderId = null;
        this.orderPhotos = [];
        this.originalOrderData = null;
        this.workItemsCount = 0;
        
        // НОВЫЕ ПОЛЯ
        this.plots = [];
        this.selectedPlot = null;
        this.mapManager = null;
        this.userCoordinates = null;
        
        // НОВЫЕ МАССИВЫ ДЛЯ МЕДИА
        this.draftChanges = {
            fieldChanges: {},
            removedPhotoIds: [],
            tempUploadIds: [],
            tempPhotoIds: [],
            tempVideoIds: []
        };
        
        this.initElements();
        this.bindEvents();

        this.isUpdatingDistance = false;
        this.lastDistanceUpdate = null;
    }
    
    collectFormData() {
        // 1. БАЗОВЫЕ ПОЛЯ ФОРМЫ
        const orderDateValue = getFormValue('orderDate');
        
        // Определяем финальную дату
        let finalOrderDate;
        if (this.originalOrderData && orderDateValue === new Date(this.originalOrderData.orderDate).toISOString().slice(0, 10)) {
            // Дата не изменилась - используем оригинальную с временем
            finalOrderDate = this.originalOrderData.orderDate;
        } else {
            // Дата изменилась или новый заказ - устанавливаем полночь UTC
            finalOrderDate = orderDateValue ? 
                new Date(orderDateValue + 'T00:00:00Z').toISOString() : 
                new Date().toISOString();
        }
        
        // 2. ПОЛУЧАЕМ ID УЧАСТКА
        const plotIdValue = getFormValue('plotSelect');
        const plotId = plotIdValue && plotIdValue.trim() !== '' ? parseInt(plotIdValue, 10) : null;
        
        // 3. ПОЛУЧАЕМ РАБОТЫ И ПЛАТЕЖИ
        const workItems = this.collectWorkItems();
        const payments = this.collectPayments();
        
        // 4. ВЫЧИСЛЯЕМ ОБЩУЮ СУММУ
        const totalPrice = workItems.reduce((sum, item) => {
            return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }, 0);
        
        // 5. ОСНОВНОЙ ОБЪЕКТ ДАННЫХ (ВСЕ ПОЛЯ ВСЕГДА ПРИСУТСТВУЮТ)
        const data = {
            // Обязательные поля
            place: this.selectedPlot?.name || getFormValue('place') || '',
            inspectionPlace: getFormValue('inspectionPlace') || '',
            orderDate: finalOrderDate,
            latitude: parseFloat(getFormValue('latitude')) || 0,
            longitude: parseFloat(getFormValue('longitude')) || 0,
            plotId: plotId,
            deceasedFullName: getFormValue('deceasedFullName') || '',
            customerFullName: getFormValue('customerFullName') || '',
            customerEmail: getFormValue('customerEmail') || '',
            address: getFormValue('address') || '',
            phone: getFormValue('phone') || '',
            monumentType: getFormValue('monumentType') || '',
            monumentSize: getFormValue('monumentSize') || '',
            additionalInfo: getFormValue('additionalInfo') || '',
            status: 0, // По умолчанию "Новый"
            totalPrice: totalPrice,
            
            // Работы и платежи (ВСЕГДА массивы)
            workItems: workItems,
            payments: payments,
            
            // ===== КРИТИЧЕСКИ ВАЖНО: МЕДИА В ПРАВИЛЬНОМ ФОРМАТЕ =====
            // Новые временные медиа
            tempPhotoIds: this.draftChanges.tempPhotoIds || [], // Всегда массив
            tempVideoIds: this.draftChanges.tempVideoIds || [], // Всегда массив
            
            // ID на удаление (только существующих)
            removedPhotoIds: this.draftChanges.removedPhotoIds || [], // Всегда массив
            removedVideoIds: this.draftChanges.removedVideoIds || [], // Всегда массив
            
            // Для обратной совместимости (скоро удалим)
            tempUploadIds: [...(this.draftChanges.tempPhotoIds || []), ...(this.draftChanges.tempVideoIds || [])]
        };
        
        // 7. ПРОВЕРКА НА НАЛИЧИЕ МАССИВОВ (НИКОГДА НЕ NULL!)
        if (!data.tempPhotoIds) data.tempPhotoIds = [];
        if (!data.tempVideoIds) data.tempVideoIds = [];
        if (!data.removedPhotoIds) data.removedPhotoIds = [];
        if (!data.removedVideoIds) data.removedVideoIds = [];
        
        return data;
    }

    initElements() {
        // ПРОВЕРЯЕМ БЛОКИРОВКУ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
        this.checkPageAccess();

        // Основные элементы формы
        this.form = document.getElementById('createOrderForm');
        this.pageTitle = document.getElementById('pageTitle');
        this.submitBtn = document.getElementById('submitBtn');
        
        // НОВЫЕ ЭЛЕМЕНТЫ ДЛЯ КАРТЫ И УЧАСТКОВ
        this.plotSelect = document.getElementById('plotSelect');
        this.plotCoordinatesInfo = document.getElementById('plotCoordinatesInfo'); // ВАЖНО!
        this.mapContainer = document.getElementById('mapContainer');
        this.latitudeInput = document.getElementById('latitude');
        this.longitudeInput = document.getElementById('longitude');
        this.distanceInfo = document.getElementById('distanceInfo');
        this.distanceValue = document.getElementById('distanceValue');
        
        // Элементы для работы с фото
        this.photoInput = document.getElementById('photoInput');
        this.uploadArea = document.getElementById('photoUploadArea');
        this.photoPreview = document.getElementById('photoPreview');
        
        // Элементы таблиц
        this.addWorkBtn = document.getElementById('addWorkItemBtn');
        this.addPaymentBtn = document.getElementById('addPaymentBtn');
        this.workItemsTable = document.querySelector('#workItemsTable tbody');
        this.paymentsTable = document.querySelector('#paymentsTable tbody');
        
        // Элементы отображения
        this.totalPriceInput = document.getElementById('totalPriceInput');
        this.totalPriceDisplay = document.getElementById('totalPriceDisplay');
        this.orderDateInput = document.getElementById('orderDate');

        this.mediaInput = document.getElementById('mediaInput');
        this.mediaUploadArea = document.getElementById('mediaUploadArea');
        this.mediaPreview = document.getElementById('mediaPreview');
    }

    async initialize() {       
        await loadAndCleanupTemp();
        await this.setupUserInterface();
        this.setDefaultDate();
        this.setupNumberInputs();
        this.setupPhoneMask();
        this.setupQuantityInputsNormalization();
        
        // Загружаем участки и карту параллельно
        await Promise.all([
            this.loadPlots(),
            this.initializeMap()
        ]);
        
        // Проверяем режим редактирования
        await this.checkEditMode();
        
        // Если это не режим редактирования, создаём только строку расстояния
        if (!this.editingOrderId) {
            if (this.workItemsTable) {
                this.workItemsTable.innerHTML = '';
            }
            this.ensureDistanceRowExists();
            
            // НОВОЕ: Очищаем предыдущие временные файлы при создании нового заказа
            await this.cleanupTempFiles();
        }
        
        // Инициализируем медиа-превью с правильными обработчиками
        if (this.mediaPreview) {
            await this.setupMediaPreviewEvents();
        }
        
        // НОВОЕ: Добавляем обработчики для очистки при уходе со страницы
        this.setupExitCleanup();
    }

    /**
     * НОВЫЙ МЕТОД: Настройка очистки при выходе со страницы
     */
    setupExitCleanup() {
        // Очистка при закрытии вкладки или переходе на другую страницу
        window.addEventListener('beforeunload', (e) => {
            // Только если есть временные файлы и это не режим редактирования
            if (!this.editingOrderId && 
                (this.draftChanges.tempPhotoIds.length > 0 || 
                this.draftChanges.tempVideoIds.length > 0)) {
                
                // Используем sendBeacon для надежной отправки даже при закрытии
                const allTempIds = [
                    ...this.draftChanges.tempPhotoIds,
                    ...this.draftChanges.tempVideoIds
                ];
                
                // Отправляем синхронный запрос на удаление
                const blob = new Blob([JSON.stringify({ tempIds: allTempIds })], 
                                    { type: 'application/json' });
                navigator.sendBeacon('/api/media/cleanup', blob);
            }
        });
        
        // Очистка при навигации внутри приложения
        window.addEventListener('pagehide', () => {
            this.performCleanup();
        });
    }

    /**
     * НОВЫЙ МЕТОД: Выполнение очистки
     */
    async performCleanup() {
        if (!this.editingOrderId && 
            (this.draftChanges.tempPhotoIds.length > 0 || 
            this.draftChanges.tempVideoIds.length > 0)) {
            await this.cleanupTempFiles();
        }
    }

    /**
     * Гарантирует наличие ТОЛЬКО ОДНОЙ строки "Расстояние" в таблице работ
     */
    ensureDistanceRowExists() {
        if (!this.workItemsTable) return;
        
        // Ищем строку с data-distance="true"
        let distanceRow = this.workItemsTable.querySelector('tr[data-distance="true"]');
        
        // Находим все строки с расстоянием (по значению поля)
        const allRows = this.workItemsTable.querySelectorAll('tr');
        const distanceRows = [];
        
        allRows.forEach(row => {
            const descInput = row.querySelector('input[name="workDescription"]');
            if (descInput && descInput.value === 'Расстояние') {
                distanceRows.push(row);
            }
        });
        
        
        if (distanceRows.length > 1) {
            // Удаляем все строки расстояния, кроме правильной (с data-distance)
            distanceRows.forEach(row => {
                if (!row.hasAttribute('data-distance')) {
                    row.remove();
                }
            });
        }
        
        // Если нет правильной строки с data-distance, но есть обычные строки
        if (!distanceRow && distanceRows.length === 1) {
            // Берём единственную строку и добавляем ей атрибут
            distanceRows[0].setAttribute('data-distance', 'true');
            distanceRow = distanceRows[0];
        }
        
        // Если нет ни одной строки с расстоянием - создаём
        if (!distanceRow) {
            this.addWorkItemRow({
                workDescription: 'Расстояние',
                quantity: 0,
                note: 'Расчетное расстояние: ожидание координат',
                price: 0
            }, true); // true = isDistance
        }
    }

    /**
     * Очищает таблицу работ, оставляя только строку "Расстояние"
     */
    clearWorkItemsTable() {
        if (!this.workItemsTable) return;
        const rows = this.workItemsTable.querySelectorAll('tr');
        
        rows.forEach(row => {
            row.remove();
        });
    }

    /**
     * НОВЫЙ МЕТОД: Настройка событий для медиа-превью
     */
    async setupMediaPreviewEvents() {
        const container = this.mediaPreview;
        
        // Удаляем старые обработчики, чтобы не было дублей
        const newContainer = container.cloneNode(false);
        container.parentNode.replaceChild(newContainer, container);
        this.mediaPreview = newContainer;
        
        // Навешиваем один обработчик на контейнер (делегирование)
        this.mediaPreview.addEventListener('click', async (e) => {
            const mediaItem = e.target.closest('.media-item');
            if (!mediaItem) return;
            
            const mediaId = mediaItem.dataset.mediaId;
            const tempId = mediaItem.dataset.tempId;
            const mediaType = mediaItem.dataset.mediaType;
            const mediaTypeCode = parseInt(mediaItem.dataset.mediaTypeCode);
            const fileName = mediaItem.querySelector('.media-name')?.textContent || 'Файл';
            
            // 1. ОБРАБОТКА УДАЛЕНИЯ
            if (e.target.classList.contains('media-remove') || 
                e.target.classList.contains('media-remove-existing') ||
                e.target.closest('.media-remove') ||
                e.target.closest('.media-remove-existing')) {
                
                e.preventDefault();
                e.stopPropagation();
                
                if (tempId) {
                    // Удаление временного файла
                    await this.handleTempMediaRemoval(tempId, mediaType);
                } else if (mediaId) {
                    // Помечаем существующий файл на удаление
                    await this.markExistingMediaForRemoval(mediaId, mediaType, mediaTypeCode, mediaItem);
                }
                return;
            }
            
            // 2. ОБРАБОТКА ПРОСМОТРА (только не по кнопке удаления)
            if (!e.target.closest('button')) {
                if (mediaType === 'video' || mediaTypeCode === 1) {
                    // Для видео - открываем плеер
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (tempId) {
                        // Для временного видео - тоже можно воспроизвести!
                        await openVideoPreview(tempId, fileName, this.editingOrderId, true); // true = isTemp
                    } else if (mediaId) {
                        // Для существующего видео
                        await openVideoPreview(mediaId, fileName, this.editingOrderId, false);
                    }
                } else {
                    // Для фото - открываем просмотр
                    const img = mediaItem.querySelector('img');
                    if (img) {
                        const { openPhotoPreview } = await import('/js/utils/photo-utils.js');
                        openPhotoPreview(
                            img.src,
                            fileName,
                            mediaId || tempId,
                            this.editingOrderId,
                            mediaItem.dataset.photoIndex
                        );
                    }
                }
            }
        });
        
        // Добавляем обработчик drag & drop
        this.setupDragAndDrop();
    }

    /**
     * НОВЫЙ МЕТОД: Очистка всех временных файлов при выходе
     */
    async cleanupTempFiles() {        
        // Собираем все временные ID
        const allTempIds = [
            ...(this.draftChanges.tempPhotoIds || []),
            ...(this.draftChanges.tempVideoIds || [])
        ];
        
        if (allTempIds.length === 0) {
            return;
        }
        // Удаляем каждый временный файл
        for (const tempId of allTempIds) {
            try {
                await apiService.deleteTempMedia(tempId);
            } catch (error) {
                console.error(`[CreateOrder] Ошибка удаления tempId ${tempId}:`, error);
            }
        }
        
        // Очищаем массивы
        this.draftChanges.tempPhotoIds = [];
        this.draftChanges.tempVideoIds = [];
        this.draftChanges.tempUploadIds = [];
        
        // Очищаем DOM
        if (this.mediaPreview) {
            this.mediaPreview.innerHTML = '';
        }
    }

    /**
     * НОВЫЙ МЕТОД: Пометить существующее медиа на удаление
     */
    async markExistingMediaForRemoval(mediaId, mediaType, mediaTypeCode, mediaItem) {
        try {
            const confirmed = await ModalUtils.confirm({
                title: 'Удаление медиа',
                message: `Пометить этот файл для удаления? Он будет удален после сохранения заказа.`,
                confirmText: 'Пометить',
                danger: true
            });
            
            if (confirmed) {
                // Визуально помечаем
                mediaItem.style.opacity = '0.5';
                mediaItem.style.filter = 'grayscale(100%)';
                mediaItem.classList.add('marked-for-deletion');
                
                // Меняем кнопку
                const removeBtn = mediaItem.querySelector('.media-remove-existing');
                if (removeBtn) {
                    removeBtn.textContent = '✓';
                    removeBtn.title = 'Будет удалено';
                    removeBtn.disabled = true;
                }
                
                // Добавляем в соответствующий массив
                if (mediaTypeCode === 0 || mediaType === 'photo') {
                    if (!this.draftChanges.removedPhotoIds.includes(parseInt(mediaId))) {
                        this.draftChanges.removedPhotoIds.push(parseInt(mediaId));
                    }
                } else {
                    if (!this.draftChanges.removedVideoIds.includes(parseInt(mediaId))) {
                        this.draftChanges.removedVideoIds.push(parseInt(mediaId));
                    }
                }
                showTempMessage('Файл будет удален после сохранения', 'info');
            }
        } catch (error) {
            console.error('Error marking media for removal:', error);
            showTempMessage('Ошибка при пометке файла', 'error');
        }
    }

    /**
     * НОВЫЙ МЕТОД: Настройка drag & drop
     */
    setupDragAndDrop() {
        if (!this.mediaUploadArea) return;
        
        const uploadArea = this.mediaUploadArea;
        
        // Удаляем старые обработчики
        const newUploadArea = uploadArea.cloneNode(true);
        uploadArea.parentNode.replaceChild(newUploadArea, uploadArea);
        this.mediaUploadArea = newUploadArea;
        
        // Навешиваем новые
        this.mediaUploadArea.addEventListener('click', () => {
            this.mediaInput.click();
        });
        
        this.mediaUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.mediaUploadArea.classList.add('dragover');
        });
        
        this.mediaUploadArea.addEventListener('dragleave', () => {
            this.mediaUploadArea.classList.remove('dragover');
        });
        
        this.mediaUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.mediaUploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            for (let file of files) {
                this.handleMediaUpload(file);
            }
        });
        
        // Обновляем input
        if (this.mediaInput) {
            const newInput = this.mediaInput.cloneNode(true);
            this.mediaInput.parentNode.replaceChild(newInput, this.mediaInput);
            this.mediaInput = newInput;
            
            this.mediaInput.addEventListener('change', (e) => {
                const files = e.target.files;
                for (let file of files) {
                    this.handleMediaUpload(file);
                }
                e.target.value = '';
            });
        }
    }

    /**
     * Принудительное обновление маршрута при редактировании
     */
    forceRouteUpdate() {
        if (!this.mapManager || !this.selectedPlot || !this.userCoordinates) return;
        
        // Переустанавливаем маркеры, чтобы вызвать обновление маршрута
        if (this.mapManager.setPlotMarker && this.selectedPlot) {
            this.mapManager.setPlotMarker(
                this.selectedPlot.latitude,
                this.selectedPlot.longitude,
                { hint: this.selectedPlot.name }
            );
        }
        
        if (this.mapManager.setClientMarker && this.userCoordinates) {
            this.mapManager.setClientMarker(
                this.userCoordinates.lat,
                this.userCoordinates.lng,
                { hint: 'Место захоронения' }
            );
        }
    }

    /**
     * Нормализация ввода чисел (замена запятой на точку)
     */
    setupQuantityInputsNormalization() {
        // Обработчик для всех полей количества и цены на странице
        document.addEventListener('blur', (e) => {
            if (e.target.matches('input[name="quantity"], input[name="price"], input[type="number"]')) {
                let value = e.target.value;
                if (typeof value === 'string' && value.includes(',')) {
                    e.target.value = value.replace(',', '.');
                    // Триггерим событие input для пересчёта
                    e.target.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }, true);
        
        // Также обрабатываем при вводе
        document.addEventListener('input', (e) => {
            if (e.target.matches('input[name="quantity"], input[name="price"], input[type="number"]')) {
                let value = e.target.value;
                // Если пользователь вводит запятую, заменяем на точку на лету
                if (typeof value === 'string' && value.includes(',')) {
                    // Не меняем значение во время ввода, чтобы не сбивать пользователя
                    // Нормализация произойдёт при потере фокуса
                }
            }
        });
    }

    /**
     * ПОЛНОСТЬЮ ПЕРЕПИСАНО: Обработка загрузки медиафайлов
     * @param {File} file - загружаемый файл
     */
    async handleMediaUpload(file) {
        try {
            // 1. ВАЛИДАЦИЯ ТИПА ФАЙЛА
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            
            if (!isImage && !isVideo) {
                // Проверяем по расширению
                const ext = file.name.split('.').pop()?.toLowerCase();
                const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp'];
                const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic', 'heif'];
                
                if (!videoExts.includes(ext) && !imageExts.includes(ext)) {
                    showTempMessage(`Неподдерживаемый тип файла: ${file.type || ext}`, 'error');
                    return;
                }
            }
            
            // 2. ВАЛИДАЦИЯ РАЗМЕРА
            const MAX_SIZE = 500 * 1024 * 1024; // 500MB
            if (file.size > MAX_SIZE) {
                showTempMessage(`Файл слишком большой (макс 500MB): ${file.name}`, 'error');
                return;
            }
            
            // 3. ОПРЕДЕЛЯЕМ ТИП МЕДИА
            const mediaType = isVideo || file.type.startsWith('video/') ? 'video' : 'photo';
            
            // 4. ЗАГРУЖАЕМ ФАЙЛ НА СЕРВЕР
            const mediaData = await apiService.uploadTempMedia(file, mediaType);
            const tempId = mediaData.id;
            
            console.log(`[CreateOrder] Файл загружен, tempId: ${tempId}, тип: ${mediaType}`);
            
            // 5. СОЗДАЕМ ЭЛЕМЕНТ ПРЕВЬЮ С ПОМОЩЬЮ НОВОЙ ФУНКЦИИ
            const previewItem = await createMediaPreviewItem(
                file, 
                tempId, 
                mediaType, 
                async (id, type) => {
                    // Callback при удалении
                    await this.handleTempMediaRemoval(id, type);
                }
            );
            
            // 6. ДОБАВЛЯЕМ В КОНТЕЙНЕР
            if (this.mediaPreview) {
                this.mediaPreview.appendChild(previewItem);
            }
            
            // 7. СОХРАНЯЕМ В DRAFT CHANGES
            if (mediaType === 'photo') {
                if (!this.draftChanges.tempPhotoIds.includes(tempId)) {
                    this.draftChanges.tempPhotoIds.push(tempId);
                }
            } else {
                if (!this.draftChanges.tempVideoIds.includes(tempId)) {
                    this.draftChanges.tempVideoIds.push(tempId);
                }
            }
            
            // Для обратной совместимости
            if (!this.draftChanges.tempUploadIds.includes(tempId)) {
                this.draftChanges.tempUploadIds.push(tempId);
            }
            
            console.log('[CreateOrder] Медиа загружено:', {
                tempId,
                type: mediaType,
                fileName: file.name,
                fileSize: file.size,
                draftState: {
                    tempPhotoIds: this.draftChanges.tempPhotoIds,
                    tempVideoIds: this.draftChanges.tempVideoIds
                }
            });
            
            return { id: tempId, type: mediaType };
            
        } catch (error) {
            console.error('[CreateOrder] Ошибка загрузки медиа:', error);
            
            let userMessage = 'Ошибка загрузки';
            if (error.message.includes('too large')) {
                userMessage = 'Файл слишком большой (макс 500MB)';
            } else if (error.message.includes('type') || error.message.includes('format')) {
                userMessage = 'Неподдерживаемый формат файла';
            } else if (error.message.includes('network')) {
                userMessage = 'Ошибка сети. Проверьте подключение';
            } else {
                userMessage = error.message;
            }
            
            showTempMessage(userMessage, 'error');
            throw error;
        }
    }

    /**
     * Обновление строки "Расстояние" в таблице работ
     * ИСПРАВЛЕНО: ТОЛЬКО обновляет существующую строку, НИКОГДА не создаёт новую
     * Поиск ведётся по data-атрибуту, а не по значению поля
     */
    updateDistanceWorkItem(routeInfo) {
        if (!routeInfo || !this.workItemsTable) {
            return;
        }
        
        // Извлекаем числовое значение расстояния
        const distanceText = routeInfo.distance;
        const displayDistance = distanceText.replace(' км', '');
        const distanceKm = parseFloat(displayDistance.replace(',', '.'));
        
        if (isNaN(distanceKm)) {
            return;
        }
        
        // Конвертируем в метры
        const distanceMeters = Math.round(distanceKm * 1000);
        
        // Ищем строку с расстоянием по data-атрибуту (ЭТО ЕДИНСТВЕННЫЙ ПРАВИЛЬНЫЙ СПОСОБ)
        const distanceRow = this.workItemsTable.querySelector('tr[data-distance="true"]');
        
        // Если строка не найдена - это критическая ошибка, но создаём новую для восстановления
        if (!distanceRow) {
            console.error('КРИТИЧЕСКАЯ ОШИБКА: Строка расстояния не найдена! Создаём новую.');
            this.addWorkItemRow({
                workDescription: 'Расстояние',
                quantity: distanceMeters,
                note: `Расчетное расстояние: ${routeInfo.distance} (${routeInfo.duration})`,
                price: 0
            }, true); // true = isDistance
            return;
        }
        
        // Обновляем существующую строку        
        const quantityInput = distanceRow.querySelector('input[name="quantity"]');
        const noteInput = distanceRow.querySelector('input[name="note"]');
        const priceInput = distanceRow.querySelector('input[name="price"]');
        
        if (quantityInput) {
            quantityInput.value = distanceMeters;
        }
        
        if (noteInput) {
            noteInput.value = `Расчетное расстояние: ${routeInfo.distance} (${routeInfo.duration})`;
        }
        
        // Сохраняем цену, если она была (не сбрасываем)
        if (priceInput && priceInput.value === '0') {
            // Если цена 0, оставляем как есть - менеджер потом введёт
        }
        
        // Удаляем ВСЕ остальные строки с расстоянием (на всякий случай)
        const allRows = this.workItemsTable.querySelectorAll('tr');
        allRows.forEach(row => {
            if (row === distanceRow) return;
            const descInput = row.querySelector('input[name="workDescription"]');
            if (descInput && descInput.value === 'Расстояние' && !row.hasAttribute('data-distance')) {
                row.remove();
            }
        });
        
        // Пересчитываем итоговую сумму
        this.calculateTotalPrice();
    }

    /**
     * ПОЛНОСТЬЮ ПЕРЕПИСАНО: Обработка удаления временного медиа
     * @param {number} tempId - ID временного файла
     * @param {string} mediaType - 'photo' или 'video'
     */
    async handleTempMediaRemoval(tempId, mediaType) {
        try {
            await removeTempMedia(tempId, this, mediaType);
            
        } catch (error) {
            console.error('[CreateOrder] Ошибка удаления медиа:', error);
            showTempMessage('Ошибка при удалении файла', 'error');
            throw error;
        }
    }

    /**
     * Настройка маски для телефона
     */
    setupPhoneMask() {
        const phoneInput = document.getElementById('phone');
        if (!phoneInput) return;
        
        try {
            // Используем Inputmask если он загружен
            if (typeof Inputmask !== 'undefined') {
                new Inputmask({
                    mask: '+7 (999) 999-99-99',
                    placeholder: '_',
                    showMaskOnHover: false,
                    clearIncomplete: true,
                    onBeforePaste: function (pastedValue) {
                        const numbers = pastedValue.replace(/\D/g, '');
                        if (numbers[0] === '8') return '7' + numbers.substring(1);
                        if (numbers[0] === '7') return numbers;
                        return '7' + numbers;
                    }
                }).mask(phoneInput);
            }
        } catch (error) {
            console.warn('Не удалось установить маску телефона:', error);
        }
    }

    /**
     * Инициализация карты
     */
    async initializeMap() {
        if (!this.mapContainer) {
            console.warn('Контейнер карты не найден');
            return;
        }
        
        try {
            const config = await this.loadYandexConfig();
            
            // ВАЖНО: добавляем mode: 'route'
            this.mapManager = new YandexMapManager('mapContainer', {
                center: [54.1931, 37.6175],
                zoom: 12,
                controls: ['zoomControl', 'fullscreenControl', 'searchControl'],
                mode: 'route' // <--- ЭТО ВКЛЮЧАЕТ РЕЖИМ МАРШРУТА
            });
            
            this.mapManager.setApiKey(config.yandexMapsKey);
            await this.mapManager.initialize();
            
            // Подписываемся на обновление маршрута
            this.mapManager.onRouteUpdateCallback((routeInfo) => {
                if (routeInfo) {
                    this.updateRouteInfo(routeInfo);
                } else {
                    this.hideRouteInfo();
                }
            });
            
            this.mapManager.setOnChange((lat, lng, address) => {
                this.userCoordinates = { lat, lng };
                
                if (this.latitudeInput) this.latitudeInput.value = lat;
                if (this.longitudeInput) this.longitudeInput.value = lng;
                
                this.validateCoordinates();
                
                if (address && this.addressInput && !this.addressInput.value) {
                    this.addressInput.value = address;
                }
                
                // ВАЖНО: Обновляем ссылку в навигатор при изменении координат клиента
                if (this.selectedPlot) {
                    this.updateNavigatorLink();
                }
            });            
        } catch (error) {
            console.error('Ошибка инициализации карты:', error);
            showTempMessage('Ошибка загрузки карты', 'error');
        }
    }

    async loadYandexConfig() {
        try {
            const response = await fetch('/api/config', {
                headers: {
                    'Authorization': `Bearer ${apiService.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error loading Yandex config:', error);
            return {
                yandexMapsKey: '2789b7ef-c9eb-49a8-ba22-9711e05ad7f0'
            };
        }
    }

    /**
     * Обновление информации о маршруте
     */
    updateRouteInfo(routeInfo) {
        if (!this.distanceInfo || !this.distanceValue) return;
        
        if (!routeInfo) {
            this.distanceInfo.style.display = 'none';
            return;
        }
        
        // Показываем расстояние и время в блоке
        this.distanceValue.innerHTML = `${routeInfo.distance} <span style="color: #666; font-size: 0.9em;">(~${routeInfo.duration})</span>`;
        this.distanceInfo.style.display = 'block';
        
        // ОБНОВЛЯЕМ СТРОКУ В ТАБЛИЦЕ РАБОТ
        this.updateDistanceWorkItem(routeInfo);
        
        // Обновляем ссылку в навигатор
        this.updateNavigatorLink();
    }

    updateNavigatorLink() {
        if (!this.selectedPlot || !this.userCoordinates || !this.distanceInfo) return;
        
        const navigatorUrl = this.buildNavigatorUrl(
            this.selectedPlot.latitude,
            this.selectedPlot.longitude,
            this.userCoordinates.lat,
            this.userCoordinates.lng
        );
        
        // Удаляем старую ссылку если есть
        const oldLink = this.distanceInfo.querySelector('.navigator-link');
        if (oldLink) {
            oldLink.remove();
        }
        
        // Создаём новую ссылку
        const navLink = document.createElement('a');
        navLink.className = 'navigator-link';
        navLink.style.display = 'block';
        navLink.style.marginTop = '8px';
        navLink.style.fontSize = '0.9em';
        navLink.href = navigatorUrl;
        navLink.target = '_blank';
        navLink.textContent = 'Открыть в Яндекс.Навигаторе';
        
        this.distanceInfo.appendChild(navLink);
    }

    /**
     * Построение ссылки для Яндекс.Навигатора
     */
    buildNavigatorUrl(fromLat, fromLng, toLat, toLng) {
        return `https://yandex.ru/maps/?rtext=${fromLat},${fromLng}~${toLat},${toLng}&rtt=auto`;
    }

    /**
     * Скрыть информацию о маршруте
     */
    hideRouteInfo() {
        if (this.distanceInfo) {
            this.distanceInfo.style.display = 'none';
        }
    }

    /**
     * Построение ссылки для Яндекс.Навигатора
     */
    buildNavigatorUrl(fromLat, fromLng, toLat, toLng) {
        return `https://yandex.ru/maps/?rtext=${fromLat},${fromLng}~${toLat},${toLng}&rtt=auto`;
    }

    /**
     * Загрузка списка участков
     */
    async loadPlots() {
        if (!this.plotSelect) {
            console.error('Элемент plotSelect не найден');
            return;
        }
        
        try {
            // Показываем состояние загрузки
            this.plotSelect.innerHTML = '<option value="">Загрузка участков...</option>';
            this.plotSelect.disabled = true;
            
            // Загружаем только активные участки
            this.plots = await apiService.getPlots(false);
            
            // Очищаем и заполняем select
            this.plotSelect.innerHTML = '<option value="">Выберите участок...</option>';
            
            this.plots.forEach(plot => {
                if (plot.isActive) {
                    const option = document.createElement('option');
                    option.value = plot.id;
                    option.textContent = plot.name;
                    option.dataset.latitude = plot.latitude;
                    option.dataset.longitude = plot.longitude;
                    this.plotSelect.appendChild(option);
                }
            });
            
            this.plotSelect.disabled = false;
            
            // ФИКС: УБРАН АВТОМАТИЧЕСКИЙ ВЫБОР ПРИ ОДНОМ УЧАСТКЕ
            // Пользователь всегда должен сделать явный выбор
            
        } catch (error) {
            console.error('Ошибка загрузки участков:', error);
            this.plotSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
            showTempMessage('Не удалось загрузить список участков: ' + error.message, 'error');
        }
    }

    /**
     * Обработчик изменения выбранного участка
     */
    onPlotSelectChange() {
        if (!this.plotCoordinatesInfo) {
            console.warn('plotCoordinatesInfo не найден');
            return;
        }
        
        const selectedOption = this.plotSelect.options[this.plotSelect.selectedIndex];
        
        if (!selectedOption || !selectedOption.value) {
            this.selectedPlot = null;
            this.plotCoordinatesInfo.style.display = 'none';
            
            if (this.mapManager && this.mapManager.mode === 'route') {
                // Удаляем маркер участка
                if (this.mapManager.plotMarker) {
                    this.mapManager.map.geoObjects.remove(this.mapManager.plotMarker);
                    this.mapManager.plotMarker = null;
                }
                this.mapManager.plotCoords = null;
                this.mapManager._updateRoute();
            }
            
            this.hideRouteInfo();
            return;
        }
        
        const plotId = parseInt(selectedOption.value);
        this.selectedPlot = this.plots.find(p => p.id === plotId);
        
        if (!this.selectedPlot) {
            console.warn('Участок не найден в массиве plots:', plotId);
            return;
        }
        
        const lat = parseFloat(selectedOption.dataset.latitude);
        const lng = parseFloat(selectedOption.dataset.longitude);
        
        this.plotCoordinatesInfo.textContent = `Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        this.plotCoordinatesInfo.style.display = 'block';
        
        if (this.mapManager && lat && lng) {
            // Устанавливаем маркер участка
            this.mapManager.setPlotMarker(lat, lng, {
                hint: this.selectedPlot.name,
                balloon: `${this.selectedPlot.name}<br>Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
            });
        }
        
        // Если уже есть координаты клиента, обновим ссылку
        if (this.userCoordinates) {
            setTimeout(() => {
                this.updateNavigatorLink();
            }, 500);
        }
    }

    updateDistance() {
        if (!this.selectedPlot || !this.userCoordinates) {
            return;
        }
        
        if (this.distanceInfo && this.distanceValue) {
            const distance = this.calculateDistance(
                this.selectedPlot.latitude,
                this.selectedPlot.longitude,
                this.userCoordinates.lat,
                this.userCoordinates.lng
            );
            
            this.distanceValue.textContent = distance.toFixed(2);
            this.distanceInfo.style.display = 'block';
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    // ===== НОВЫЙ МЕТОД (сброс координат) =====
    resetUserCoordinates() {
        this.userCoordinates = null;
        
        if (this.latitudeInput) this.latitudeInput.value = '';
        if (this.longitudeInput) this.longitudeInput.value = '';
        
        if (this.mapManager) {
            this.mapManager.resetPlacemark();
        }
        
        if (this.distanceInfo) {
            this.distanceInfo.style.display = 'none';
        }
    }

    /**
     * Валидация координат
     */
    validateCoordinates() {
        if (!this.userCoordinates) {
            this.setFormError('mapContainer', 'Укажите местоположение на карте');
            return false;
        }
        
        const { lat, lng } = this.userCoordinates;
        
        // Проверяем диапазоны
        if (lat < -90 || lat > 90) {
            this.setFormError('mapContainer', 'Широта должна быть между -90 и 90');
            return false;
        }
        
        if (lng < -180 || lng > 180) {
            this.setFormError('mapContainer', 'Долгота должна быть между -180 и 180');
            return false;
        }
        
        this.clearFormError('mapContainer');
        return true;
    }

    /**
     * Установка ошибки для поля формы
     */
    setFormError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = 'var(--error)';
            const errorEl = field.parentElement.querySelector('.field-error');
            if (errorEl) {
                errorEl.textContent = message;
            } else {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'field-error';
                errorDiv.style.color = 'var(--error)';
                errorDiv.style.fontSize = '0.875rem';
                errorDiv.style.marginTop = '4px';
                errorDiv.textContent = message;
                field.parentElement.appendChild(errorDiv);
            }
        }
    }

    /**
     * Очистка ошибки поля
     */
    clearFormError(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '';
            const errorEl = field.parentElement.querySelector('.field-error');
            if (errorEl) {
                errorEl.remove();
            }
        }
    }
     /**
     * Проверка доступа к странице при прямой загрузке по URL
     */
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
                }, 2000);
                
                // Бросаем ошибку чтобы остановить дальнейшую инициализацию
                throw new Error('Доступ заблокирован');
            }
        } catch (error) {
            console.warn('[CreateOrder] Ошибка проверки доступа:', error);
            // Продолжаем загрузку при ошибке (fail-open)
        }
    }

    bindEvents() {
        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('userData');
                window.location.href = 'login.html';
            });
        }

        // НОВОЕ: Обработчик выбора участка
        if (this.plotSelect) {
            this.plotSelect.addEventListener('change', () => this.onPlotSelectChange());
        }

        // Input и Drag&Drop (ОБНОВЛЕННЫЙ КОД)
        if (this.mediaUploadArea) {
            // Клик для выбора файлов
            this.mediaUploadArea.addEventListener('click', () => {
                this.mediaInput.click();
            });
            
            // Drag & Drop
            this.mediaUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.mediaUploadArea.classList.add('dragover');
            });
            
            this.mediaUploadArea.addEventListener('dragleave', () => {
                this.mediaUploadArea.classList.remove('dragover');
            });
            
            this.mediaUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                this.mediaUploadArea.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                for (let file of files) {
                    this.handleMediaUpload(file);
                }
            });
        }
        
        // ОБНОВЛЕНО: Input для медиа
        if (this.mediaInput) {
            this.mediaInput.addEventListener('change', (e) => {
                const files = e.target.files;
                for (let file of files) {
                    this.handleMediaUpload(file);
                }
                e.target.value = '';
            });
        }

        // Таблицы: Добавление строк
        if (this.addWorkBtn) {
            this.addWorkBtn.addEventListener('click', () => this.addWorkItemRow());
            // УДАЛЯЕМ ЭТУ СТРОКУ: this.addWorkItemRow(); // Больше не создаём пустую строку автоматически
            this.setupWorkItemsTableEvents();
            this.calculateTotalPrice();
        }

        // Платежи
        if (this.addPaymentBtn) {
            this.addPaymentBtn.addEventListener('click', () => this.addAdditionalPayment());
            this.initializePayments();
        }

        // Submit формы
        if (this.form) {
            this.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitForm();
            });
        }
    }

    async setupUserInterface() {
        const userData = apiService.getCurrentUser();
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = userData.fullName || userData.username || 'Пользователь';
        }

        // Показ админ-элементов
        if (userData.role === 'Admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        }
    }

    setDefaultDate() {
        if (this.orderDateInput && !this.orderDateInput.value) {
            this.orderDateInput.value = getTodayDate();
        }
    }

    setupNumberInputs() {
        // Убираем стрелочки
        const style = document.createElement('style');
        style.textContent = `
            input[type="number"]::-webkit-outer-spin-button,
            input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            input[type="number"] {
                -moz-appearance: textfield;
                appearance: textfield;
            }
        `;
        document.head.appendChild(style);
        
        // Блокируем колесико мыши
        const preventScroll = (e) => e.preventDefault();
        
        document.addEventListener('wheel', (e) => {
            if (e.target.type === 'number') {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('focusin', (e) => {
            if (e.target.type === 'number') {
                e.target.addEventListener('wheel', preventScroll, { passive: false });
            }
        });
        
        document.addEventListener('focusout', (e) => {
            if (e.target.type === 'number') {
                e.target.removeEventListener('wheel', preventScroll);
            }
        });
        
        // Блокируем колесико для существующих полей
        const numberInputs = document.querySelectorAll('input[type="number"]');
        numberInputs.forEach(input => {
            input.addEventListener('wheel', preventScroll, { passive: false });
        });
    }

    async checkEditMode() {
        const params = new URLSearchParams(window.location.search);
        const editId = parseInt(params.get('edit'), 10);
        if (editId) {
            this.editingOrderId = editId;
            await this.loadOrderForEdit(editId);
            this.updateUIForEdit();
        }
    }

    updateUIForEdit() {
        if (this.pageTitle) this.pageTitle.textContent = 'Редактировать заказ';
        if (this.submitBtn) this.submitBtn.textContent = 'Сохранить изменения';
    }

    /**
     * ПОЛНОСТЬЮ ПЕРЕПИСАНО: Загрузка заказа для редактирования с поддержкой видео
     */
    async loadOrderForEdit(id) {
        try {
            // 1. ПОЛУЧАЕМ ДАННЫЕ ЗАКАЗА
            const order = await apiService.getOrder(id);
            
            // 2. СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ ДАННЫЕ
            this.originalOrderData = {
                place: order.place,
                inspectionPlace: order.inspectionPlace,
                plotId: order.plotId,
                latitude: order.latitude,
                longitude: order.longitude,
                orderDate: order.orderDate,
                deceasedFullName: order.deceasedFullName,
                customerFullName: order.customerFullName,
                customerEmail: order.customerEmail,
                phone: order.phone,
                address: order.address,
                monumentType: order.monumentType,
                monumentSize: order.monumentSize,
                additionalInfo: order.additionalInfo,
                workItems: order.workItems || [],
                payments: order.payments || []
            };

            // 3. ЗАПОЛНЯЕМ ОСНОВНУЮ ФОРМУ
            const displayData = {
                ...this.originalOrderData,
                orderDate: order.orderDate ? new Date(order.orderDate).toISOString().slice(0, 10) : getTodayDate()
            };
            populateForm('createOrderForm', displayData);

            // 4. ИНИЦИАЛИЗИРУЕМ DRAFT CHANGES (ОЧЕНЬ ВАЖНО!)
            this.draftChanges = {
                fieldChanges: {},
                removedPhotoIds: [],    // ID существующих фото на удаление
                removedVideoIds: [],    // ID существующих видео на удаление
                tempPhotoIds: [],       // ID новых временных фото
                tempVideoIds: [],       // ID новых временных видео
                tempUploadIds: []       // для обратной совместимости
            };

            // 5. ОБРАБАТЫВАЕМ МЕДИА - РАЗДЕЛЯЕМ ПО ТИПАМ
            this.orderPhotos = order.photos || [];
            
            const existingPhotos = this.orderPhotos.filter(p => p.mediaType === 0);
            const existingVideos = this.orderPhotos.filter(p => p.mediaType === 1);

            // 6. ОТОБРАЖАЕМ МЕДИА В РЕЖИМЕ РЕДАКТИРОВАНИЯ
            if (this.orderPhotos.length > 0 && this.mediaPreview) {
                try {
                    // Импортируем функцию рендера
                    const { renderPhotoGrid } = await import('/js/utils/photo-utils.js');
                    
                    // Очищаем контейнер
                    this.mediaPreview.innerHTML = '';
                    console.log('[CreateOrder] Начинаем рендер через renderPhotoGrid', this.orderPhotos.length, 'медиа');
                    
                    // Небольшая задержка для гарантии готовности DOM
                    setTimeout(async () => {
                        try {
                            await renderPhotoGrid(this.orderPhotos, 'mediaPreview', { 
                                mode: 'edit',
                                orderNumber: this.editingOrderId,
                                orderManager: this
                            });
                            console.log('[CreateOrder] Медиа отображено через renderPhotoGrid, элементов:', 
                                    this.mediaPreview?.children.length);
                        } catch (renderError) {
                            console.error('[CreateOrder] Ошибка в renderPhotoGrid:', renderError);
                        }
                    }, 50);
                    
                } catch (importError) {
                    console.error('[CreateOrder] Ошибка импорта renderPhotoGrid:', importError);
                }
            }

            // 7. УСТАНАВЛИВАЕМ УЧАСТОК (если есть)
            if (order.plotId && this.plotSelect) {
                const setPlotValue = () => {
                    if (this.plots && this.plots.length > 0) {
                        this.plotSelect.value = order.plotId;
                        this.selectedPlot = this.plots.find(p => p.id === order.plotId);
                        
                        if (this.selectedPlot && this.plotCoordinatesInfo) {
                            this.plotCoordinatesInfo.textContent = `Координаты: ${this.selectedPlot.latitude.toFixed(6)}, ${this.selectedPlot.longitude.toFixed(6)}`;
                            this.plotCoordinatesInfo.style.display = 'block';
                        }
                        
                        this.plotSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        setTimeout(setPlotValue, 100);
                    }
                };
                setPlotValue();
            }

            // 8. УСТАНАВЛИВАЕМ КООРДИНАТЫ (если есть)
            if (order.latitude && order.longitude) {
                this.userCoordinates = {
                    lat: order.latitude,
                    lng: order.longitude
                };
                
                if (this.latitudeInput) this.latitudeInput.value = order.latitude;
                if (this.longitudeInput) this.longitudeInput.value = order.longitude;
                
                // Устанавливаем маркер на карте
                const setMapMarker = () => {
                    if (this.mapManager && this.mapManager.isInitialized) {
                        this.mapManager.setClientMarker(order.latitude, order.longitude, {
                            hint: 'Место захоронения',
                            balloon: `Координаты: ${order.latitude.toFixed(6)}, ${order.longitude.toFixed(6)}`
                        });
                        
                        // Получаем адрес
                        if (!order.address && this.addressInput && !this.addressInput.value) {
                            this.mapManager.reverseGeocode(order.latitude, order.longitude)
                                .then(address => {
                                    if (address) this.addressInput.value = address;
                                })
                                .catch(err => console.warn('Reverse geocoding failed:', err));
                        }
                    } else {
                        setTimeout(setMapMarker, 200);
                    }
                };
                setMapMarker();
            }

            // 9. ЗАГРУЖАЕМ РАБОТЫ
            if (this.workItemsTable) {
                this.workItemsTable.innerHTML = '';
                
                if (order.workItems && order.workItems.length > 0) {
                    // Сначала добавляем все работы, кроме расстояния
                    const nonDistanceItems = order.workItems.filter(w => w.workDescription !== 'Расстояние');
                    nonDistanceItems.forEach(item => {
                        this.addWorkItemRow(item, false);
                    });
                    
                    // Потом добавляем расстояние (всегда одна строка)
                    const distanceItem = order.workItems.find(w => w.workDescription === 'Расстояние');
                    if (distanceItem) {
                        this.addWorkItemRow(distanceItem, true);
                    } else {
                        // Если нет расстояния, создаем пустую строку
                        this.addWorkItemRow({
                            workDescription: 'Расстояние',
                            quantity: 0,
                            note: 'Расчетное расстояние',
                            price: 0
                        }, true);
                    }
                } else {
                    // Если нет работ, создаем только расстояние
                    this.addWorkItemRow({
                        workDescription: 'Расстояние',
                        quantity: 0,
                        note: 'Расчетное расстояние',
                        price: 0
                    }, true);
                }
            }

            // 10. ЗАГРУЖАЕМ ПЛАТЕЖИ
            if (order.payments && order.payments.length > 0) {
                this.renderPaymentsTable(order.payments);
            } else {
                this.initializePayments();
            }

            // 11. ПЕРЕСЧИТЫВАЕМ ИТОГ
            this.calculateTotalPrice();

            // 12. НАСТРАИВАЕМ ОБРАБОТЧИКИ СОБЫТИЙ ДЛЯ МЕДИА
            await this.setupMediaPreviewEvents();

            // 13. ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ МАРШРУТА (если есть координаты)
            setTimeout(() => {
                if (this.selectedPlot && this.userCoordinates && this.mapManager) {
                    this.mapManager._updateRoute();
                }
            }, 1000);
        } catch (error) {
            console.error('[CreateOrder] Критическая ошибка загрузки заказа:', error);
            showTempMessage('Ошибка загрузки заказа: ' + error.message, 'error');
            
            // Пробрасываем ошибку дальше
            throw error;
        }
    }

    /**
     * Установка координат в режиме редактирования
     */
    async setEditModeCoordinates(order) {
        
        if (!this.mapManager) {
            console.warn('Map manager not initialized');
            return;
        }
        
        // Устанавливаем маркер участка (если есть участок)
        if (this.selectedPlot) {
            this.mapManager.setPlotMarker(
                this.selectedPlot.latitude,
                this.selectedPlot.longitude,
                {
                    hint: this.selectedPlot.name,
                    balloon: `${this.selectedPlot.name}<br>Координаты: ${this.selectedPlot.latitude.toFixed(6)}, ${this.selectedPlot.longitude.toFixed(6)}`
                }
            );
        }
        
        // Устанавливаем маркер клиента
        if (order.latitude && order.longitude) {
            
            this.mapManager.setClientMarker(order.latitude, order.longitude, {
                hint: 'Место захоронения',
                balloon: `Координаты: ${order.latitude.toFixed(6)}, ${order.longitude.toFixed(6)}`
            });
            
            // Получаем адрес через обратное геокодирование
            if (!order.address && this.addressInput && !this.addressInput.value) {
                try {
                    const address = await this.mapManager.reverseGeocode(order.latitude, order.longitude);
                    if (address) {
                        this.addressInput.value = address;
                    }
                } catch (err) {
                    console.warn('Reverse geocoding failed:', err);
                }
            }
        }
        
        // ИСПРАВЛЕНИЕ: Принудительно обновляем строку расстояния через 500мс
        // Это гарантирует, что даже если событие маршрута не сработало,
        // строка будет обновлена (или создана, если её нет)
        setTimeout(() => {
            if (this.mapManager.route) {
                try {
                    const activeRoute = this.mapManager.route.getActiveRoute();
                    if (activeRoute) {
                        const distance = activeRoute.properties.get('distance');
                        const duration = activeRoute.properties.get('duration');
                        
                        this.updateDistanceWorkItem({
                            distance: distance?.text || 'неизвестно',
                            distanceValue: distance?.value || 0,
                            duration: duration?.text || 'неизвестно',
                            durationValue: duration?.value || 0,
                            route: activeRoute
                        });
                    }
                } catch (e) {
                    console.warn('Could not force distance update:', e);
                }
            }
        }, 500);
    }

    validateForm(data) {
        // ОСНОВНЫЕ ПОЛЯ
        if (!data.inspectionPlace || data.inspectionPlace.trim() === '') {
            return '"Место смотрел" обязательно';
        }
        if (!data.place || data.place.trim() === '') return 'Укажите участок';
        if (!data.deceasedFullName || data.deceasedFullName.trim() === '') return 'ФИО и даты усопшего обязательно';
        if (!data.customerFullName || data.customerFullName.trim() === '') return 'ФИО заказчика обязательно';
        if (!data.address || data.address.trim() === '') return 'Адрес обязателен';
        if (!data.phone || data.phone.trim() === '') return 'Телефон обязателен';
        
        // НОВЫЕ ОБЯЗАТЕЛЬНЫЕ ПОЛЯ
        if (data.plotId === null || data.plotId === undefined) {
            return 'Выберите участок из списка';
        }
        if (data.latitude === null || data.longitude === null) return 'Укажите местоположение на карте';
        
        // ВАЛИДАЦИЯ КООРДИНАТ
        if (data.latitude < -90 || data.latitude > 90) return 'Широта должна быть между -90 и 90';
        if (data.longitude < -180 || data.longitude > 180) return 'Долгота должна быть между -180 и 180';
        
        // ВАЛИДАЦИЯ EMAIL
        if (data.customerEmail && !isValidEmail(data.customerEmail)) {
            return 'Неверный формат email';
        }
        
        // ВАЛИДАЦИЯ ТЕЛЕФОНА (ОБНОВЛЕНА)
        if (!isValidPhone(data.phone)) {
            return 'Неверный формат телефона. Используйте формат: +7 (999) 123-45-67';
        }
        
        // ИЗМЕНЕНО: Валидируем workItems только если они есть в data
        if (data.workItems && Array.isArray(data.workItems)) {
            const workItemsError = this.validateWorkItems(data.workItems);
            if (workItemsError) return workItemsError;
        } else if (!this.editingOrderId) {
            // Для нового заказа workItems обязательны
            return 'Укажите хотя бы один вид работ';
        }
        // Для редактирования: если workItems нет в data, значит они не изменились - это нормально
        
        return null;
    }
    
    async handleOrderCreation(orderData) {
        try {
            let result;
            
            if (this.editingOrderId) {
                result = await apiService.updateOrder(this.editingOrderId, orderData);
            } else {
                // Для нового заказа - обычное создание
                result = await apiService.createOrder(orderData);
                
                // НОВОЕ: После успешного создания, временные файлы больше не нужны
                // Бэкенд сам перенес их из temp в постоянное хранилище
                this.draftChanges.tempPhotoIds = [];
                this.draftChanges.tempVideoIds = [];
                this.draftChanges.tempUploadIds = [];
            }
            
            // ОЧИЩАЕМ ВСЕ ДАННЫЕ ПОСЛЕ СОХРАНЕНИЯ
            this.clearDraftChanges();
            clearTempPhotos();
            
            // ОЧИЩАЕМ ТАБЛИЦУ РАБОТ, ЧТОБЫ НЕ БЫЛО ДУБЛЕЙ ПРИ СЛЕДУЮЩЕМ СОЗДАНИИ
            if (this.workItemsTable) {
                this.workItemsTable.innerHTML = '';
            }
            
            const message = this.editingOrderId ? 'Заказ обновлён' : 'Заказ создан';
            showTempMessage(message, 'success');
            
            setTimeout(() => {
                if (this.editingOrderId) {
                    window.location.href = `view-order.html?id=${this.editingOrderId}`;
                } else {
                    window.location.href = 'orders.html';
                }
            }, 1500);
            
            return result;
        } catch (error) {
            console.error('Order creation error:', error);
            
            // ФИКС: Проверяем, не ошибка ли это "запроса на изменение"
            if (error.data?.message && error.data.message.includes("Запрос отправлен")) {
                showTempMessage(error.data.message, 'info');
                
                if (window.NotificationManager) {
                    await NotificationManager.updateBadgeCount();
                }
                
                setTimeout(() => {
                    window.location.href = `view-order.html?id=${this.editingOrderId}`;
                }, 2000);
                return;
            }
            
            showTempMessage('Ошибка сохранения: ' + (error.data?.message || error.message), 'error');
            throw error;
        }
    }

    clearDraftChanges() {
        this.draftChanges = {
            fieldChanges: {},
            removedPhotoIds: [],
            tempUploadIds: []
        };
    }

    hasFormDataChanged(originalData, currentData) {
        const fieldsToCompare = [
            'place', 'inspectionPlace', 'deceasedFullName',
            'customerFullName', 'customerEmail', 'phone', 'address',
            'monumentType', 'monumentSize', 'additionalInfo'
        ];
        
        for (const field of fieldsToCompare) {
            const originalValue = String(originalData[field] || '');
            const currentValue = String(currentData[field] || '');
            
            if (originalValue.trim() !== currentValue.trim()) {
                return true;
            }
        }
        
        // ПРОВЕРКА ДАТЫ (учитываем, что originalData.orderDate теперь полная ISO строка)
        const originalDate = originalData.orderDate ? 
            new Date(originalData.orderDate).toISOString().slice(0, 10) : '';
        const currentDate = currentData.orderDate ? 
            new Date(currentData.orderDate).toISOString().slice(0, 10) : '';
        
        if (originalDate !== currentDate) {
            return true;
        }
        
        // ПРОВЕРКА РАБОТ (теперь currentData.workItems может быть undefined)
        const normalizeWorkItem = (item) => ({
            workDescription: String(item.workDescription || '').trim(),
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            note: String(item.note || '').trim()
        });
        
        const originalItems = (originalData.workItems || []).map(normalizeWorkItem);
        const currentItems = (currentData.workItems || []).map(normalizeWorkItem);
        
        if (originalItems.length !== currentItems.length) return true;
        
        for (let i = 0; i < originalItems.length; i++) {
            const originalItem = originalItems[i];
            const currentItem = currentItems[i];
            
            if (originalItem.workDescription !== currentItem.workDescription ||
                originalItem.price !== currentItem.price ||
                originalItem.quantity !== currentItem.quantity ||
                originalItem.note !== currentItem.note) {
                return true;
            }
        }
        
        // ПРОВЕРКА ПЛАТЕЖЕЙ (теперь currentData.payments может быть undefined)
        const normalizePayment = (payment) => ({
            paymentType: String(payment.paymentType || '').trim(),
            amount: Number(payment.amount) || 0,
            paymentDate: payment.paymentDate ? 
                new Date(payment.paymentDate).toISOString().slice(0, 10) : '',
            note: String(payment.note || '').trim()
        });
        
        const originalPayments = (originalData.payments || []).map(normalizePayment);
        const currentPayments = (currentData.payments || []).map(normalizePayment);
        
        if (originalPayments.length !== currentPayments.length) return true;
        
        for (let i = 0; i < originalPayments.length; i++) {
            const originalPayment = originalPayments[i];
            const currentPayment = currentPayments[i];
            
            if (originalPayment.paymentType !== currentPayment.paymentType ||
                originalPayment.amount !== currentPayment.amount ||
                originalPayment.paymentDate !== currentPayment.paymentDate ||
                originalPayment.note !== currentPayment.note) {
                return true;
            }
        }
        
        // ПРОВЕРКА ФОТО (осталось без изменений)
        const originalPhotoIds = originalData.photoIds || [];
        const currentServerPhotoIds = currentData.photoIds || [];
        
        if (originalPhotoIds.length !== currentServerPhotoIds.length) return true;
        
        for (const photoId of originalPhotoIds) {
            if (!currentServerPhotoIds.includes(photoId)) return true;
        }
        
        if (currentData.tempUploadIds && currentData.tempUploadIds.length > 0) return true;
        
        if (window.photoWasDeleted) return true;
        
        return false;
    }

    async submitForm() {
        const data = this.collectFormData();
        const validationError = this.validateForm(data);
        if (validationError) {
            showTempMessage(validationError, 'error');
            return;
        }

        if (this.editingOrderId && this.originalOrderData) {
            if (!this.hasFormDataChanged(this.originalOrderData, data)) {
                showTempMessage('Нет изменений для сохранения', 'info');
                setTimeout(() => {
                    window.location.href = `view-order.html?id=${this.editingOrderId}`;
                }, 1500);
                return;
            }
        }

        try {
            await this.handleOrderCreation(data);
        } catch (error) {
            // Ошибка уже обработана в handleOrderCreation
        }
    }

    // ===== WORK ITEMS METHODS =====

    addWorkItemRow(data = {}, isDistance = false) {
        if (!this.workItemsTable) return;

        // Защита: если это расстояние, проверяем что нет другой строки с расстоянием
        if (data.workDescription === 'Расстояние' || isDistance) {
            const existingDistanceRow = this.workItemsTable.querySelector('tr[data-distance="true"]');
            if (existingDistanceRow) {
                console.warn('Попытка создать дубль строки "Расстояние" - отклонено');
                
                // Обновляем существующую строку
                const quantityInput = existingDistanceRow.querySelector('input[name="quantity"]');
                const noteInput = existingDistanceRow.querySelector('input[name="note"]');
                const priceInput = existingDistanceRow.querySelector('input[name="price"]');
                
                if (quantityInput && data.quantity !== undefined) quantityInput.value = data.quantity;
                if (noteInput && data.note !== undefined) noteInput.value = data.note;
                if (priceInput && data.price !== undefined) priceInput.value = data.price;
                
                this.calculateTotalPrice();
                return;
            }
        }

        const row = this.workItemsTable.insertRow();
        
        // Устанавливаем data-атрибут для строки расстояния
        if (data.workDescription === 'Расстояние' || isDistance) {
            row.setAttribute('data-distance', 'true');
        }
        
        // Ячейка 1: Описание работы
        const cell1 = row.insertCell();
        
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'workItemId';
        hiddenInput.value = data.id || '';
        
        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.name = 'workDescription';
        descInput.value = data.workDescription || '';
        descInput.placeholder = 'Описание работы';
        descInput.className = 'work-description-input';
        
        cell1.appendChild(hiddenInput);
        cell1.appendChild(descInput);
        
        // Ячейка 2: Цена
        const cell2 = row.insertCell();
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.name = 'price';
        priceInput.value = data.price || '';
        priceInput.min = '0';
        priceInput.step = '0.01';
        priceInput.placeholder = 'Цена за метр';
        priceInput.className = 'no-spinners price-input';
        cell2.appendChild(priceInput);
        
        // Ячейка 3: Количество (метры)
        const cell3 = row.insertCell();
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.name = 'quantity';
        quantityInput.value = data.quantity || 1;
        quantityInput.min = '0';
        quantityInput.step = '1';
        quantityInput.placeholder = 'Метры';
        quantityInput.className = 'quantity-input';
        cell3.appendChild(quantityInput);
        
        // Ячейка 4: Примечание
        const cell4 = row.insertCell();
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.name = 'note';
        noteInput.value = data.note || '';
        noteInput.placeholder = 'Примечание';
        noteInput.className = 'note-input';
        cell4.appendChild(noteInput);
        
        // Ячейка 5: Кнопка удаления
        const cell5 = row.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger btn-sm remove-row';
        deleteBtn.textContent = 'Удалить';
        
        // Не даём удалять строку с расстоянием
        if (data.workDescription === 'Расстояние' || isDistance) {
            deleteBtn.disabled = true;
            deleteBtn.style.opacity = '0.5';
            deleteBtn.title = 'Строка расстояния обязательна';
        }
        
        cell5.appendChild(deleteBtn);

        // Обработчики событий
        [descInput, priceInput, quantityInput, noteInput].forEach(input => {
            input.addEventListener('input', () => this.calculateTotalPrice());
            input.addEventListener('change', () => this.calculateTotalPrice());
        });

        deleteBtn.addEventListener('click', () => {
            if (descInput.value === 'Расстояние' || row.hasAttribute('data-distance')) {
                alert('Строка "Расстояние" обязательна и не может быть удалена');
                return;
            }
            row.remove();
            this.calculateTotalPrice();
        });

        this.calculateTotalPrice();
    }

    renderWorkItemsTable(items) {
        if (!this.workItemsTable) return;
        this.workItemsTable.innerHTML = '';
        (items || []).forEach(item => this.addWorkItemRow(item));
        this.setupWorkItemsTableEvents();
        this.calculateTotalPrice();
    }

    setupWorkItemsTableEvents() {
        if (!this.workItemsTable) return;

        this.workItemsTable.addEventListener('input', (e) => {
            if (e.target.matches('input[name="workDescription"], input[name="price"], input[name="quantity"], input[name="note"]')) {
                this.calculateTotalPrice();
            }
        });

        this.workItemsTable.addEventListener('change', (e) => {
            if (e.target.matches('input[name="price"], input[name="quantity"]')) {
                this.calculateTotalPrice();
            }
        });
    }

    collectWorkItems() {
        if (!this.workItemsTable) return [];
        
        const rows = this.workItemsTable.querySelectorAll('tr');
        const workItemsMap = new Map();
        let distanceRowProcessed = false;
        
        rows.forEach(row => {
            const idEl = row.querySelector('[name="workItemId"]');
            const descriptionEl = row.querySelector('[name="workDescription"]');
            const priceEl = row.querySelector('[name="price"]');
            const quantityEl = row.querySelector('[name="quantity"]');
            const noteEl = row.querySelector('[name="note"]');
            
            const id = idEl ? parseInt(idEl.value) || 0 : 0;
            const workDescription = (descriptionEl ? descriptionEl.value : '').trim();
            
            // Пропускаем пустые строки
            if (!workDescription) return;
            
            let price = 0;
            if (priceEl) {
                price = parseFloat(priceEl.value.replace(',', '.')) || 0;
            }
            
            let quantity = 1;
            if (quantityEl) {
                quantity = parseFloat(quantityEl.value.replace(',', '.')) || 1;
            }
            
            const note = (noteEl ? noteEl.value : '').trim();
            
            // ОСОБАЯ ОБРАБОТКА ДЛЯ РАССТОЯНИЯ
            if (workDescription === 'Расстояние') {
                // Берём ТОЛЬКО строку с data-distance="true"
                if (row.hasAttribute('data-distance')) {
                    if (!distanceRowProcessed) {
                        workItemsMap.set('Расстояние', {
                            id: id,
                            workDescription,
                            price,
                            quantity: Math.round(quantity),
                            note
                        });
                        distanceRowProcessed = true;
                    } else {
                        console.warn('Найдена вторая строка расстояния с data-distance - пропускаем');
                    }
                } else {
                    console.warn('Найдена строка расстояния без data-distance - игнорируем');
                }
            } else {
                // Для других работ используем описание как ключ (последняя побеждает)
                workItemsMap.set(workDescription, {
                    id: id,
                    workDescription,
                    price,
                    quantity: Math.round(quantity),
                    note
                });
            }
        });
        
        const workItems = Array.from(workItemsMap.values());
        return workItems;
    }

    // ===== PAYMENTS METHODS =====

    addPaymentRow(data = {}, isAdditionalPayment = false) {
        if (!this.paymentsTable) return;

        const today = getTodayDate();
        let paymentDateValue = data.paymentDate || today;
        if (paymentDateValue && paymentDateValue.includes('T')) {
            paymentDateValue = paymentDateValue.split('T')[0];
        }
        
        let paymentType = data.paymentType;
        if (!paymentType) {
            paymentType = isAdditionalPayment ? 'Доплата' : 'Аванс';
        }

        const row = this.paymentsTable.insertRow();
        
        // Ячейка 1: Тип платежа
        const cell1 = row.insertCell();
        
        const hiddenId = document.createElement('input');
        hiddenId.type = 'hidden';
        hiddenId.name = 'paymentId';
        hiddenId.value = data.id || '';
        
        const typeDisplay = document.createElement('input');
        typeDisplay.type = 'text';
        typeDisplay.name = 'paymentTypeDisplay';
        typeDisplay.value = paymentType;
        typeDisplay.className = 'form-control';
        typeDisplay.readOnly = true;
        typeDisplay.style.backgroundColor = '#f8f9fa';
        
        const hiddenType = document.createElement('input');
        hiddenType.type = 'hidden';
        hiddenType.name = 'paymentType';
        hiddenType.value = paymentType;
        
        cell1.appendChild(hiddenId);
        cell1.appendChild(typeDisplay);
        cell1.appendChild(hiddenType);
        
        // Ячейка 2: Сумма
        const cell2 = row.insertCell();
        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.name = 'amount';
        amountInput.value = data.amount || '';
        amountInput.min = '0';
        amountInput.step = '0.01';
        amountInput.placeholder = '0.00';
        amountInput.className = 'form-control no-spinners';
        cell2.appendChild(amountInput);
        
        // Ячейка 3: Дата платежа
        const cell3 = row.insertCell();
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.name = 'paymentDate';
        dateInput.value = paymentDateValue;
        dateInput.className = 'form-control';
        cell3.appendChild(dateInput);
        
        // Ячейка 4: Примечание
        const cell4 = row.insertCell();
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.name = 'note';
        noteInput.value = data.note || '';
        noteInput.placeholder = 'Примечание';
        noteInput.className = 'form-control';
        cell4.appendChild(noteInput);
        
        // Ячейка 5: Действия
        const cell5 = row.insertCell();
        
        if (isAdditionalPayment) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn-danger btn-sm remove-row';
            deleteBtn.textContent = 'Удалить';
            cell5.appendChild(deleteBtn);
            
            deleteBtn.addEventListener('click', () => {
                row.remove();
            });
        } else {
            const span = document.createElement('span');
            span.className = 'text-muted';
            span.textContent = 'Основной';
            cell5.appendChild(span);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderPaymentsTable(payments) {
        if (!this.paymentsTable) {
            console.error('Таблица платежей не найдена!');
            return;
        }
        
        this.paymentsTable.innerHTML = '';
        
        if (payments && payments.length > 0) {
            payments.forEach((payment, index) => {
                const isAdditionalPayment = index > 0;
                this.addPaymentRow(payment, isAdditionalPayment);
            });
        } else {
            this.addPaymentRow({}, false);
        }
    }

    initializePayments() {
        if (!this.paymentsTable) return;
        
        this.paymentsTable.innerHTML = '';
        this.addPaymentRow({}, false);
        
        if (this.addPaymentBtn) {
            this.addPaymentBtn.textContent = 'Добавить доплату';
            this.addPaymentBtn.title = 'Добавить дополнительный платеж';
        }
    }

    addAdditionalPayment() {
        this.addPaymentRow({}, true);
    }

    collectPayments() {
        if (!this.paymentsTable) return [];
        
        const rows = this.paymentsTable.querySelectorAll('tr');
        const payments = [];
        
        rows.forEach(row => {
            const typeInput = row.querySelector('input[name="paymentType"]');
            const amountInput = row.querySelector('[name="amount"]');
            const dateInput = row.querySelector('[name="paymentDate"]');
            const noteInput = row.querySelector('[name="note"]');
            
            const paymentType = typeInput ? typeInput.value : 'Аванс';
            const amount = amountInput ? parseFloat(amountInput.value) || 0 : 0;
            const paymentDate = dateInput ? dateInput.value : getTodayDate();
            const note = noteInput ? noteInput.value.trim() : '';
            
            let isoDate;
            try {
                isoDate = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
            } catch {
                isoDate = new Date().toISOString();
            }
            
            payments.push({
                paymentType: paymentType,
                amount: amount,
                paymentDate: isoDate,
                note: note || ""
            });
        });
        
        return payments;
    }

    // ===== UTILITY METHODS =====

    calculateTotalPrice() {
        const items = this.collectWorkItems() || [];
        
        // Считаем общую сумму
        let total = items.reduce((sum, wi) => {
            const price = wi.price || 0;        // цена за метр
            const quantity = wi.quantity || 1;   // количество метров
            
            // Для расстояния: цена за метр × количество метров
            // Для других работ: цена × количество
            const itemTotal = price * quantity;
            
            return sum + itemTotal;
        }, 0);
        
        // Округляем до копеек
        total = Math.round(total * 100) / 100;
        
        if (isNaN(total)) total = 0;
        
        
        // Обновляем скрытое поле
        if (this.totalPriceInput) {
            this.totalPriceInput.value = total.toFixed(2);
        }
        
        // Обновляем отображение
        if (this.totalPriceDisplay) {
            this.totalPriceDisplay.textContent = new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(total);
        }
        
        return total;
    }

    validateWorkItems(items) {
        // ИЗМЕНЕНО: Проверяем, что items существует и это массив
        if (!items || !Array.isArray(items)) {
            return 'Некорректные данные работ';
        }
        
        for (let i = 0; i < items.length; i++) {
            const wi = items[i];
            if (!wi.workDescription || wi.workDescription.trim() === '') {
                return `Работа #${i + 1}: описание обязательно`;
            }
            if (wi.price <= 0) {
                return `Работа #${i + 1}: стоимость должна быть больше 0`;
            }
            if (wi.quantity < 1) {
                return `Работа #${i + 1}: количество должно быть не менее 1`;
            }
        }
        
        return null;
    }

    // Cleanup
    destroy() {
        document.querySelectorAll('.photo-img').forEach(img => {
            if (img.src && img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src);
            }
        });
        
        // НОВОЕ: Очищаем временные файлы
        this.performCleanup();
    }
}

// Инициализация через PageManager
document.addEventListener('DOMContentLoaded', () => {
    PageManager.initialize('create-order', async () => {
        const createOrderManager = new CreateOrderManager(PageManager);
        await createOrderManager.initialize();

        
        // Сохраняем ссылку для возможного доступа извне
        window.createOrderManager = createOrderManager;
    });
});

// Cleanup при выходе
window.addEventListener('beforeunload', () => {
    if (window.createOrderManager) {
        window.createOrderManager.destroy();
    }

});

// Глобальные функции для legacy HTML
window.addWorkItemRow = function() {
    if (window.createOrderManager) window.createOrderManager.addWorkItemRow();
};

window.addPaymentRow = function() {
    if (window.createOrderManager) window.createOrderManager.addAdditionalPayment();
};

window.calculateTotalPrice = function() {
    if (window.createOrderManager) window.createOrderManager.calculateTotalPrice();
};

window.removeRow = function(btn) { 
    btn.closest('tr').remove(); 
    if (window.createOrderManager) window.createOrderManager.calculateTotalPrice();
};

window.removeTempPhotoGlobal = function(tempId) {
    if (window.createOrderManager && window.createOrderManager.handleTempPhotoRemoval) {
        window.createOrderManager.handleTempPhotoRemoval(tempId);
    } else {
        // Fallback для обратной совместимости
        removeTempPhoto(tempId);
    }
};