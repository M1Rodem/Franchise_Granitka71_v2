import { showTempMessage, escapeHtml, formatDate, formatFileSize } from './utils.js';
import { apiService } from './api.js';
import { ModalUtils } from './modal-utils.js';

export let tempUploads = []; // Храним временные загрузки
let activeBlobUrls = [];

const TEMP_STORAGE_KEY = 'tempPhotos_createOrder';

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
 * Загрузка временного фото и создание превью
 */
export async function uploadTempAndDisplay(file) {
    try {
        const photoData = await apiService.uploadTempPhoto(file);
        const previewUrl = await apiService.getTempPreview(photoData.id);
        
        const container = document.getElementById('photoPreview');
        if (!container) return null;
        
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.dataset.tempId = photoData.id;
        
        photoItem.innerHTML = `
            <div class="photo-container">
                <img src="${previewUrl}"
                     alt="${escapeHtml(file.name)}"
                     class="photo-img">
                <button class="photo-remove" title="Удалить фото">✖</button>
            </div>
            <div class="photo-info">
                <div class="photo-name">${escapeHtml(file.name)}</div>
                <div class="photo-meta">${formatDate(new Date())} | ${formatFileSize(file.size)}</div>
            </div>
        `;
        
        container.appendChild(photoItem);
        tempUploads.push(photoData.id);

        // Фикс: Сохрани в localStorage (backup для reload)
        const stored = JSON.parse(localStorage.getItem(TEMP_STORAGE_KEY) || '[]');
        stored.push(photoData.id);
        localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(stored));
        
        showTempMessage(`Фото "${file.name}" загружено`, 'success');
        return photoData.id;
    } catch (error) {
        console.error('Upload error:', error);
        showTempMessage('Ошибка загрузки: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Открытие фото в модальном окне
 */
export function openPhotoPreview(imageSrc, fileName, photoId = null) {
    const modal = document.createElement('div');
    modal.className = 'photo-modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    modal.innerHTML = `
        <div class="photo-modal-content" style="
            max-width: 90%;
            max-height: 90%;
            position: relative;
            cursor: default;
        ">
            <button class="photo-modal-close" style="
                position: absolute;
                top: -40px;
                right: 0;
                background: rgba(255,255,255,0.9);
                border: none;
                border-radius: 50%;
                width: 35px;
                height: 35px;
                cursor: pointer;
                font-size: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">✖</button>
            
            <img src="${imageSrc}" 
                 alt="${escapeHtml(fileName)}"
                 style="
                    max-width: 100%;
                    max-height: 70vh;
                    display: block;
                    border-radius: 8px;
                 "
                 onclick="event.stopPropagation()">
                 
            <div class="photo-modal-info" style="
                color: white;
                text-align: center;
                margin-top: 15px;
                font-size: 14px;
            ">${escapeHtml(fileName)}</div>
            
            <div class="photo-modal-actions" style="
                text-align: center;
                margin-top: 15px;
            ">
                <button class="photo-modal-download" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-size: 14px;
                ">📥 Скачать</button>
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
            // Если photoId передан - используем его, иначе пытаемся извлечь из URL
            let actualPhotoId = photoId;
            if (!actualPhotoId && imageSrc.includes('/')) {
                // Пытаемся извлечь ID из URL (для обычных фото, не blob)
                const urlParts = imageSrc.split('/');
                actualPhotoId = urlParts[urlParts.length - 1];
            }
            
            if (!actualPhotoId) {
                showTempMessage('Не удалось определить ID фото для скачивания', 'error');
                return;
            }
            
            await downloadPhoto(actualPhotoId, fileName);
        } catch (error) {
            showTempMessage('Ошибка скачивания', 'error');
        }
    });
}

/**
 * Рендер сетки фото
 */
