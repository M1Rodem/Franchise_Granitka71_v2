import { showTempMessage, escapeHtml } from './utils.js';
import { apiService } from './api.js';

let tempUploads = []; // Храним временные загрузки

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
        
        // Создаем превью после успешной загрузки
        const container = document.getElementById('photoPreview');
        if (!container) return null;
        
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.dataset.tempId = photoData.id;
        
        photoItem.innerHTML = `
            <img src="/api/photos/temp-preview/${photoData.id}" 
                 alt="${escapeHtml(file.name)}"
                 style="cursor: pointer;"
                 onclick="openPhotoPreview('/api/photos/temp-preview/${photoData.id}', '${escapeHtml(file.name)}')">
            <button class="photo-remove" onclick="removeTempPhoto(${photoData.id})">✖</button>
        `;
        
        container.appendChild(photoItem);
        
        // Сохраняем в массив
        tempUploads.push(photoData.id);
        
        showTempMessage(`Фото "${file.name}" загружено`, 'success');
        return photoData.id;
    } catch (error) {
        console.error('Upload error:', error);
        showTempMessage('Ошибка загрузки: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Создание превью с индикатором загрузки
 */
function createUploadingPreview(file, tempId) {
    const container = document.getElementById('photoPreview');
    if (!container) return null;
    
    const objectUrl = URL.createObjectURL(file);
    
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item uploading';
    photoItem.dataset.tempId = tempId;
    
    photoItem.innerHTML = `
        <img src="${objectUrl}" alt="Загрузка..." style="filter: brightness(0.7);">
        <div class="photo-progress">Загрузка...</div>
        <button class="photo-remove" onclick="removeTempPhotoByElement(this)">✖</button>
    `;
    
    container.appendChild(photoItem);
    return photoItem;
}

/**
 * Обновление превью после успешной загрузки
 */
function updatePreviewWithServerData(photoItem, photoData, fileName) {
    if (!photoItem) return;
    
    photoItem.classList.remove('uploading');
    const img = photoItem.querySelector('img');
    const progress = photoItem.querySelector('.photo-progress');
    
    img.src = `/api/photos/proxy/${photoData.id}`;
    img.style.filter = 'none';
    img.style.cursor = 'pointer';
    img.onclick = () => openPhotoPreview(img.src, fileName);
    
    if (progress) progress.remove();
    photoItem.dataset.serverId = photoData.id;
}

/**
 * Открытие фото в модальном окне
 */
export function openPhotoPreview(url, fileName) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="position: relative; max-width: 90vw; max-height: 90vh;">
            <button onclick="this.closest('.modal-overlay').remove()" 
                    style="position: absolute; top: -40px; right: 0; background: none; border: none; color: white; font-size: 24px; cursor: pointer;">
                ✕
            </button>
            <img src="${url}" alt="${escapeHtml(fileName)}" 
                 style="max-width: 100%; max-height: 90vh; display: block;">
            <div style="color: white; text-align: center; margin-top: 10px;">
                ${escapeHtml(fileName)}
            </div>
        </div>
    `;
    
    modal.className = 'modal-overlay';
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
}

/**
 * Рендер сетки фото
 */
export function renderPhotoGrid(photos, containerId, mode = 'view') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    photos.forEach(photo => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.innerHTML = `
            <img src="/api/photos/proxy/${photo.id}" 
                 alt="${escapeHtml(photo.originalFileName || 'Фото')}"
                 style="cursor: pointer;" 
                 onclick="openPhotoPreview('/api/photos/proxy/${photo.id}', '${escapeHtml(photo.originalFileName || 'Фото')}')">
            ${mode === 'edit' ? 
                `<button class="photo-remove" onclick="removeCommittedPhoto(${photo.id})">✖ Удалить</button>` :
                `<button class="photo-download" onclick="downloadPhoto(${photo.id}, '${escapeHtml(photo.originalFileName || 'Фото')}')">📥 Скачать</button>`
            }
            <div class="photo-info">
                ${formatDate(photo.uploadedAt)} | ${formatFileSize(photo.size)}
            </div>
        `;
        container.appendChild(photoItem);
    });
}

/**
 * Удаление временного фото
 */
export async function removeTempPhoto(tempId) {
    try {
        // Находим в массиве временных загрузок
        const tempIndex = tempUploads.findIndex(temp => temp.id === tempId);
        if (tempIndex !== -1) {
            const temp = tempUploads[tempIndex];
            if (temp.previewItem) {
                temp.previewItem.remove();
            }
            tempUploads.splice(tempIndex, 1);
        }
        
        // Удаляем с сервера
        await apiService.deleteTempPhoto(tempId);
        showTempMessage('Временное фото удалено', 'success');
        
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
        await apiService.deletePhoto(photoId);
        
        // Удаляем из DOM
        const photoElement = document.querySelector(`[data-server-id="${photoId}"]`);
        if (photoElement) {
            photoElement.remove();
        }
        
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
    return tempUploads.map(temp => temp.id);
}

/**
 * Очистка временных фото после коммита
 */
export function clearTempPhotos() {
    tempUploads = [];
    const previewContainer = document.getElementById('photoPreview');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
}

// Вспомогательные функции
function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
        return '—';
    }
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Глобальные функции для HTML
window.removeTempPhotoByElement = function(button) {
    const photoItem = button.closest('.photo-item');
    const serverId = photoItem.dataset.serverId;
    
    if (serverId) {
        removeCommittedPhoto(serverId);
    } else {
        const temp = tempUploads.find(t => t.previewItem === photoItem);
        if (temp) removeTempPhoto(temp.id);
    }
};

window.downloadPhoto = async function(photoId, fileName) {
    try {
        await apiService.downloadPhoto(photoId);
    } catch (error) {
        showTempMessage('Ошибка скачивания: ' + error.message, 'error');
    }
};

window.openPhotoPreview = openPhotoPreview;

// Добавьте в конец photo-utils.js
window.removeTempPhoto = async function(tempId) {
    try {
        // Удаляем из DOM
        const photoElement = document.querySelector(`[data-temp-id="${tempId}"]`);
        if (photoElement) {
            photoElement.remove();
        }
        
        // Удаляем из массива
        const index = tempUploads.indexOf(tempId);
        if (index > -1) {
            tempUploads.splice(index, 1);
        }
        
        // Удаляем с сервера
        await apiService.deleteTempPhoto(tempId);
        showTempMessage('Фото удалено', 'success');
        
    } catch (error) {
        console.error('Remove temp photo error:', error);
        showTempMessage('Ошибка удаления фото', 'error');
    }
};