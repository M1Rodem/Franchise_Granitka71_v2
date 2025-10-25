document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = userData.fullName || 'Пользователь';
    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => apiService.logout());

    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'), 10);
    if (!id) {
        document.getElementById('orderView').textContent = 'Некорректный ID заказа';
        return;
    }

    const orderView = document.getElementById('orderView');
    const orderPhotosEl = document.getElementById('orderPhotos');
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const addPhotoBtn = document.getElementById('addPhotoBtn');
    const photoUploadArea = document.getElementById('photoUploadArea');
    const photoInput = document.getElementById('photoInput');

    try {
        orderView.innerHTML = '<div class="loading">Загрузка заказа...</div>';
        const order = await apiService.getOrder(id);
        render(order);

        orderPhotosEl.innerHTML = '<div class="loading">Загрузка фотографий...</div>';
        await loadOrderPhotos(id);

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                window.location.href = `create-order.html?id=${id}`;
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Вы уверены? Заказ будет удалён.')) return;
                deleteBtn.disabled = true;
                try {
                    await apiService.deleteOrder(id);
                    showTempMessage('Заказ удалён!', 'success');
                    setTimeout(() => window.location.href = 'orders.html', 1500);
                } catch (error) {
                    showTempMessage('Ошибка: ' + error.message, 'error');
                } finally {
                    deleteBtn.disabled = false;
                }
            });
        }

        // Обработчики для загрузки фото
        if (addPhotoBtn) {
            addPhotoBtn.addEventListener('click', () => {
                photoUploadArea.style.display = photoUploadArea.style.display === 'none' ? 'block' : 'none';
                addPhotoBtn.textContent = photoUploadArea.style.display === 'none' ? '➕ Добавить фотографии' : '✖ Скрыть';
            });
        }
        
        if (photoInput) {
            photoInput.addEventListener('change', (e) => {
                const orderId = parseInt(new URLSearchParams(window.location.search).get('id'));
                handlePhotoSelect(e, (file) => uploadAndDisplayPhoto(file, orderId));
            });
        }        

        // Настройка drag & drop
        if (photoUploadArea) {
            const orderId = parseInt(new URLSearchParams(window.location.search).get('id'));
            setupDragAndDrop('photoUploadArea', (file) => uploadAndDisplayPhoto(file, orderId));
        }

        // Delegation for photos/modal/delete
        document.addEventListener('click', (e) => {
            if (e.target.matches('.photo-item img')) {
                const url = e.target.src;
                const caption = e.target.alt || 'Фото заказа';
                openPhotoPreview(url, caption);
            } else if (e.target.matches('.photo-remove')) {
                const item = e.target.closest('.photo-item');
                const photoId = item.dataset.photoId;
                removePhoto(photoId);
            }
        });

    } catch (error) {
        console.error('Load error:', error);
        orderView.innerHTML = `<div class="error-message">Ошибка: ${error.message}</div>`;
        orderPhotosEl.innerHTML = '';
    }
});

function getPaymentStatus(order) {
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    if (totalPaid === 0) return 'unpaid';
    if (totalPaid < order.totalPrice) return 'partial';
    return 'paid';
}

function getPaymentStatusText(order) {
    const status = getPaymentStatus(order);
    const texts = { unpaid: 'Не оплачено', partial: 'Частично оплачено', paid: 'Полностью оплачено' };
    return texts[status] || 'Неизвестно';
}

function formatPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 11) return phone;
    return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7,9)}-${digits.slice(9)}`;
}

async function loadOrderPhotos(id) {
    try {
        console.log('🔄 Загрузка фото заказа:', id);
        const photos = await apiService.getOrderPhotos(id);
        console.log('✅ Фото заказа загружены:', photos);
        renderExistingPhotos(photos);
    } catch (error) {
        console.error('❌ Photos error:', error);
        document.getElementById('orderPhotos').innerHTML = `<div class="error-message">Ошибка загрузки фото: ${error.message}</div>`;
    }
}

function renderExistingPhotos(photos) {
    const container = document.getElementById('orderPhotos');
    if (!photos || photos.length === 0) {
        container.innerHTML = '<div class="loading">Нет фотографий</div>';
        return;
    }
    
    console.log('🎨 Рендеринг фото:', photos);
    
    // Очищаем контейнер
    container.innerHTML = '';
    
    // Загружаем каждое фото с авторизацией
    photos.forEach(photo => {
        loadAndDisplayAuthorizedPhoto(photo, container);
    });
}

async function loadAndDisplayAuthorizedPhoto(photo, container) {
    try {
        const token = localStorage.getItem('token');
        const url = `${API_BASE_URL}/Photos/${photo.id}/file`;
        
        console.log('🔐 Загрузка фото:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load photo: ${response.status}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.id = `photo_${photo.id}`;
        photoItem.dataset.photoId = `photo_${photo.id}`;
        photoItem.dataset.serverId = photo.id;
        
        photoItem.innerHTML = `
            <img src="${blobUrl}" alt="${escapeHtml(photo.originalFileName)}" loading="lazy"
                 style="cursor: pointer; max-height: 150px; object-fit: cover;">
            <div class="photo-caption">${escapeHtml(photo.originalFileName)}</div>
            <button class="photo-remove" aria-label="Удалить">✕</button>
        `;
        
        container.appendChild(photoItem);
        
        // Добавляем обработчик клика
        const img = photoItem.querySelector('img');
        img.addEventListener('click', () => {
            openAuthorizedPhoto(photo.id, photo.originalFileName);
        });
        
        // Добавляем обработчик удаления
        photoItem.querySelector('.photo-remove').addEventListener('click', () => {
            removePhoto(`photo_${photo.id}`);
        });
        
        console.log('✅ Фото загружено и отображено:', photo.id);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки фото:', error);
        
        // Создаем placeholder при ошибке
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item error';
        photoItem.id = `photo_${photo.id}`;
        photoItem.dataset.serverId = photo.id;
        
        photoItem.innerHTML = `
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0BveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNGM0YzRjMiLz48dGV4dCB4PSI1MCIgeT0iNzUiIGZpbGw9IiM5OTk5OTkiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yPC90ZXh0Pjwvc3ZnPg==" 
                 alt="Ошибка загрузки" style="cursor: default;">
            <div class="photo-caption">${escapeHtml(photo.originalFileName)} (ошибка)</div>
            <button class="photo-remove" aria-label="Удалить">✕</button>
        `;
        
        container.appendChild(photoItem);
        
        // Добавляем обработчик удаления
        photoItem.querySelector('.photo-remove').addEventListener('click', () => {
            removePhoto(`photo_${photo.id}`);
        });
    }
}

async function openAuthorizedPhoto(photoId, fileName) {
    try {
        const token = localStorage.getItem('token');
        const url = `${API_BASE_URL}/Photos/${photoId}/file`;
        
        console.log('🔐 Открытие фото в модальном окне:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load photo: ${response.status}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        openPhotoPreview(blobUrl, fileName);
        
        // Очищаем URL после закрытия модального окна
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки фото для модального окна:', error);
        showTempMessage('Ошибка загрузки фото: ' + error.message, 'error');
    }
}

async function removePhoto(photoId) {
    if (!confirm('Удалить фото?')) return;
    
    const photoItem = document.getElementById(photoId);
    if (!photoItem) return;
    
    const serverId = photoItem.dataset.serverId;
    
    try {
        if (serverId) {
            await apiService.deletePhoto(serverId);
        }
        
        photoItem.remove();
        showTempMessage('Фото удалено!', 'success');
        
        // Перезагружаем список фото для обновления
        const id = parseInt(new URLSearchParams(window.location.search).get('id'));
        await loadOrderPhotos(id);
    } catch (error) {
        showTempMessage('Ошибка: ' + error.message, 'error');
    }
}

function render(order) {
    const view = document.getElementById('orderView');
    const status = getPaymentStatus(order);
    const statusText = getPaymentStatusText(order);

    view.innerHTML = `
        <header class="order-header refined-header">
            <h1 class="refined-h1">Заказ №${escapeHtml(order.orderNumber)}</h1>
            <div class="refined-meta">
                <div class="meta-line">
                    <span class="meta-icon">📅</span>
                    <strong class="meta-label">Дата создания:</strong>
                    <span class="meta-value">${new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
                </div>
                <div class="meta-line">
                    <span class="status-badge refined-badge ${status}">${escapeHtml(statusText)}</span>
                </div>
                <div class="meta-line">
                    <span class="meta-icon">💰</span>
                    <strong class="meta-label">Общая сумма:</strong>
                    <span class="meta-value bold-sum">${formatCurrency(order.totalPrice)}</span>
                </div>
            </div>
        </header>

        <div class="refined-sections">
            <section class="refined-section customer-section">
                <h2 class="refined-h2">Заказчик</h2>
                <div class="refined-info">
                    <div class="info-line">
                        <strong class="info-label">ФИО:</strong>
                        <span class="info-value">${escapeHtml(order.customerFullName)}</span>
                    </div>
                    <div class="info-line">
                        <strong class="info-label">Телефон:</strong>
                        <span class="info-value">${formatPhone(order.phone)}</span>
                    </div>
                    ${order.customerEmail ? `
                    <div class="info-line">
                        <strong class="info-label">Email:</strong>
                        <span class="info-value">${escapeHtml(order.customerEmail)}</span>
                    </div>
                    ` : ''}
                </div>
            </section>

            <section class="refined-section deceased-section">
                <h2 class="refined-h2">Усопший</h2>
                <div class="refined-info">
                    <div class="info-line">
                        <strong class="info-label">ФИО:</strong>
                        <span class="info-value">${escapeHtml(order.deceasedFullName)}</span>
                    </div>
                    <div class="info-line">
                        <strong class="info-label">Адрес участка:</strong>
                        <span class="info-value">${escapeHtml(order.address)}</span>
                    </div>
                </div>
            </section>

            <section class="refined-section monument-section">
                <h2 class="refined-h2">Памятник</h2>
                <div class="refined-info">
                    <div class="info-line">
                        <strong class="info-label">Тип:</strong>
                        <span class="info-value">${escapeHtml(order.monument)}</span>
                    </div>
                    <div class="info-line">
                        <strong class="info-label">Размер:</strong>
                        <span class="info-value">${escapeHtml(order.monumentSize)}</span>
                    </div>
                    <div class="info-line">
                        <strong class="info-label">Место установки:</strong>
                        <span class="info-value">${escapeHtml(order.place)}</span>
                    </div>
                </div>
            </section>

            <section class="refined-section manager-section">
                <h2 class="refined-h2">Менеджер</h2>
                <div class="refined-info">
                    <div class="info-line">
                        <strong class="info-label">Ответственный:</strong>
                        <span class="info-value">${escapeHtml(order.manager?.fullName || 'Не назначен')}</span>
                    </div>
                </div>
            </section>
        </div>

        <div class="refined-tables">
            <section class="refined-table-section">
                <h2 class="refined-h2">Виды работ</h2>
                ${renderWorks(order.workItems)}
            </section>

            <section class="refined-table-section">
                <h2 class="refined-h2">Платежи</h2>
                ${renderPayments(order.payments)}
            </section>
        </div>

        ${order.additionalInfo ? `
        <section class="refined-section additional-section">
            <h2 class="refined-h2">Дополнительная информация</h2>
            <div class="refined-info-text">
                <p class="refined-p">${escapeHtml(order.additionalInfo)}</p>
            </div>
        </section>
        ` : ''}
    `;
}

function renderWorks(items) {
    if (!items || items.length === 0) return '<div class="refined-no-data">Нет работ</div>';
    return `
        <table class="refined-table">
            <thead>
                <tr>
                    <th class="refined-th">Вид работы</th>
                    <th class="refined-th">Цена</th>
                    <th class="refined-th">Кол-во</th>
                    <th class="refined-th">Примечание</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((w, index) => `
                    <tr class="refined-tr ${index % 2 === 0 ? 'refined-even' : 'refined-odd'}">
                        <td class="refined-td refined-description">${escapeHtml(w.workDescription || '')}</td>
                        <td class="refined-td refined-price">${formatCurrency(w.price || 0)}</td>
                        <td class="refined-td refined-quantity">${w.quantity || 1}</td>
                        <td class="refined-td refined-note">${escapeHtml(w.note || '')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderPayments(items) {
    if (!items || items.length === 0) return '<div class="refined-no-data">Нет платежей</div>';
    return `
        <table class="refined-table">
            <thead>
                <tr>
                    <th class="refined-th">Тип</th>
                    <th class="refined-th">Сумма</th>
                    <th class="refined-th">Дата</th>
                    <th class="refined-th">Примечание</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((p, index) => `
                    <tr class="refined-tr ${index % 2 === 0 ? 'refined-even' : 'refined-odd'}">
                        <td class="refined-td refined-type">${escapeHtml(p.paymentType || '')}</td>
                        <td class="refined-td refined-price">${formatCurrency(p.amount || 0)}</td>
                        <td class="refined-td refined-date">${p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('ru-RU') : ''}</td>
                        <td class="refined-td refined-note">${escapeHtml(p.note || '')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ====== ФОТОГРАФИИ ======
function handleFilesLocal(files) {
    const orderId = parseInt(new URLSearchParams(window.location.search).get('id'));
    handleFiles(files, (file) => uploadAndDisplayPhoto(file, orderId));
}

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
        photoItem.querySelector('img').src = photoData.url || photoData.previewUrl;
        photoItem.querySelector('img').style.filter = 'none';
        photoItem.querySelector('img').onclick = () => openPhotoPreview(photoData.url || photoData.previewUrl, file.name);
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