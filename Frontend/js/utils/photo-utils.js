import { showTempMessage, escapeHtml, formatDate, formatFileSize } from '../utils/utils.js';
import { apiService } from '../api/api.js';
import { ModalUtils } from '../utils/modal-utils.js';

export let tempUploads = []; // @deprecated - используйте draftChanges.tempPhotoIds/tempVideoIds
let activeBlobUrls = [];

const TEMP_STORAGE_KEY = 'tempPhotos_createOrder';

/**
 * Валидация URL для предотвращения XSS
 */
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    // Разрешаем только безопасные URL для изображений
    if (url.startsWith('blob:') || 
        url.startsWith('data:image/') ||
        url.startsWith('/api/Photos/')) {
        return url;
    }
    
    // Блокируем потенциально опасные URL
    if (url.includes('javascript:') || 
        url.includes('vbscript:') ||
        url.includes('data:text/html')) {
        console.warn('Blocked potentially dangerous URL:', url);
        return '';
    }
    
    return url;
}

/**
 * НОВАЯ ФУНКЦИЯ: Рендеринг существующих медиа (фото и видео) при редактировании
 */
export async function renderExistingMedia(photos, videos, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = ''; // Очищаем контейнер
    
    const { mode = 'view', orderManager } = options;
    
    // 1. РЕНДЕРИМ ФОТО
    for (const photo of photos) {
        try {
            const imageUrl = await apiService.getMediaUrl(photo.id);
            const mediaItem = document.createElement('div');
            mediaItem.className = 'media-item';
            mediaItem.dataset.mediaId = photo.id;
            mediaItem.dataset.mediaType = 'photo';
            mediaItem.dataset.mediaTypeCode = '0';
            
            mediaItem.innerHTML = `
                <div class="media-container">
                    <img src="${sanitizeUrl(imageUrl)}"
                        alt="${escapeHtml(photo.originalFileName || 'Фото')}"
                        class="media-img"
                        loading="lazy">
                    ${mode === 'edit' ? '<button class="media-remove-existing" title="Пометить на удаление">✖</button>' : ''}
                </div>
                <div class="media-info">
                    <div class="media-name">${escapeHtml(photo.originalFileName || 'Фото')}</div>
                    <div class="media-meta">
                        ${formatDate(photo.uploadedAt)} | ${formatFileSize(photo.size)}
                        <span class="media-badge photo">Фото</span>
                    </div>
                </div>
            `;
            
            container.appendChild(mediaItem);
            
        } catch (error) {
            console.error('Error loading photo:', error);
        }
    }
    
    // 2. РЕНДЕРИМ ВИДЕО
    for (const video of videos) {
        try {
            // Для видео показываем иконку
            const mediaItem = document.createElement('div');
            mediaItem.className = 'media-item';
            mediaItem.dataset.mediaId = video.id;
            mediaItem.dataset.mediaType = 'video';
            mediaItem.dataset.mediaTypeCode = '1';
            
            mediaItem.innerHTML = `
                <div class="media-container">
                    <div class="video-preview">
                        <div class="video-icon">▶</div>
                        <span class="video-label">Видео</span>
                    </div>
                    ${mode === 'edit' ? '<button class="media-remove-existing" title="Пометить на удаление">✖</button>' : ''}
                </div>
                <div class="media-info">
                    <div class="media-name">${escapeHtml(video.originalFileName || 'Видео')}</div>
                    <div class="media-meta">
                        ${formatDate(video.uploadedAt)} | ${formatFileSize(video.size)}
                        <span class="media-badge video">Видео</span>
                    </div>
                </div>
            `;
            
            container.appendChild(mediaItem);
            
        } catch (error) {
            console.error('Error loading video:', error);
        }
    }
    
    // 3. НАВЕШИВАЕМ ОБРАБОТЧИКИ ДЛЯ РЕЖИМА РЕДАКТИРОВАНИЯ
    if (mode === 'edit' && orderManager) {
        container.querySelectorAll('.media-remove-existing').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const mediaItem = e.target.closest('.media-item');
                const mediaId = parseInt(mediaItem.dataset.mediaId);
                const mediaType = mediaItem.dataset.mediaType; // 'photo' или 'video'
                const mediaTypeCode = parseInt(mediaItem.dataset.mediaTypeCode);
                
                // Подтверждение
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
                    btn.textContent = '✓';
                    btn.title = 'Будет удалено';
                    btn.disabled = true;
                    
                    // Добавляем ID в соответствующий массив removed
                    if (mediaType === 'photo') {
                        if (!orderManager.draftChanges.removedPhotoIds.includes(mediaId)) {
                            orderManager.draftChanges.removedPhotoIds.push(mediaId);
                        }
                    } else {
                        if (!orderManager.draftChanges.removedVideoIds.includes(mediaId)) {
                            orderManager.draftChanges.removedVideoIds.push(mediaId);
                        }
                    }
                }
            });
        });
    }
}

/**
 * НОВАЯ ФУНКЦИЯ: Открытие видео в модальном окне
 */
