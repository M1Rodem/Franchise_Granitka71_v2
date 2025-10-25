// create-order.js
let editingOrderId = null;
let tempPhotos = [];
let orderPhotos = [];

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

    const form = document.getElementById('createOrderForm');
    const errorEl = document.getElementById('formError');
    const successEl = document.getElementById('formSuccess');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }

    // Обработчик для input файлов
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFiles(e.target.files, uploadAndDisplayPhoto);
            }
            e.target.value = ''; // Сбрасываем input
        });
    }

    // 🔥 ИСПРАВЛЕНИЕ: Проверяем кнопки перед добавлением обработчиков
    const addWorkBtn = document.getElementById('addWorkItemBtn');
    if (addWorkBtn) {
        addWorkBtn.addEventListener('click', () => addWorkItemRow());
        // Автоматически добавляем первую строку при загрузке
        addWorkItemRow();
    } else {
        console.warn('Кнопка addWorkItemBtn не найдена');
    }

    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', () => addPaymentRow());
    } else {
        console.warn('Кнопка addPaymentBtn не найдена');
    }
    // Настройка drag & drop (если элемент существует)
    const uploadArea = document.getElementById('photoUploadArea');
    if (uploadArea) {
        setupDragAndDrop('photoUploadArea', uploadAndDisplayPhoto);
    }

    // Режим редактирования
    const params = new URLSearchParams(window.location.search);
    const editId = parseInt(params.get('edit'), 10);
    if (editId) {
        editingOrderId = editId;
        try {
            await loadOrderForEdit(editId);
            const pageTitle = document.getElementById('pageTitle');
            const submitBtn = document.getElementById('submitBtn');
            if (pageTitle) pageTitle.textContent = 'Редактировать заказ';
            if (submitBtn) submitBtn.textContent = 'Сохранить изменения';
        } catch (e) {
            showMessage(errorEl, e.message || 'Не удалось загрузить заказ для редактирования');
        }
    }

    // 🔥 ИСПРАВЛЕНИЕ: Проверяем форму перед добавлением обработчика
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (errorEl) hideMessage(errorEl);
            if (successEl) hideMessage(successEl);

            const submitBtn = document.getElementById('submitBtn');
            if (!submitBtn) return;

            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Сохранение...';

            try {
                const orderData = collectFormData();
                const validationError = validate(orderData);
                if (validationError) {
                    showMessage(errorEl, validationError);
                    return;
                }

                const result = await handleOrderCreation(orderData);
                
                if (editingOrderId) {
                    showMessage(successEl, 'Изменения сохранены');
                    setTimeout(() => {
                        window.location.href = `view-order.html?id=${editingOrderId}`;
                    }, 1000);
                } else {
                    showMessage(successEl, `Заказ создан: ${result.orderNumber || result.id}`);
                    setTimeout(() => {
                        window.location.href = 'orders.html';
                    }, 1500);
                }
            } catch (err) {
                console.error('Error creating order:', err);
                showMessage(errorEl, err.message || 'Ошибка при сохранении');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    } else {
        console.error('Форма createOrderForm не найдена');
    }
});

