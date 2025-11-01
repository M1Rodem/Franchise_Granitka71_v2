import { showTempMessage, escapeHtml, formatDate, formatFileSize } from './utils.js';
import { apiService } from './api.js';

export let tempUploads = []; // Храним временные загрузки

const TEMP_STORAGE_KEY = 'tempPhotos_createOrder';

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
        showTempMessage('Старые временные фото очищены', 'info');
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
        const previewUrl = await apiService.getTempPreview(photoData.id);  // Blob URL
        
        const container = document.getElementById('photoPreview');
        if (!container) return null;
        
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.dataset.tempId = photoData.id;
        
        photoItem.innerHTML = `
            <img src="${previewUrl}" 
                 alt="${escapeHtml(file.name)}"
                 class="photo-img"
                 style="cursor: pointer;">
            <button class="photo-remove">✖</button>
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
export function openPhotoPreview(imageSrc, fileName) {
    if (imageSrc.startsWith('blob:')) {
        // Revoke после закрытия (setTimeout)
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <img src="${imageSrc}" alt="${escapeHtml(fileName)}">
                <p>${escapeHtml(fileName)}</p>
            </div>
        `;
        modal.style.display = 'block';
        document.body.appendChild(modal);
        
        const close = modal.querySelector('.close');
        close.onclick = () => {
            URL.revokeObjectURL(imageSrc);  // Фикс: Освободи blob
            modal.style.display = 'none';
            document.body.removeChild(modal);
        };
        modal.onclick = (e) => { if (e.target === modal) { close.click(); } };
    } else {
        // Для committed: window.open(imageSrc, '_blank'); или модалка
        window.open(imageSrc, '_blank');
    }
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
        photoItem.dataset.serverId = photo.id;  // Для remove
        
        photoItem.innerHTML = `
            <img src="/api/photos/proxy/${photo.id}"  // Фикс: proxy endpoint (с токеном? Если нет — добавь в apiService аналог getTempPreview)
                 alt="${escapeHtml(photo.originalFileName || 'Фото')}"
                 class="photo-img"
                 style="cursor: pointer; width: 100px; height: 100px; object-fit: cover;">
            ${mode === 'edit' ? 
                `<button class="photo-remove">✖ Удалить</button>` :
                `<button class="photo-download">📥 Скачать</button>`
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
        const photoElement = document.querySelector(`[data-temp-id="${tempId}"]`);
        if (photoElement) photoElement.remove();
        
        const index = tempUploads.indexOf(tempId);
        if (index > -1) tempUploads.splice(index, 1);
        
        // Фикс: Удали из localStorage
        const stored = JSON.parse(localStorage.getItem(TEMP_STORAGE_KEY) || '[]');
        const storedIndex = stored.indexOf(tempId);
        if (storedIndex > -1) stored.splice(storedIndex, 1);
        localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(stored));
        
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
        
        const photoElement = document.querySelector(`[data-server-id="${photoId}"]`);
        if (photoElement) photoElement.remove();
        
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
    showTempMessage('Временные фото очищены', 'info');

// Вспомогательные функции
export function clearTempPhotos() {
    tempUploads = [];
    const previewContainer = document.getElementById('photoPreview');
    if (previewContainer) previewContainer.innerHTML = '';
    localStorage.removeItem(TEMP_STORAGE_KEY);  // Фикс: Очистка storage
    showTempMessage('Временные фото очищены', 'info');
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
        
        const serverId = photoItem.dataset.serverId;
        const tempId = photoItem.dataset.tempId;
        
        if (e.target.classList.contains('photo-remove')) {
            if (serverId) {
                await removeCommittedPhoto(serverId);
            } else if (tempId) {
                await removeTempPhoto(tempId);
            }
        } else if (e.target.classList.contains('photo-download')) {
            const fileName = photoItem.querySelector('img').alt;
            await downloadPhoto(serverId, fileName);
        } else if (e.target.className === 'photo-img') {  // Клик по img
            openPhotoPreview(e.target.src, e.target.alt);
        }
    });
}

async function downloadPhoto(photoId, fileName) {  // Вынес в функцию
    try {
        await apiService.downloadPhoto(photoId);
        showTempMessage(`Скачано: ${escapeHtml(fileName || 'Фото')}`, 'success');
    } catch (error) {
        showTempMessage('Ошибка скачивания: ' + error.message, 'error');
    }
}