export async function openVideoPreview(mediaId, fileName, orderNumber = null, isTemp = false) {
    try {        
        let videoUrl;
        
        // ИСПРАВЛЕНО: получаем токен из apiService
        const { apiService } = await import('../api/api.js');
        const token = apiService.token;
        
        if (isTemp) {
            // Для временного видео используем специальный эндпоинт temp-preview
            console.log('[VideoPreview] Загрузка временного видео:', mediaId);
            
            try {
                // Способ 1: через apiService
                videoUrl = await apiService.getTempMediaPreview(mediaId);
            } catch (error) {
                console.warn('[VideoPreview] getTempMediaPreview failed, trying direct fetch:', error);
                
                // Способ 2: прямой fetch
                const response = await fetch(`/api/media/temp-preview/${mediaId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to load temp video: ${response.status}`);
                }
                
                const blob = await response.blob();
                videoUrl = URL.createObjectURL(blob);
            }
        } else {
            // Для существующего видео используем прямой URL с авторизацией
            console.log('[VideoPreview] Загрузка существующего видео:', mediaId);
            
            const response = await fetch(`/api/media/${mediaId}/file`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load video: ${response.status}`);
            }
            
            const blob = await response.blob();
            videoUrl = URL.createObjectURL(blob);
        }
        
        // Создаем модальное окно (код остается без изменений)
        const modal = document.createElement('div');
        modal.className = 'video-modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        modal.innerHTML = `
            <div class="video-modal-content" style="
                position: relative;
                width: 90%;
                max-width: 1000px;
                max-height: 90vh;
                background: #000;
                border-radius: 12px;
                overflow: hidden;
                transform: scale(0.9);
                transition: transform 0.3s ease;
            ">
                <div class="video-modal-header" style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    padding: 16px;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                ">
                    <h3 style="margin: 0; font-size: 16px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;">
                        ${escapeHtml(fileName)}
                        ${isTemp ? '<span style="margin-left: 8px; color: #ffd700;">(временное)</span>' : ''}
                        ${orderNumber ? `<span style="margin-left: 8px; color: #ffd700;">(Заказ #${orderNumber})</span>` : ''}
                    </h3>
                    <button class="video-modal-close" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        transition: background 0.2s;
                    ">✕</button>
                </div>
                
                <div class="video-modal-body" style="
                    width: 100%;
                    height: 100%;
                    min-height: 500px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000;
                ">
                    <video controls autoplay style="
                        width: 100%;
                        height: auto;
                        max-height: calc(90vh - 80px);
                        outline: none;
                    ">
                        <source src="${videoUrl}" type="video/mp4">
                        Ваш браузер не поддерживает видео.
                    </video>
                </div>
                
                <div class="video-modal-footer" style="
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    padding: 12px 16px;
                    background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
                    color: rgba(255,255,255,0.6);
                    font-size: 14px;
                    text-align: center;
                    z-index: 10;
                ">
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Анимация появления
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('.video-modal-content').style.transform = 'scale(1)';
        }, 10);
        
        // Функция закрытия
        const closeModal = () => {
            modal.style.opacity = '0';
            modal.querySelector('.video-modal-content').style.transform = 'scale(0.9)';
            
            const video = modal.querySelector('video');
            if (video) {
                video.pause();
                video.src = '';
                video.load();
            }
            
            setTimeout(() => {
                document.body.removeChild(modal);
                // Очищаем blob URL если он был создан
                if (videoUrl && videoUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(videoUrl);
                }
            }, 300);
            
            document.removeEventListener('keydown', handleKeydown);
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        
        modal.querySelector('.video-modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', handleKeydown);
        
        const video = modal.querySelector('video');
        video.addEventListener('click', (e) => e.stopPropagation());
        
    } catch (error) {
        console.error('[VideoPreview] Error loading video:', error);
        
        // Показываем понятную ошибку пользователю
        let errorMessage = 'Ошибка загрузки видео';
        if (error.message.includes('404')) {
            errorMessage = 'Видео не найдено. Возможно, временный файл истек.';
        } else if (error.message.includes('401')) {
            errorMessage = 'Нет доступа к видео. Требуется авторизация.';
        } else {
            errorMessage = error.message;
        }
        
        showTempMessage(errorMessage, 'error', 5000);
    }
}

export function cleanupPhotoBlobs() {
    activeBlobUrls.forEach(url => {
        URL.revokeObjectURL(url);
    });
    activeBlobUrls = [];
}

/**
 * Настройка drag & drop для области загрузки фото
 */
export function setupDragAndDrop(uploadAreaId, uploadCallback) {
    const uploadArea = document.getElementById(uploadAreaId);
    if (!uploadArea) return;
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files, uploadCallback);
    });
}

// Загрузка temp с cleanup при init
export async function loadAndCleanupTemp() {
    const storedIds = JSON.parse(localStorage.getItem(TEMP_STORAGE_KEY) || '[]');
    if (storedIds.length > 0) {
        // Удаляем старые temp (если не коммитнуты)
        for (const id of storedIds) {
            try {
                await apiService.deleteTempPhoto(id);
            } catch (error) {
                console.warn('Cleanup failed for temp', id, error);
            }
        }
        localStorage.removeItem(TEMP_STORAGE_KEY);
    }
    tempUploads = [];  // Очистка массива
}

/**
 * Обработка выбора файлов через input
 */
export function handlePhotoSelect(e, uploadCallback) {
    handleFiles(e.target.files, uploadCallback);
    e.target.value = '';
}

/**
 * Создаёт DOM-элемент превью для одного медиа-файла (фото или видео)
 * @param {File} file - загруженный файл
 * @param {string|number} tempId - временный идентификатор
 * @param {'photo'|'video'} type - тип медиа
 * @param {Function} [onRemove] - опциональная callback-функция удаления
 * @returns {Promise<HTMLElement>} готовый элемент .media-item
 */