export async function renderPhotoGrid(photos, containerId, mode = 'view') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    for (const photo of photos) {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.dataset.photoId = photo.id;
        
        // ДЛЯ РЕЖИМА РЕДАКТИРОВАНИЯ - добавляем data-server-id
        if (mode === 'edit') {
            photoItem.dataset.serverId = photo.id;
        }
        
        try {
            const imageUrl = await apiService.getPhotoFile(photo.id);
            
            photoItem.innerHTML = `
                <div class="photo-container">
                    <img src="${imageUrl}"
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
                    <div>❌ Ошибка загрузки</div>
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
 * Удаление временного фото
 */
export async function removeTempPhoto(tempId) {
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
        
        // УДАЛЕНИЕ
        if (tempPhotoElement) tempPhotoElement.remove();
        
        const index = tempUploads.indexOf(tempId);
        if (index > -1) tempUploads.splice(index, 1);
        
        // Обновить localStorage
        const stored = JSON.parse(localStorage.getItem(TEMP_STORAGE_KEY) || '[]');
        const storedIndex = stored.indexOf(tempId);
        if (storedIndex > -1) stored.splice(storedIndex, 1);
        localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(stored));
        
        await apiService.deleteTempPhoto(tempId);
        showTempMessage('Фото удалено', 'success');
    } catch (error) {
        console.error('Remove temp photo error:', error);
        showTempMessage('Ошибка удаления фото', 'error');
    }
}

/**
 * Удаление привязанного фото в режиме редактирования
 */
export async function removeCommittedPhoto(photoId) {
    try {
        // ПОЛУЧИТЬ КОНКРЕТНЫЙ ЭЛЕМЕНТ ФОТО
        const photoElement = document.querySelector(`.photo-item[data-server-id="${photoId}"]`);
        const fileName = photoElement?.querySelector('.photo-name')?.textContent || 'фото';
        
        // ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ
        const confirmed = await ModalUtils.confirm({
            title: 'Удаление фото',
            message: `Вы уверены, что хотите удалить фото "${fileName}"?`,
            confirmText: 'Удалить',
            danger: true
        });
        
        if (!confirmed) return;
        
        // УДАЛЕНИЕ ТОЛЬКО КОНКРЕТНОГО ФОТО
        await apiService.deletePhoto(photoId);
        
        if (photoElement) {
            photoElement.remove(); // Удаляем только этот элемент
        }
        
        // ПОМЕТИТЬ ЧТО БЫЛИ ИЗМЕНЕНИЯ
        window.photoWasDeleted = true;
        
        showTempMessage('Фото удалено', 'success');
    } catch (error) {
        console.error('Remove committed photo error:', error);
        showTempMessage('Ошибка удаления фото', 'error');
    }
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
export function attachPhotoEvents(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.addEventListener('click', async (e) => {
        e.preventDefault();
        const photoItem = e.target.closest('.photo-item');
        if (!photoItem) return;
        
        // УДАЛЕНИЕ ПРИВЯЗАННОГО ФОТО (режим редактирования)
        if (e.target.classList.contains('photo-remove-server')) {
            e.stopPropagation();
            const photoId = photoItem.dataset.serverId;
            if (photoId) {
                await removeCommittedPhoto(photoId);
            }
            return;
        }
        
        // УДАЛЕНИЕ ВРЕМЕННОГО ФОТО (режим создания)
        if (e.target.classList.contains('photo-remove')) {
            e.stopPropagation();
            const tempId = photoItem.dataset.tempId;
            if (tempId) {
                await removeTempPhoto(tempId);
            }
            return;
        }
        
        // ПРОСМОТР ФОТО
        const imgElement = photoItem.querySelector('.photo-img');
        const imageUrl = imgElement?.src;
        const fileName = imgElement?.alt || 'Фото';
        const photoId = photoItem.dataset.photoId;
        
        if (imageUrl) {
            openPhotoPreview(imageUrl, fileName, photoId);
        }
    });
}

async function downloadPhoto(photoId, fileName) {
    try {
        await apiService.downloadPhoto(photoId, fileName);
        showTempMessage(`Скачано: ${escapeHtml(fileName || 'Фото')}`, 'success');
    } catch (error) {
        console.error('Download error:', error);
        showTempMessage('Ошибка скачивания: ' + error.message, 'error');
    }
}

window.openPhotoPreview = openPhotoPreview;