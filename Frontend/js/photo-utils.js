import { showTempMessage, escapeHtml } from './utils.js';
import { apiService } from './api.js';

const API_BASE_URL = 'https://localhost:7137';  // Без /api для file paths

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
        if (!uploadCallback || typeof uploadCallback !== 'function') {
            console.error('uploadCallback is not a function for drag&drop:', uploadCallback);
            showTempMessage('Ошибка: функция загрузки не определена', 'error');
            return;
        }
        handleFiles(e.dataTransfer.files, uploadCallback);
    });
    
    // Клик по области загрузки
    uploadArea.addEventListener('click', (e) => {
        if (e.target.tagName === 'LABEL' || e.target.tagName === 'BUTTON' || e.target.closest('label, button')) {
            return;
        }
        const photoInput = document.getElementById('photoInput');
        if (photoInput) {
            photoInput.click();
        }
    });
}

/**
 * Обработка выбора файлов через input
 */
export function handlePhotoSelect(e, uploadCallback) {
    if (!uploadCallback || typeof uploadCallback !== 'function') {
        console.error('uploadCallback is not a function:', uploadCallback);
        showTempMessage('Ошибка: функция загрузки не определена', 'error');
        return;
    }
    handleFiles(e.target.files, uploadCallback);
    e.target.value = '';
}

/**
 * Валидация и обработка файлов
 */
async function handleFiles(files, uploadCallback, onRemoveCallback = null) {
    for (let file of files) {
        if (!file.type.startsWith('image/')) {
            showTempMessage('Пропущен не изображение: ' + file.name, 'error');
            continue;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showTempMessage('Файл слишком большой: ' + file.name, 'error');
            continue;
        }
        
        await uploadCallback(file, onRemoveCallback);
    }
}

/**
 * Создание превью фото с индикатором загрузки (для temp upload)
 */
export function createPhotoPreview(file, photoId, onRemoveCallback, containerId = 'photoPreview') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Container not found:', containerId);
        return null;
    }
    
    const objectUrl = URL.createObjectURL(file);
    
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item uploading';
    photoItem.id = photoId;
    
    photoItem.innerHTML = `
        <img src="${objectUrl}" alt="Загрузка..." style="filter: brightness(0.7); cursor: pointer;" 
             onclick="openPhotoPreview('${objectUrl}', '${escapeHtml(file.name)}')">
        <div class="photo-progress">Загрузка...</div>
        <button class="photo-remove" onclick="${onRemoveCallback}('${photoId}')">✖</button>
    `;
    
    container.appendChild(photoItem);
    return { photoItem, objectUrl };
}

/**
 * Обновление превью после успешной загрузки (temp -> committed)
 */
export function updatePhotoPreview(photoItem, photoData, fileName) {
    photoItem.classList.remove('uploading');
    const img = photoItem.querySelector('img');
    img.src = photoData.url;  // /api/photos/{id}/file
    img.style.filter = 'none';
    img.onclick = () => openPhotoPreview(photoData.url, fileName);
    photoItem.querySelector('.photo-progress').remove();
    photoItem.dataset.serverId = photoData.id;
}

/**
 * Открытие превью фото в модальном окне
 */
export function openPhotoPreview(url, fileName) {
    const existingModal = document.getElementById('photoModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'photoModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%; background: white; padding: 20px; border-radius: 8px;">
            <span class="close" style="position: absolute; top: 10px; right: 10px; font-size: 24px; cursor: pointer; z-index: 10001; color: #000;" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <img src="${url}" alt="${escapeHtml(fileName)}" style="max-width: 100%; max-height: 80vh; display: block;">
            <div style="color: #333; text-align: center; margin-top: 10px;">${escapeHtml(fileName)}</div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => modal.remove();
    modal.querySelector('.close').onclick = closeModal;
    
    const escapeHandler = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', escapeHandler);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

/**
 * НОВОЕ: Рендер сетки фото (для п.6: view/edit mode)
 * mode: 'view' — только img + download; 'edit' — + remove
 */
export function renderPhotoGrid(photos, containerId, mode = 'view') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';  // Clear

    photos.forEach(photo => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.innerHTML = `
            <img src="${photo.url}" alt="${escapeHtml(photo.originalFileName || 'Фото')}" 
                 style="cursor: pointer;" onclick="openPhotoPreview('${photo.url}', '${escapeHtml(photo.originalFileName || 'Фото')}')">
            ${mode === 'view' ? 
                `<button class="photo-download" onclick="apiService.downloadPhoto(${photo.id})">📥 Скачать</button>` :
                `<button class="photo-remove" onclick="removePhotoFromEdit(${photo.id})">✖ Удалить</button>`
            }
            <div class="photo-info">${formatDateTime(photo.uploadedAt)} | ${formatSize(photo.size)}</div>
        `;
        container.appendChild(photoItem);
    });
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

// Фикс upload: Temp upload + display (вызывай в create-order)
export async function uploadTempAndDisplay(file, containerId = 'photoPreview', onRemoveCallback) {
    const photoId = `temp_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    const { photoItem, objectUrl } = createPhotoPreview(file, photoId, onRemoveCallback, containerId);
    
    try {
        const photoData = await apiService.uploadTempPhoto(file);
        updatePhotoPreview(photoItem, photoData, file.name);
        showTempMessage(`Фото "${file.name}" загружено временно`, 'success');
        return photoData.id;  // Верни tempId для commit
    } catch (error) {
        URL.revokeObjectURL(objectUrl);
        photoItem.remove();
        showTempMessage('Ошибка загрузки: ' + error.message, 'error');
        throw error;
    }
}

// Удаление temp (если не committed)
export async function removeTempPhoto(tempId) {
    const item = document.getElementById(`temp_${tempId}`);
    if (item) item.remove();
    await apiService.deleteTempPhoto(tempId);
    showTempMessage('Временное фото удалено', 'success');
}

// Удаление в edit (п.6: только в edit mode)
export async function removePhotoFromEdit(photoId) {
    await apiService.deletePhoto(photoId);
    const item = document.querySelector(`[data-server-id="${photoId}"]`);
    if (item) item.remove();
    showTempMessage('Фото удалено', 'success');
}