export async function createMediaPreviewItem(file, tempId, type, onRemove = null) {
    const item = document.createElement('div');
    item.className = 'media-item';
    item.dataset.tempId = tempId;
    item.dataset.mediaType = type;
    item.dataset.mediaTypeCode = type === 'video' ? '1' : '0';

    // Контейнер превью (должен быть position: relative в CSS)
    const container = document.createElement('div');
    container.className = 'media-container';

    if (type === 'photo') {
        // ФОТО
        const img = document.createElement('img');
        img.className = 'media-img';
        img.alt = `Фото: ${escapeHtml(file.name)}`;
        img.src = URL.createObjectURL(file);
        img.loading = 'lazy';
        container.appendChild(img);
        
    } else {
        // ВИДЕО
        try {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.preload = 'metadata';
            video.muted = true;
            
            const canvas = document.createElement('canvas');
            canvas.className = 'media-canvas';
            
            await new Promise((resolve, reject) => {
                video.onloadedmetadata = () => {
                    video.currentTime = Math.min(0.5, video.duration || 0.5);
                };
                video.onseeked = () => {
                    canvas.width = video.videoWidth || 300;
                    canvas.height = video.videoHeight || 200;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(video.src);
                    video.remove();
                    resolve();
                };
                video.onerror = reject;
            });
            
            container.appendChild(canvas);
        } catch (err) {
            console.warn('[createMediaPreviewItem] Не удалось извлечь кадр видео:', err);
            const placeholder = document.createElement('div');
            placeholder.className = 'video-placeholder';
            placeholder.innerHTML = '<div class="video-label">Видео</div>';
            container.appendChild(placeholder);
        }
        
        // Оверлей с play-кнопкой
        const overlay = document.createElement('div');
        overlay.className = 'video-play-overlay';
        overlay.innerHTML = '<div class="video-play-icon">▶</div>';
        container.appendChild(overlay);
    }
    
    // ===== БЕЙДЖ ТИПА - ДОБАВЛЯЕМ В КОНТЕЙНЕР, А НЕ В ITEM =====
    const badge = document.createElement('div');
    badge.className = `media-type-badge ${type}`;
    badge.textContent = type === 'video' ? 'Видео' : 'Фото';
    container.appendChild(badge); // <- В КОНТЕЙНЕР
    
    item.appendChild(container); // Добавляем контейнер в карточку
    
    // Кнопка удаления (добавляется в item, позиционируется абсолютно)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'media-remove';
    removeBtn.innerHTML = '×';
    removeBtn.title = `Удалить ${type === 'video' ? 'видео' : 'фото'}`;
    
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof onRemove === 'function') {
            onRemove(tempId, type);
        }
    });
    
    item.appendChild(removeBtn);

    // Информация (обычный блок под карточкой)
    const info = document.createElement('div');
    info.className = 'media-info';
    info.innerHTML = `
        <div class="media-name" title="${escapeHtml(file.name)}">
            ${escapeHtml(file.name)}
        </div>
        <div class="media-meta">
            <span>${formatFileSize(file.size)}</span>
            <span>${file.lastModified ? new Date(file.lastModified).toLocaleDateString('ru-RU') : ''}</span>
        </div>
    `;
    item.appendChild(info);

    return item;
}

/**
 * Валидация и обработка файлов
 */
async function handleFiles(files, uploadCallback) {
    for (let file of files) {
        if (!file.type.startsWith('image/')) {
            showTempMessage('Пропущен не изображение: ' + file.name, 'error');
            continue;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showTempMessage('Файл слишком большой: ' + file.name, 'error');
            continue;
        }
        
        await uploadCallback(file);
    }
}

/**
 * Загрузка временного фото (УСТАРЕВШАЯ ВЕРСИЯ - для обратной совместимости)
 * @deprecated Используйте uploadTempToDraft вместо этого
 */
export async function uploadTempAndDisplay(file, draftManager = null) {
    console.warn('uploadTempAndDisplay устарела! Используйте uploadTempMediaAndDisplay');
    return uploadTempMediaAndDisplay(file, draftManager, 'photo');
}

/**
 * НОВАЯ ФУНКЦИЯ: Загрузка временного фото с привязкой к draft
 */
