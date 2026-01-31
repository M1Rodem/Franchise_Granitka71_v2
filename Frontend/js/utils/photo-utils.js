import { showTempMessage, escapeHtml, formatDate, formatFileSize } from '../utils/utils.js';
import { apiService } from '../api/api.js';
import { ModalUtils } from '../utils/modal-utils.js';

export let tempUploads = []; // Храним временные загрузки
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
        
        if (draftManager && draftManager.draftChanges) {
            if (draftManager.draftChanges.tempUploadIds.indexOf(tempId) === -1) {
                draftManager.draftChanges.tempUploadIds.push(tempId);
            }
        } 
        else {
            tempUploads.push(tempId);
            const stored = JSON.parse(localStorage.getItem(TEMP_STORAGE_KEY) || '[]');
            stored.push(tempId);
            localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(stored));
        }
        
        showTempMessage(`Фото "${file.name}" загружено`, 'success');
        return tempId;
    } catch (error) {
        console.error('Upload error:', error);
        showTempMessage('Ошибка загрузки: ' + error.message, 'error');
        throw error;
    }
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
    try {
        // ПОЛУЧИТЬ ИНФОРМАЦИЮ О ФОТО ДЛЯ СООБЩЕНИЯ
        const tempPhotoElement = document.querySelector(`[data-temp-id="${tempId}"]`);
        const fileName = tempPhotoElement?.querySelector('.photo-name')?.textContent || 'фото';
        
        // ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ
        const confirmed = await ModalUtils.confirm({
            title: 'Удаление фото',
            message: `Вы уверены, что хотите удалить фото "${fileName}"?`,
            confirmText: 'Удалить',
            danger: true
        });
        
        if (!confirmed) return;
        
        // УДАЛЕНИЕ ИЗ DOM
        if (tempPhotoElement) tempPhotoElement.remove();
        
        if (draftManager && draftManager.draftChanges) {
            const index = draftManager.draftChanges.tempUploadIds.indexOf(tempId);
            if (index > -1) {
                draftManager.draftChanges.tempUploadIds.splice(index, 1);
            }
        }
        else {
            const index = tempUploads.indexOf(tempId);
            if (index > -1) tempUploads.splice(index, 1);
            
            // Обновить localStorage
            const stored = JSON.parse(localStorage.getItem(TEMP_STORAGE_KEY) || '[]');
            const storedIndex = stored.indexOf(tempId);
            if (storedIndex > -1) stored.splice(storedIndex, 1);
            localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(stored));
        }
        
        // УДАЛЕНИЕ С СЕРВЕРА
        await apiService.deleteTempPhoto(tempId);
        
        showTempMessage('Фото удалено', 'success');
    } catch (error) {
        console.error('Remove temp photo error:', error);
        showTempMessage('Ошибка удаления фото', 'error');
    }
}


/**
 * Открытие фото в улучшенном модальном окне
 */
export function openPhotoPreview(imageSrc, fileName, photoId = null, orderNumber = null, photoIndex = null) {
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
    
    // ИСПРАВЛЕННЫЙ ОБРАБОТЧИК СКАЧИВАНИЯ - передаем все параметры
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
            
            // ПЕРЕДАЕМ ВСЕ ПАРАМЕТРЫ как в старом коде
            await downloadPhoto(actualPhotoId, fileName, orderNumber, photoIndex);
        } catch (error) {
            console.error('Download error in modal:', error);
            showTempMessage('Ошибка скачивания: ' + error.message, 'error');
        }
    });
}

/**
 * Рендер сетки фото
 */
export async function renderPhotoGrid(photos, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    // ДОБАВИТЬ эту строку:
    const { mode = 'view', orderNumber } = options;
    
    for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.dataset.photoId = photo.id;
        photoItem.dataset.photoIndex = i + 1;
        
        // Сохраняем номер заказа если передан
        if (orderNumber) {
            photoItem.dataset.orderNumber = orderNumber;
        }
        
        try {
            const imageUrl = await apiService.getPhotoUrl(photo.id);
            
            photoItem.innerHTML = `
                <div class="photo-container">
                    <img src="${sanitizeUrl(imageUrl)}"
                        alt="${escapeHtml(photo.originalFileName || 'Фото')}"
                        class="photo-img">
                    ${mode === 'edit' ? '<button class="photo-remove-server" title="Удалить фото">✖</button>' : ''}
                </div>
                <div class="photo-info">
                    <div class="photo-name">${escapeHtml(photo.originalFileName || 'Фото')}</div>
                    <div class="photo-meta">${formatDate(photo.uploadedAt)} | ${formatFileSize(photo.size)}</div>
                </div>
            `;
            container.appendChild(photoItem);
            
        } catch (error) {
            console.error('Error loading photo:', error);
            photoItem.innerHTML = `
                <div class="photo-container" style="background: #f8f9fa; display: flex; align-items: center; justify-content: center; color: #666;">
                    <div>Ошибка загрузки</div>
                </div>
                <div class="photo-info">
                    <div class="photo-name">${escapeHtml(photo.originalFileName || 'Фото')}</div>
                    <div class="photo-meta">Ошибка загрузки</div>
                </div>
            `;
            container.appendChild(photoItem);
        }
    }
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
 * Event delegation для фото (убрал onclick, используй в create-order)
 */
export function attachPhotoEvents(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const { mode = 'view', orderNumber, photoManager } = options;
    
    container.addEventListener('click', async (e) => {
        e.preventDefault();
        const photoItem = e.target.closest('.photo-item');
        if (!photoItem) return;
        
        // Обработчик для кнопки удаления/восстановления в режиме редактирования
        if (e.target.classList.contains('photo-remove-server')) {
            e.stopPropagation();
            const photoId = photoItem.dataset.photoId;
            
            if (!photoId) return;
            
            // Проверяем, помечено ли фото для удаления
            const isMarkedForDeletion = photoItem.classList.contains('photo-marked-for-deletion');
            
            if (isMarkedForDeletion) {
                // Восстанавливаем фото
                restorePhotoFromDeletion(photoId, photoManager);
            } else {
                // Помечаем для удаления
                await markPhotoForDeletion(photoId, photoManager);
            }
            return;
        }
        
        if (e.target.classList.contains('photo-remove')) {
            e.stopPropagation();
            const tempId = photoItem.dataset.tempId;
            if (tempId) {
                // Если передан photoManager с draftChanges - используем его
                if (photoManager && typeof photoManager.handleTempPhotoRemoval === 'function') {
                    await photoManager.handleTempPhotoRemoval(tempId);
                } else {
                    // Для обратной совместимости
                    await removeTempPhoto(tempId);
                }
            }
            return;
        }
        
        // ПРОСМОТР ФОТО (без изменений)
        const imgElement = photoItem.querySelector('.photo-img');
        const imageUrl = imgElement?.src;
        const fileName = imgElement?.alt || 'Фото';
        const photoId = photoItem.dataset.photoId;
        const photoIndex = photoItem.dataset.photoIndex;
        
        if (imageUrl) {
            openPhotoPreview(imageUrl, fileName, photoId, orderNumber, photoIndex);
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

window.openPhotoPreview = openPhotoPreview;