// Добавляем определение функции addWorkItemRow
function addWorkItemRow(workItem = {}) {
    const container = document.getElementById('workItemsContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'work-item-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '2fr 1fr 1fr 2fr auto';
    row.style.gap = '0.5rem';
    row.style.marginBottom = '0.5rem';
    row.innerHTML = `
        <input type="text" placeholder="Вид работы" class="wi-desc" value="${escapeHtml(workItem.workDescription || '')}">
        <input type="number" placeholder="Цена" min="0" step="1" class="wi-price" value="${workItem.price || ''}">
        <input type="number" placeholder="Кол-во" min="1" step="1" class="wi-qty" value="${workItem.quantity || 1}">
        <input type="text" placeholder="Примечание" class="wi-note" value="${escapeHtml(workItem.note || '')}">
        <button type="button" class="btn btn-danger btn-sm wi-remove">✖</button>
    `;
    container.appendChild(row);

    const recalc = () => recalcTotalFromItems();
    row.querySelector('.wi-price').addEventListener('input', recalc);
    row.querySelector('.wi-qty').addEventListener('input', recalc);
    row.querySelector('.wi-remove').addEventListener('click', () => {
        row.remove();
        recalcTotalFromItems();
    });
}

// ====== ФОТОГРАФИИ ======
async function uploadAndDisplayPhoto(file) {
    const preview = document.getElementById('photoPreview');
    const photoId = 'temp_' + Date.now();
    
    // Создаем превью
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item uploading';
    photoItem.id = photoId;
    
    const objectUrl = URL.createObjectURL(file);
    
    photoItem.innerHTML = `
        <img src="${objectUrl}" alt="Загрузка..." style="filter: brightness(0.7); cursor: pointer;">
        <div class="photo-progress">Загрузка...</div>
        <button class="photo-remove" onclick="removePhoto('${photoId}')">✖</button>
    `;
    preview.appendChild(photoItem);
    
    try {
        const photoData = await apiService.uploadTempPhoto(file);
        
        // Получаем авторизованный URL
        const previewUrl = await apiService.getAuthorizedTempPreview(photoData.id);
        
        // Сохраняем данные
        tempPhotos.push({
            id: photoData.id,
            tempId: photoId,
            fileName: file.name
        });
        
        // Обновляем превью
        photoItem.classList.remove('uploading');
        const img = photoItem.querySelector('img');
        img.src = previewUrl;
        img.style.filter = 'none';
        img.onclick = () => openPhotoPreview(previewUrl, file.name);
        
        photoItem.querySelector('.photo-progress').remove();
        photoItem.dataset.serverId = photoData.id;
        
        // Освобождаем локальный URL
        URL.revokeObjectURL(objectUrl);
        
        showTempMessage(`Фото "${file.name}" загружено`, 'success');
        
    } catch (error) {
        URL.revokeObjectURL(objectUrl);
        photoItem.remove();
        console.error('❌ Ошибка загрузки фото:', error);
        showTempMessage('Ошибка загрузки фото: ' + error.message, 'error');
    }
}

async function removePhoto(photoId) {
    if (!confirm('Удалить фото?')) return;
    
    const photoItem = document.getElementById(photoId);
    if (!photoItem) return;
    
    const serverId = photoItem.dataset.serverId;
    const isTemp = photoId.startsWith('temp_');
    
    try {
        if (serverId) {
            if (isTemp) {
                await apiService.deleteTempPhoto(serverId);
                tempPhotos = tempPhotos.filter(p => p.tempId !== photoId);
            } else {
                await apiService.deletePhoto(serverId);
                orderPhotos = orderPhotos.filter(p => p.id != serverId);
            }
        }
        
        photoItem.remove();
        showTempMessage('Фото удалено', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка удаления фото:', error);
        if (error.status === 404) {
            // Если не найден на сервере, все равно удаляем из UI
            if (isTemp) {
                tempPhotos = tempPhotos.filter(p => p.tempId !== photoId);
            } else {
                orderPhotos = orderPhotos.filter(p => p.id != serverId);
            }
            photoItem.remove();
            showTempMessage('Фото удалено (уже не существовало на сервере)', 'success');
        } else {
            showTempMessage('Ошибка удаления фото: ' + error.message, 'error');
        }
    }
}

// ====== ОСНОВНАЯ ЛОГИКА ======
function collectFormData() {
    const parseNumber = (elId) => {
        const v = document.getElementById(elId)?.value.trim() ?? '';
        if (v === '') return 0;
        const num = Number(v);
        return Number.isFinite(num) ? num : 0;
    };

    const workItems = readWorkItems();
    const total = workItems.reduce((sum, wi) => sum + (Number(wi.price) * (Number(wi.quantity) || 1)), 0);
    const manualTotal = parseNumber('totalPrice');
    const finalTotal = manualTotal > 0 ? manualTotal : total;

    const data = {
        customerFullName: document.getElementById('customerFullName')?.value.trim() ?? '',
        phone: normalizePhone(document.getElementById('phone')?.value),
        customerEmail: document.getElementById('customerEmail')?.value.trim() ?? null,
        deceasedFullName: document.getElementById('deceasedFullName')?.value.trim() ?? null,
        place: document.getElementById('place')?.value.trim() ?? null,
        address: document.getElementById('address')?.value.trim() ?? null,
        additionalInfo: document.getElementById('additionalInfo')?.value.trim() ?? null,
        monument: document.getElementById('monument')?.value.trim() ?? null,
        monumentSize: document.getElementById('monumentSize')?.value.trim() ?? null,
        totalPrice: finalTotal,
        workItems: workItems.filter(wi => wi.workDescription),
        payments: buildPayments()
    };

    return data;
}

function readWorkItems() {
    const rows = Array.from(document.querySelectorAll('#workItemsContainer .work-item-row'));
    return rows.map(r => ({
        workDescription: r.querySelector('.wi-desc')?.value.trim() ?? '',
        price: Number(r.querySelector('.wi-price')?.value) || 0,
        quantity: parseInt(r.querySelector('.wi-qty')?.value, 10) || 1,
        note: r.querySelector('.wi-note')?.value.trim() ?? ''
    })).filter(wi => wi.workDescription || wi.price > 0 || wi.note);
}

function recalcTotalFromItems() {
    const items = readWorkItems();
    const total = items.reduce((sum, wi) => sum + (Number(wi.price) * (Number(wi.quantity) || 1)), 0);
    setTotalPrice(total);
}

function setTotalPrice(total) {
    const el = document.getElementById('totalPrice');
    if (el) el.value = String((Math.round(total * 100) / 100).toFixed(2));
}

// ====== Платежи ======
function addPaymentRow(payment = {}) {
    const container = document.getElementById('additionalPaymentsContainer');
    const row = document.createElement('div');
    row.className = 'payment-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 1fr 2fr auto';
    row.style.gap = '0.5rem';
    row.style.marginBottom = '0.5rem';
    row.innerHTML = `
        <input type="number" placeholder="Сумма" min="0" step="0.01" class="pm-amount" value="${payment.amount || ''}">
        <input type="date" class="pm-date" value="${payment.paymentDate ? new Date(payment.paymentDate).toISOString().slice(0,10) : ''}">
        <input type="text" placeholder="Примечание" class="pm-note" value="${escapeHtml(payment.note || '')}">
        <button type="button" class="btn btn-danger btn-sm pm-remove">✖</button>
    `;
    container.appendChild(row);
    row.querySelector('.pm-remove').addEventListener('click', () => row.remove());
}

function buildPayments() {
    const payments = [];
    // Аванс
    const advAmount = Number(document.getElementById('advanceAmount')?.value ?? 0);
    const advDate = document.getElementById('advanceDate')?.value ?? '';
    const advNote = document.getElementById('advanceNote')?.value?.trim() ?? '';
    if (Number.isFinite(advAmount) && advAmount > 0) {
        const p = { amount: advAmount, paymentType: 'Аванс', note: advNote };
        if (advDate) p.paymentDate = advDate;
        payments.push(p);
    }
    // Доплаты
    const rows = Array.from(document.querySelectorAll('#additionalPaymentsContainer .payment-row'));
    for (const r of rows) {
        const amount = Number(r.querySelector('.pm-amount')?.value ?? 0);
        const date = r.querySelector('.pm-date')?.value ?? '';
        const note = r.querySelector('.pm-note')?.value?.trim() ?? '';
        if (Number.isFinite(amount) && amount > 0) {
            const p = { amount, paymentType: 'Доплата', note };
            if (date) p.paymentDate = date;
            payments.push(p);
        }
    }
    return payments;
}

// ====== Загрузка данных для редактирования ======
async function loadOrderForEdit(id) {
    const order = await apiService.getOrder(id);
    // Основные поля
    document.getElementById('customerFullName').value = order.customerFullName || '';
    document.getElementById('phone').value = order.phone || '';
    document.getElementById('customerEmail').value = order.customerEmail || '';
    document.getElementById('deceasedFullName').value = order.deceasedFullName || '';
    document.getElementById('place').value = order.place || '';
    document.getElementById('address').value = order.address || '';
    document.getElementById('additionalInfo').value = order.additionalInfo || '';
    document.getElementById('monument').value = order.monument || '';
    document.getElementById('monumentSize').value = order.monumentSize || '';
    setTotalPrice(order.totalPrice || 0);

    // Работы
    const container = document.getElementById('workItemsContainer');
    container.innerHTML = '';
    const items = Array.isArray(order.workItems) ? order.workItems : [];
    if (items.length === 0) {
        addWorkItemRow();
    } else {
        for (const wi of items) {
            addWorkItemRow(wi);
        }
    }

    // Платежи: один аванс (первый с типом Аванс), остальные — доплаты
    const adv = (order.payments||[]).find(p => (p.paymentType||'').toLowerCase() === 'аванс');
    if (adv) {
        document.getElementById('advanceAmount').value = Number(adv.amount||0);
        document.getElementById('advanceDate').value = adv.paymentDate ? new Date(adv.paymentDate).toISOString().slice(0,10) : '';
        document.getElementById('advanceNote').value = adv.note || '';
    } else {
        document.getElementById('advanceAmount').value = '';
        document.getElementById('advanceDate').value = '';
        document.getElementById('advanceNote').value = '';
    }
    const additional = (order.payments||[]).filter(p => (p.paymentType||'').toLowerCase() !== 'аванс');
    const payContainer = document.getElementById('additionalPaymentsContainer');
    payContainer.innerHTML = '';
    for (const p of additional) {
        addPaymentRow(p);
    }

    try {
        const existingPhotos = await apiService.getOrderPhotos(id);
        orderPhotos = existingPhotos || [];
        renderExistingPhotos();
    } catch (error) {
        console.error('Ошибка загрузки фото заказа:', error);
    }
}

function renderExistingPhotos() {
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = '';
    
    orderPhotos.forEach(photo => {
        const photoId = 'photo_' + photo.id;
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.id = photoId;
        
        // Используем URL от сервера или создаем endpoint
        const imgUrl = photo.url ? `${API_BASE_URL.replace('/api', '')}${photo.url}` : 
                                  `${API_BASE_URL}/Photos/${photo.id}/file`;
        
        photoItem.innerHTML = `
            <img src="${imgUrl}" alt="${photo.originalFileName}" 
                 style="cursor: pointer; max-height: 150px; object-fit: cover;"
                 onclick="openPhotoPreview('${imgUrl}', '${photo.originalFileName}')">
            <button class="photo-remove" onclick="removePhoto('${photoId}')">✖</button>
        `;
        photoItem.dataset.serverId = photo.id;
        preview.appendChild(photoItem);
    });
}

function validate(data) {
    if (!data.customerFullName) return 'Укажите ФИО заказчика';
    if (!data.phone) return 'Укажите телефон';
    if (!/^\d{11}$/.test(data.phone)) return 'Телефон должен содержать ровно 11 цифр';
    if (data.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) return 'Некорректный email заказчика';
    
    // Валидация работ (если введены частично)
    const items = data.workItems || [];
    for (const wi of items) {
        if (!wi.workDescription) return 'У каждой работы должно быть описание';
        if (wi.price < 0) return 'Стоимость работы не может быть отрицательной';
        if (wi.quantity < 1) return 'Количество должно быть ≥ 1';
    }
    
    return '';
}

// Добавляем функцию handleOrderCreation
async function handleOrderCreation(orderData) {
    let result;
    if (editingOrderId) {
        result = await apiService.updateOrder(editingOrderId, orderData);
        if (tempPhotos.length > 0) {
            const tempIds = tempPhotos.map(p => p.id);
            await apiService.commitPhotos(editingOrderId, tempIds);
            tempPhotos = [];
        }
    } else {
        result = await apiService.createOrder(orderData);
        if (tempPhotos.length > 0) {
            const tempIds = tempPhotos.map(p => p.id);
            await apiService.commitPhotos(result.id, tempIds);
            tempPhotos = [];
        }
    }
    return result;
}

// Добавляем вспомогательные функции, если они отсутствуют
function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function showMessage(el, text) {
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
}

function hideMessage(el) {
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
}

function showTempMessage(message, type = 'success') {
    const el = document.createElement('div');
    el.textContent = message;
    el.style.position = 'fixed';
    el.style.top = '20px';
    el.style.right = '20px';
    el.style.padding = '1rem';
    el.style.borderRadius = '4px';
    el.style.color = 'white';
    el.style.background = type === 'success' ? '#28a745' : '#dc3545';
    el.style.zIndex = '10000';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}