export async function uploadTempToDraft(file, draftManager) {
    if (!draftManager || !draftManager.draftChanges) {
        throw new Error('Draft manager required for uploadTempToDraft');
    }
    
    try {
        const photoData = await apiService.uploadTempPhoto(file);
        const tempId = photoData.id;
        const previewUrl = await apiService.getTempPreview(tempId);
        
        const container = document.getElementById('photoPreview');
        if (!container) return null;
        
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.dataset.tempId = tempId;
        
        photoItem.innerHTML = `
            <div class="photo-container">
                <img src="${sanitizeUrl(previewUrl)}"
                    alt="${escapeHtml(file.name)}"
                    class="photo-img">
                <button class="photo-remove" title="Удалить временное фото">✖</button>
            </div>
            <div class="photo-info">
                <div class="photo-name">${escapeHtml(file.name)}</div>
                <div class="photo-meta">${formatDate(new Date())} | ${formatFileSize(file.size)}</div>
            </div>
        `;
        
        container.appendChild(photoItem);
        
        if (draftManager.draftChanges.tempUploadIds.indexOf(tempId) === -1) {
            draftManager.draftChanges.tempUploadIds.push(tempId);
        }
        
        showTempMessage(`Фото "${file.name}" загружено`, 'success');
        return tempId;
    } catch (error) {
        console.error('Upload to draft error:', error);
        showTempMessage('Ошибка загрузки: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Обновленная функция удаления временного фото
 */
export async function removeTempPhoto(tempId, draftManager = null) {
    console.warn('removeTempPhoto устарела! Используйте removeTempMedia');
    return removeTempMedia(tempId, draftManager, 'photo');
}


/**
 * Открытие фото в улучшенном модальном окне
 */
export function openPhotoPreview(imageSrc, fileName, photoId = null, orderNumber = null, photoIndex = null) {
    // Если imageSrc не передан или это невалидный blob, используем photoId
    if ((!imageSrc || (imageSrc.startsWith('blob:') && !URL.canParse?.(imageSrc))) && photoId) {
        // Загружаем фото через API
        loadPhotoById(photoId, fileName, orderNumber, photoIndex);
        return;
    }
    
    // Нормальный случай - показываем модалку с переданным URL
    const modal = document.createElement('div');
    modal.className = 'photo-modal-overlay';
    
    modal.innerHTML = `
        <div class="photo-modal-content">
            <div class="photo-modal-header">
                <h3 class="photo-modal-title">${escapeHtml(fileName)}</h3>
                <button class="photo-modal-close" title="Закрыть (Esc)">✕</button>
            </div>
            
            <div class="photo-modal-body">
                <img src="${sanitizeUrl(imageSrc)}" 
                    alt="${escapeHtml(fileName)}"
                    class="photo-modal-image"
                    onclick="event.stopPropagation()">
            </div>
            
            <div class="photo-modal-footer">
                <div class="photo-modal-info">
                    ${escapeHtml(fileName)}
                </div>
                
                <div class="photo-modal-actions">
                    <button class="photo-modal-download" title="Скачать фото">Скачать</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', handleKeydown);
    };
    
    const handleKeydown = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    
    modal.querySelector('.photo-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', handleKeydown);
    
    modal.querySelector('.photo-modal-download').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            let actualPhotoId = photoId;
            if (!actualPhotoId && imageSrc.includes('/')) {
                const urlParts = imageSrc.split('/');
                actualPhotoId = parseInt(urlParts[urlParts.length - 1]);
            }
            
            if (!actualPhotoId) {
                showTempMessage('Не удалось определить ID фото для скачивания', 'error');
                return;
            }
            
            await downloadPhoto(actualPhotoId, fileName, orderNumber, photoIndex);
        } catch (error) {
            console.error('Download error in modal:', error);
            showTempMessage('Ошибка скачивания: ' + error.message, 'error');
        }
    });
}

// Новая вспомогательная функция
async function loadPhotoById(photoId, fileName, orderNumber, photoIndex) {
    try {
        const { apiService } = await import('../api/api.js');
        const imageUrl = await apiService.getMediaUrl(photoId);
        
        // Вызываем себя же с правильным URL
        openPhotoPreview(imageUrl, fileName, photoId, orderNumber, photoIndex);
    } catch (error) {
        console.error('Error loading photo by ID:', error);
        showTempMessage('Ошибка загрузки фото', 'error');
    }
}

export async function renderPhotoGrid(mediaItems, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    const { mode = 'view', orderNumber, orderManager, onMediaClick } = options;
    
    for (let i = 0; i < mediaItems.length; i++) {
        const media = mediaItems[i];
        const isVideo = media.mediaType === 1;
        const mediaType = isVideo ? 'video' : 'photo';
        
        try {
            // ===== СОЗДАЕМ БАЗОВУЮ СТРУКТУРА КАРТОЧКИ =====
            const item = document.createElement('div');
            item.className = 'media-item';
            
            // Добавляем класс для режима diff если нужно
            if (mode === 'diff' && media._actionType) {
                item.classList.add(media._actionType === 'added' ? 'photo-added' : 'photo-removed');
            }
            
            // data-атрибуты
            if (media.id) item.dataset.mediaId = media.id;
            if (media.tempId) item.dataset.tempId = media.tempId;
            item.dataset.mediaType = mediaType;
            item.dataset.mediaTypeCode = media.mediaType || (isVideo ? 1 : 0);
            if (orderNumber) item.dataset.orderNumber = orderNumber;
            item.dataset.photoIndex = i + 1;
            
            // ===== КОНТЕЙНЕР ПРЕВЬЮ =====
            const previewContainer = document.createElement('div');
            previewContainer.className = 'media-container';
            
            if (isVideo) {
                // Для видео в режиме diff показываем плейсхолдер (не грузим видео)
                if (mode === 'diff') {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'video-placeholder';
                    placeholder.innerHTML = '<div class="video-label">Видео</div>';
                    previewContainer.appendChild(placeholder);
                } else {
                    // Стандартная логика для видео
                    try {
                        const videoUrl = `/api/media/${media.id}/file`;
                        const response = await fetch(videoUrl, {
                            headers: { 'Authorization': `Bearer ${apiService.token}` }
                        });
                        const blob = await response.blob();
                        
                        const video = document.createElement('video');
                        video.src = URL.createObjectURL(blob);
                        video.preload = 'metadata';
                        video.crossOrigin = 'anonymous';
                        
                        const canvas = document.createElement('canvas');
                        canvas.className = 'media-canvas';
                        
                        await new Promise((resolve, reject) => {
                            video.onloadedmetadata = () => {
                                video.currentTime = Math.min(0.5, video.duration || 0.5);
                            };
                            video.onseeked = () => {
                                canvas.width = video.videoWidth || 300;
                                canvas.height = video.videoHeight || 200;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                URL.revokeObjectURL(video.src);
                                video.remove();
                                resolve();
                            };
                            video.onerror = reject;
                        });
                        
                        previewContainer.appendChild(canvas);
                    } catch (error) {
                        console.warn(`Failed to extract frame from video ${media.id}:`, error);
                        const placeholder = document.createElement('div');
                        placeholder.className = 'video-placeholder';
                        placeholder.innerHTML = '<div class="video-label">Видео</div>';
                        previewContainer.appendChild(placeholder);
                    }
                }
                
                // Оверлей с play-кнопкой (кроме режима diff)
                if (mode !== 'diff') {
                    const overlay = document.createElement('div');
                    overlay.className = 'video-play-overlay';
                    overlay.innerHTML = '<div class="video-play-icon">▶</div>';
                    previewContainer.appendChild(overlay);
                }
                
            } else {
                // ФОТО
                try {
                    let imageUrl;
                    if (media.tempId) {
                        imageUrl = await apiService.getTempMediaPreview(media.tempId);
                    } else {
                        imageUrl = await apiService.getMediaUrl(media.id);
                    }
                    
                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.alt = media.originalFileName || 'Фото';
                    img.className = 'media-img';
                    img.loading = 'lazy';
                    previewContainer.appendChild(img);
                } catch (error) {
                    console.error(`Error loading image for media ${media.id}:`, error);
                    previewContainer.innerHTML = `<div class="media-placeholder">Фото</div>`;
                }
            }
            
            // Бейдж типа (всегда)
            const badge = document.createElement('div');
            badge.className = `media-type-badge ${mediaType}`;
            badge.textContent = isVideo ? 'Видео' : 'Фото';
            previewContainer.appendChild(badge);
            
            item.appendChild(previewContainer);
            
            // ===== КНОПКА УДАЛЕНИЯ (только для режимов edit/create) =====
            if (mode === 'edit' || mode === 'create') {
                const removeBtn = document.createElement('button');
                removeBtn.className = media.tempId ? 'media-remove' : 'media-remove-existing';
                removeBtn.innerHTML = '×';
                removeBtn.title = media.tempId ? 'Удалить' : 'Пометить на удаление';
                
                removeBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (media.tempId && orderManager?.handleTempMediaRemoval) {
                        await orderManager.handleTempMediaRemoval(media.tempId, mediaType);
                    } else if (media.id && orderManager?.markExistingMediaForRemoval) {
                        await orderManager.markExistingMediaForRemoval(media.id, mediaType, media.mediaType, item);
                    }
                });
                
                item.appendChild(removeBtn);
            }
            
            // ===== ИНФОРМАЦИЯ ПОД ПРЕВЬЮ =====
            const info = document.createElement('div');
            info.className = 'media-info';
            
            // Для режима diff добавляем информацию о действии
            if (mode === 'diff' && media._actionLabel) {
                info.innerHTML = `
                    <div class="media-name" title="${escapeHtml(media.originalFileName || (isVideo ? 'Видео' : 'Фото'))}">
                        ${escapeHtml(media.originalFileName || (isVideo ? 'Видео' : 'Фото'))}
                    </div>
                    <div class="media-meta">
                        <span class="media-status ${media._actionType}">${media._actionLabel}</span>
                    </div>
                `;
            } else {
                info.innerHTML = `
                    <div class="media-name" title="${escapeHtml(media.originalFileName || (isVideo ? 'Видео' : 'Фото'))}">
                        ${escapeHtml(media.originalFileName || (isVideo ? 'Видео' : 'Фото'))}
                    </div>
                    <div class="media-meta">
                        <span>${formatFileSize(media.size || 0)}</span>
                        <span>${media.uploadedAt ? formatDate(media.uploadedAt) : ''}</span>
                    </div>
                `;
            }
            
            item.appendChild(info);
            
            // ===== ОБРАБОТЧИК КЛИКА ДЛЯ ПРОСМОТРА =====
            item.addEventListener('click', (e) => {
                // Не открываем просмотр при клике на кнопку
                if (e.target.closest('button')) return;
                
                const mediaId = media.id || media.tempId;
                if (!mediaId) return;
                
                const fileName = media.originalFileName || (isVideo ? 'Видео' : 'Фото');
                
                if (onMediaClick) {
                    // Используем переданный колбэк
                    onMediaClick(mediaId, mediaType, fileName, orderNumber, i + 1);
                } else {
                    // Стандартное поведение
                    if (isVideo) {
                        openVideoPreview(mediaId, fileName, orderNumber, !!media.tempId);
                    } else {
                        const img = item.querySelector('img');
                        if (img) {
                            openPhotoPreview(img.src, fileName, mediaId, orderNumber, i + 1);
                        }
                    }
                }
            });
            
            container.appendChild(item);
            
        } catch (error) {
            console.error(`Error creating media item:`, error);
        }
    }
}

// Вспомогательная функция для fallback видео
function createVideoFallbackItem(media, mode) {
    const item = document.createElement('div');
    item.className = 'media-item existing-media';
    item.dataset.mediaId = media.id;
    item.dataset.mediaType = 'video';
    item.dataset.mediaTypeCode = 1;
    
    const container = document.createElement('div');
    container.className = 'media-container';
    container.innerHTML = `
        <div class="video-preview">
            <div class="video-icon">▶</div>
            <span class="video-label">Видео</span>
        </div>
    `;
    
    if (mode === 'edit') {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'media-remove-existing';
        removeBtn.innerHTML = '✖';
        removeBtn.title = 'Пометить на удаление';
        container.appendChild(removeBtn);
    }
    
    item.appendChild(container);
    
    const info = document.createElement('div');
    info.className = 'media-info';
    info.innerHTML = `
        <div class="media-name">${escapeHtml(media.originalFileName || 'Видео')}</div>
        <div class="media-meta">
            ${formatDate(media.uploadedAt)} | ${formatFileSize(media.size)}
            <span class="media-badge video">Видео</span>
        </div>
    `;
    item.appendChild(info);
    
    return item;
}

/**
 * Вспомогательная функция для создания fallback элемента
 */
function createFallbackMediaItem(media, mediaType, mode) {
    const item = document.createElement('div');
    item.className = 'media-item fallback';
    item.dataset.mediaId = media.id || media.tempId;
    item.dataset.mediaType = mediaType;
    
    const isVideo = mediaType === 'video';
    
    item.innerHTML = `
        <div class="media-container">
            <div class="video-placeholder" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div class="video-label">${isVideo ? 'Видео' : 'Фото'}</div>
            </div>
            ${mode === 'edit' ? '<button class="media-remove-existing" title="Пометить на удаление">✖</button>' : ''}
        </div>
        <div class="media-info">
            <div class="media-name">${escapeHtml(media.originalFileName || (isVideo ? 'Видео' : 'Фото'))}</div>
            <div class="media-meta">
                <span>${formatFileSize(media.size || 0)}</span>
                <span>${media.uploadedAt ? formatDate(media.uploadedAt) : ''}</span>
            </div>
        </div>
    `;
    
    return item;
}

/**
 * Вспомогательная функция для обработчиков просмотра
 */
function attachMediaViewHandlers(container) {
    container.addEventListener('click', (e) => {
        // ===== КРИТИЧЕСКИ ВАЖНО: ПРОВЕРЯЕМ, НЕ КЛИКНУЛИ ЛИ ПО КНОПКЕ =====
        if (e.target.closest('button')) {
            console.log('[MediaView] Клик по кнопке, игнорируем просмотр');
            return; // Не открываем просмотр, если кликнули по любой кнопке
        }
        
        const item = e.target.closest('.media-item');
        if (!item) return;
        
        // Дополнительная проверка: если элемент помечен на удаление, не открываем
        if (item.classList.contains('marked-for-deletion')) {
            return;
        }
        
        const mediaId = item.dataset.mediaId;
        const mediaType = item.dataset.mediaType;
        const fileName = item.querySelector('.media-name')?.textContent || 'Файл';
        const orderNumber = item.dataset.orderNumber;
        const photoIndex = item.dataset.photoIndex;
        
        // Проверяем, есть ли у элемента временный ID (значит это новое, незагруженное медиа)
        if (item.dataset.tempId) {
            console.log('[MediaView] Временное медиа, возможно не готово к просмотру');
            // Для временных видео показываем превью, если оно есть
            if (mediaType === 'video') {
                // Пробуем найти canvas или video элемент
                const canvas = item.querySelector('canvas');
                if (canvas) {
                    const dataUrl = canvas.toDataURL('image/jpeg');
                    openPhotoPreview(dataUrl, fileName, null, orderNumber, photoIndex);
                }
            }
            return;
        }
        
        // Открываем просмотр для постоянных медиа
        if (mediaType === 'video') {
            if (typeof openVideoPreview === 'function') {
                console.log('[MediaView] Открываем видео:', mediaId);
                openVideoPreview(mediaId, fileName, orderNumber, false);
            }
        } else {
            const img = item.querySelector('img');
            if (img) {
                console.log('[MediaView] Открываем фото:', mediaId);
                openPhotoPreview(
                    img.src,
                    fileName,
                    mediaId,
                    orderNumber,
                    photoIndex
                );
            } else {
                // Если нет img, пробуем найти canvas
                const canvas = item.querySelector('canvas');
                if (canvas) {
                    const dataUrl = canvas.toDataURL('image/jpeg');
                    openPhotoPreview(
                        dataUrl,
                        fileName,
                        mediaId,
                        orderNumber,
                        photoIndex
                    );
                }
            }
        }
    });
}

/**
 * Удаление привязанного фото в режиме редактирования
 */
export async function markPhotoForDeletion(photoId, photoManager) {
    try {
        // Находим элемент фото
        const photoElement = document.querySelector(`.photo-item[data-photo-id="${photoId}"]`);
        const fileName = photoElement?.querySelector('.photo-name')?.textContent || 'фото';
        
        // ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ
        const confirmed = await ModalUtils.confirm({
            title: 'Удаление фото',
            message: `Вы уверены, что хотите удалить фото "${fileName}"? Фото будет удалено только после сохранения изменений.`,
            confirmText: 'Удалить',
            danger: true
        });
        
        if (!confirmed) return;
        
        // Помечаем фото для удаления визуально
        if (photoElement) {
            photoElement.style.opacity = '0.5';
            photoElement.style.filter = 'grayscale(100%)';
            photoElement.querySelector('.photo-remove-server').textContent = '✓';
            photoElement.querySelector('.photo-remove-server').title = 'Восстановить фото';
            photoElement.classList.add('photo-marked-for-deletion');
        }
        
        if (photoManager && photoManager.draftChanges) {
            // Убираем дубликаты
            const index = photoManager.draftChanges.removedPhotoIds.indexOf(photoId);
            if (index === -1) {
                photoManager.draftChanges.removedPhotoIds.push(photoId);
            }
        }
        
        showTempMessage('Фото помечено для удаления. Изменения сохранятся после нажатия "Сохранить изменения"', 'info');
        
    } catch (error) {
        console.error('Mark photo for deletion error:', error);
        showTempMessage('Ошибка при пометке фото для удаления', 'error');
    }
}

export function restorePhotoFromDeletion(photoId, photoManager) {
    const photoElement = document.querySelector(`.photo-item[data-photo-id="${photoId}"]`);
    
    if (photoElement) {
        photoElement.style.opacity = '1';
        photoElement.style.filter = 'none';
        photoElement.querySelector('.photo-remove-server').textContent = '✖';
        photoElement.querySelector('.photo-remove-server').title = 'Удалить фото из заказа';
        photoElement.classList.remove('photo-marked-for-deletion');
    }
    
    if (photoManager && photoManager.draftChanges) {
        const index = photoManager.draftChanges.removedPhotoIds.indexOf(photoId);
        if (index > -1) {
            photoManager.draftChanges.removedPhotoIds.splice(index, 1);
        }
    }
    
    showTempMessage('Фото восстановлено', 'success');
}

/**
 * Получение ID всех временных фото для коммита
 */
export function getTempPhotoIds() {
    return [...tempUploads];  // Копия массива
}

/**
 * Очистка временных фото после коммита
 */
tempUploads = [];
    const previewContainer = document.getElementById('photoPreview');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }

// Вспомогательные функции
export function clearTempPhotos() {
    tempUploads = [];
    const previewContainer = document.getElementById('photoPreview');
    if (previewContainer) previewContainer.innerHTML = '';
    localStorage.removeItem(TEMP_STORAGE_KEY);  // Фикс: Очистка storage
}

/**
 * Event delegation  (убрал onclick, используй в create-order)
 */
export function attachMediaEvents(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const { mode = 'view', orderNumber, photoManager } = options;
    
    container.addEventListener('click', async (e) => {
        e.preventDefault();
        const mediaItem = e.target.closest('.media-item') || e.target.closest('.photo-item');
        if (!mediaItem) return;
        
        // Обработчик для кнопки удаления временных файлов
        if (e.target.classList.contains('media-remove') || e.target.classList.contains('photo-remove')) {
            e.stopPropagation();
            const tempId = mediaItem.dataset.tempId;
            if (tempId) {
                const mediaType = mediaItem.dataset.mediaType;
                if (photoManager && typeof photoManager.handleTempMediaRemoval === 'function') {
                    await photoManager.handleTempMediaRemoval(tempId, mediaType);
                } else {
                    await removeTempMedia(tempId, null, mediaType);
                }
            }
            return;
        }
        
        // Просмотр медиа
        const imgElement = mediaItem.querySelector('.media-img') || mediaItem.querySelector('.photo-img');
        if (imgElement?.src) {
            const imageUrl = imgElement.src;
            const fileName = imgElement.alt || 'Файл';
            openPhotoPreview(imageUrl, fileName); // Базовый просмотр
        }
    });
}

async function downloadPhoto(photoId, fileName, orderNumber = null, photoIndex = null) {
    try {
        
        let finalFileName = fileName;
        
        // Формируем имя файла по шаблону Order_123_1.jpg
        if (orderNumber && photoIndex) {
            const extension = fileName ? fileName.split('.').pop() : 'jpg';
            finalFileName = `Order_${orderNumber}_${photoIndex}.${extension}`;
        }
        
        await apiService.downloadPhoto(photoId, finalFileName);
        
        showTempMessage(`Скачано: ${escapeHtml(finalFileName)}`, 'success');
    } catch (error) {
        console.error('Download error details:', error);
        console.error('Error stack:', error.stack);
        showTempMessage('Ошибка скачивания: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Загрузка временного медиафайла с правильным разделением по типам
 * @param {File} file - загружаемый файл
 * @param {CreateOrderManager} orderManager - менеджер заказа (содержит draftChanges)
 * @param {string} mediaType - 'photo' или 'video' (если не указан, определяется автоматически)
 * @returns {Promise<{id: number, type: string}>}
 */
export async function uploadTempMediaAndDisplay(file, orderManager = null, mediaType = null) {
    try {
        // 1. ОПРЕДЕЛЯЕМ ТИП МЕДИА
        const finalMediaType = mediaType || determineMediaType(file);
        
        // 2. ЗАГРУЗКА ЧЕРЕЗ ЕДИНЫЙ API МЕТОД
        const mediaData = await apiService.uploadTempMedia(file, finalMediaType);
        const tempId = mediaData.id;
        
        // 3. ПОЛУЧАЕМ ПРЕВЬЮ (для фото или видео)
        const previewUrl = await apiService.getTempMediaPreview(tempId);
        
        // 4. НАХОДИМ КОНТЕЙНЕР ДЛЯ ПРЕВЬЮ
        const container = document.getElementById('mediaPreview');
        if (!container) {
            console.error('[MediaUpload] Контейнер mediaPreview не найден');
            return { id: tempId, type: finalMediaType };
        }
        
        // 5. СОЗДАЕМ ЭЛЕМЕНТ ДЛЯ ОТОБРАЖЕНИЯ
        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item';
        mediaItem.dataset.tempId = tempId;
        mediaItem.dataset.mediaType = finalMediaType;
        
        // Разное отображение для фото и видео
        const isVideo = finalMediaType === 'video';
        const previewHtml = isVideo ? 
            `<div class="video-preview">
                <div class="video-icon">▶</div>
                <span class="video-label">Видео</span>
            </div>` :
            `<img src="${sanitizeUrl(previewUrl)}"
                alt="${escapeHtml(file.name)}"
                class="media-img"
                loading="lazy">`;
        
        mediaItem.innerHTML = `
            <div class="media-container">
                ${previewHtml}
                <button class="media-remove" title="Удалить временный файл">✖</button>
            </div>
            <div class="media-info">
                <div class="media-name">${escapeHtml(file.name)}</div>
                <div class="media-meta">
                    ${formatDate(new Date())} | ${formatFileSize(file.size)}
                    <span class="media-badge ${finalMediaType}">${finalMediaType === 'photo' ? 'Фото' : 'Видео'}</span>
                </div>
            </div>
        `;
        
        container.appendChild(mediaItem);
        
        // 6. СОХРАНЯЕМ В ПРАВИЛЬНЫЕ МАССИВЫ (КРИТИЧЕСКИ ВАЖНО!)
        if (orderManager && orderManager.draftChanges) {
            if (finalMediaType === 'photo') {
                // Добавляем в массив для фото
                if (!orderManager.draftChanges.tempPhotoIds.includes(tempId)) {
                    orderManager.draftChanges.tempPhotoIds.push(tempId);
                }
            } else if (finalMediaType === 'video') {
                // Добавляем в массив для видео
                if (!orderManager.draftChanges.tempVideoIds.includes(tempId)) {
                    orderManager.draftChanges.tempVideoIds.push(tempId);
                }
            }
            
            // Для обратной совместимости, но скоро удалим
            if (!orderManager.draftChanges.tempUploadIds.includes(tempId)) {
                orderManager.draftChanges.tempUploadIds.push(tempId);
            }
        }
        
        // 7. УСПЕХ
        showTempMessage(`${finalMediaType === 'photo' ? 'Фото' : 'Видео'} "${file.name}" загружено`, 'success');
        return { id: tempId, type: finalMediaType };
        
    } catch (error) {
        console.error('[MediaUpload] Ошибка загрузки:', {
            fileName: file.name,
            fileType: file.type,
            error: error.message,
            stack: error.stack
        });
        
        let errorMessage = 'Ошибка загрузки';
        if (error.message.includes('too large')) {
            errorMessage = 'Файл слишком большой (макс 500MB)';
        } else if (error.message.includes('type')) {
            errorMessage = 'Неподдерживаемый тип файла';
        } else {
            errorMessage = error.message;
        }
        
        showTempMessage(errorMessage, 'error');
        throw error;
    }
}

/**
 * НОВАЯ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Определение типа медиа по MIME-типу
 */
function determineMediaType(file) {
    if (file.type.startsWith('image/')) return 'photo';
    if (file.type.startsWith('video/')) return 'video';
    
    // По расширению, если MIME не определился
    const ext = file.name.split('.').pop()?.toLowerCase();
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic', 'heif'];
    
    if (videoExts.includes(ext)) return 'video';
    if (imageExts.includes(ext)) return 'photo';
    
    // По умолчанию считаем фото (безопасно)
    console.warn(`[MediaUpload] Не удалось определить тип файла ${file.name}, считаем фото`);
    return 'photo';
}

/**
 * НОВАЯ: Обработка файлов с разделением по типу
 */
async function handleMediaFiles(files, uploadCallback) {
    for (let file of files) {
        // Проверяем тип файла
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        if (!isImage && !isVideo) {
            showTempMessage('Пропущен неподдерживаемый файл: ' + file.name, 'error');
            continue;
        }
        
        if (file.size > 500 * 1024 * 1024) {
            showTempMessage('Файл слишком большой (макс 500MB): ' + file.name, 'error');
            continue;
        }
        
        await uploadCallback(file);
    }
}

/**
 * Открывает фото по ID (для удаляемых/постоянных фото)
 */
export async function openPhotoPreviewById(photoId, fileName, orderNumber = null, photoIndex = null) {
    try {
        console.log('[PhotoPreviewById] Загрузка фото по ID:', photoId);
        
        const { apiService } = await import('../api/api.js');
        const imageUrl = await apiService.getMediaUrl(photoId);
        
        // Используем существующую функцию с полученным URL
        openPhotoPreview(imageUrl, fileName, photoId, orderNumber, photoIndex);
        
    } catch (error) {
        console.error('[PhotoPreviewById] Error loading photo by ID:', error);
        
        let errorMessage = 'Ошибка загрузки фото';
        if (error.message.includes('404')) {
            errorMessage = 'Фото не найдено';
        } else if (error.message.includes('401')) {
            errorMessage = 'Нет доступа к фото';
        }
        
        // Импортируем showTempMessage если нужно
        const { showTempMessage } = await import('../utils/utils.js');
        showTempMessage(errorMessage, 'error');
    }
}

/**
 * Удаление временного медиафайла
 * @param {number} tempId - ID временного файла
 * @param {CreateOrderManager} orderManager - менеджер заказа
 * @param {string} mediaType - 'photo' или 'video'
 */
export async function removeTempMedia(tempId, orderManager = null, mediaType = null) {
    try {
        // 1. НАХОДИМ ЭЛЕМЕНТ В DOM
        const mediaElement = document.querySelector(`[data-temp-id="${tempId}"]`);
        const fileName = mediaElement?.querySelector('.media-name')?.textContent || 'файл';
        
        // 2. ОПРЕДЕЛЯЕМ ТИП, ЕСЛИ НЕ ПЕРЕДАН
        let finalMediaType = mediaType;
        if (!finalMediaType && mediaElement) {
            finalMediaType = mediaElement.dataset.mediaType;
        }
        
        // 3. ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ
        const confirmed = await ModalUtils.confirm({
            title: 'Удаление файла',
            message: `Вы уверены, что хотите удалить файл "${fileName}"?`,
            confirmText: 'Удалить',
            danger: true
        });
        
        if (!confirmed) return;
        
        // 4. УДАЛЯЕМ ИЗ DOM
        if (mediaElement) {
            mediaElement.remove();
        }
        
        // 5. УДАЛЯЕМ ИЗ ПРАВИЛЬНОГО МАССИВА В DRAFT (КРИТИЧЕСКИ ВАЖНО!)
        if (orderManager && orderManager.draftChanges) {
            if (finalMediaType === 'photo') {
                // Удаляем из массива новых фото
                const photoIndex = orderManager.draftChanges.tempPhotoIds.indexOf(tempId);
                if (photoIndex > -1) {
                    orderManager.draftChanges.tempPhotoIds.splice(photoIndex, 1);
                }
            } else if (finalMediaType === 'video') {
                // Удаляем из массива новых видео
                const videoIndex = orderManager.draftChanges.tempVideoIds.indexOf(tempId);
                if (videoIndex > -1) {
                    orderManager.draftChanges.tempVideoIds.splice(videoIndex, 1);
                }
            }
            
            // Удаляем из старого массива (для обратной совместимости, скоро уберем)
            const uploadIndex = orderManager.draftChanges.tempUploadIds.indexOf(tempId);
            if (uploadIndex > -1) {
                orderManager.draftChanges.tempUploadIds.splice(uploadIndex, 1);
            }
        }
        
        // 6. УДАЛЯЕМ С СЕРВЕРА ЧЕРЕЗ ЕДИНЫЙ API МЕТОД
        await apiService.deleteTempMedia(tempId);
        
        showTempMessage('Файл удалён', 'success');
        
    } catch (error) {
        console.error('[MediaRemove] Ошибка удаления:', error);
        showTempMessage('Ошибка удаления файла', 'error');
        throw error;
    }
}

window.openPhotoPreview = openPhotoPreview;