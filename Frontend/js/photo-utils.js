// photo-utils.js
/**
 * Настройка drag & drop для области загрузки фото
 */
function setupDragAndDrop(uploadAreaId, uploadCallback) {
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
        // Избегаем двойного открытия, если клик по label или button
        if (e.target.tagName === 'LABEL' || e.target.tagName === 'BUTTON' || e.target.closest('label, button')) {
            return; // Не открываем снова, если клик по элементу, который уже обрабатывает выбор файла
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
function handlePhotoSelect(e, uploadCallback) {
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
 * Создание превью фото с индикатором загрузки
 */
function createPhotoPreview(file, photoId, onRemoveCallback, containerId = 'photoPreview') {
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
             onclick="openPhotoPreview('${objectUrl}', '${escapeHtml(file.name, true)}')">
        <div class="photo-progress">Загрузка...</div>
        <button class="photo-remove" onclick="${onRemoveCallback}('${photoId}')">✖</button>
    `;
    
    container.appendChild(photoItem);
    return { photoItem, objectUrl };
}

/**
 * Обновление превью после успешной загрузки
 */
function updatePhotoPreview(photoItem, photoData, fileName) {
    photoItem.classList.remove('uploading');
    photoItem.querySelector('img').src = photoData.url;
    photoItem.querySelector('img').style.filter = 'none';
    photoItem.querySelector('img').onclick = () => openPhotoPreview(photoData.url, fileName);
    photoItem.querySelector('.photo-progress').remove();
    photoItem.dataset.serverId = photoData.id;
}

/**
 * Открытие превью фото в модальном окне
 */
function openPhotoPreview(url, fileName) {
    // Закрываем существующее модальное окно если есть
    const existingModal = document.getElementById('photoModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Создаем модальное окно
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
            <span class="close" style="position: absolute; top: 10px; right: 10px; font-size: 24px; cursor: pointer; z-index: 10001; color: #000;">&times;</span>
            <img src="${url}" alt="${fileName}" style="max-width: 100%; max-height: 80vh; display: block;">
            <div style="color: #333; text-align: center; margin-top: 10px;">${fileName}</div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 🔥 Единый обработчик закрытия
    const closeModal = () => {
        modal.remove();
        document.removeEventListener('keydown', escapeHandler);
    };
    
    // Закрытие по крестику
    modal.querySelector('.close').onclick = closeModal;
    
    // Закрытие по клику на фон
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Закрытие по ESC
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

/**
 * Показ временного сообщения
 */
function showTempMessage(message, type = 'error') {
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem;
        border-radius: 4px;
        z-index: 10000;
        color: white;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.remove();
    }, 4000);
}
/**
 * Экранирование HTML и Attr
 */
function escapeHtml(unsafe, isAttribute = false) {
    if (unsafe == null) return '';
    const str = String(unsafe);
    
    if (isAttribute) {
        return str.replace(/["']/g, c => ({'"':'&quot;','\'':'&#39;'}[c]));
    }
    
    return str.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function normalizePhone(v) {
    if (!v) return '';
    return String(v).trim().replace(/\D/g, ''); // только цифры
}

function showTempMessage(message, type = 'error') {
    const el = document.createElement('div');
    el.textContent = message;
    el.className = `${type}-message`;
    el.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1001; padding: 1rem; border-radius: 4px; max-width: 300px; color: white;';
    el.style.background = type === 'success' ? '#28a745' : '#dc3545';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

/**
 * Обработчик ошибок загрузки изображений
 */
// photo-utils.js - добавляем/обновляем функцию
function handleImageError(img, photoId) {
    console.warn('❌ Ошибка загрузки изображения:', img.src);
    
    if (img.src.includes('data:image/svg+xml')) {
        return;
    }
    
    // Если передан photoId, пробуем загрузить с авторизацией
    if (photoId !== undefined) {
        loadAuthorizedImage(img, photoId);
    } else {
        // Иначе показываем placeholder
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNGM0YzRjMiLz48dGV4dCB4PSI1MCIgeT0iNzUiIGZpbGw9IiM5OTk5OTkiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yPC90ZXh0Pjwvc3ZnPg==';
        img.style.cursor = 'default';
    }
}

// Упрощаем загрузку фото
async function uploadAndDisplayPhoto(file, orderId) {
    const preview = document.getElementById('orderPhotos');
    const photoId = 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Создаем превью
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item uploading';
    photoItem.id = photoId;
    
    // Создаем URL для превью
    const objectUrl = URL.createObjectURL(file);
    
    photoItem.innerHTML = `
        <img src="${objectUrl}" alt="Загрузка..." style="filter: brightness(0.7); cursor: pointer;" 
             onclick="openPhotoPreview('${objectUrl}', '${escapeHtml(file.name, true)}')">
        <div class="photo-progress">Загрузка...</div>
        <button class="photo-remove" onclick="removePhoto('${photoId}')">✖</button>
    `;
    preview.appendChild(photoItem);
    
    try {
        console.log('📤 Загрузка фото в заказ:', orderId, file.name);
        const photoData = await apiService.uploadPhoto(orderId, file);
        console.log('✅ Фото загружено в заказ:', photoData);
        
        // Очищаем objectURL
        URL.revokeObjectURL(objectUrl);
        
        // Обновляем превью с серверным URL
        photoItem.classList.remove('uploading');
        
        // ✅ ИСПРАВЛЕНИЕ: Формируем правильный URL для загруженного фото
        const serverPhotoUrl = `${API_BASE_URL.replace('/api', '')}${photoData.url || `/api/photos/${photoData.id}/file`}`;
        photoItem.querySelector('img').src = serverPhotoUrl;
        photoItem.querySelector('img').style.filter = 'none';
        photoItem.querySelector('img').onclick = () => openPhotoPreview(serverPhotoUrl, file.name);
        photoItem.querySelector('.photo-progress').remove();
        photoItem.dataset.photoId = photoData.id;
        photoItem.dataset.serverId = photoData.id;
        
        showTempMessage(`Фото "${file.name}" загружено`, 'success');
        
    } catch (error) {
        URL.revokeObjectURL(objectUrl);
        photoItem.remove();
        console.error('❌ Ошибка загрузки фото:', error);
        showTempMessage('Ошибка загрузки фото: ' + error.message, 'error');
    }
}