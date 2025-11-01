import { apiService } from './api.js';
import { formatCurrency, getTodayDate, isValidEmail, isValidPhone, populateForm, clearForm, getFormValue, showTempMessage } from './utils.js';
import { setupDragAndDrop, handlePhotoSelect, uploadTempAndDisplay, renderPhotoGrid, tempUploads, clearTempPhotos, attachPhotoEvents, getTempPhotoIds, loadAndCleanupTemp } from './photo-utils.js';

let editingOrderId = null;
let orderPhotos = [];  // Для edit mode
let workItemsCount = 0;  // Счётчик строк работ (не используется явно, но оставим)
let originalOrderData = null;

// Инициализация страницы
document.addEventListener('DOMContentLoaded', async () => {
    await loadAndCleanupTemp();
    // Проверка авторизации
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Настройка UI для текущего пользователя
    await setupUserInterface();

    // Настройка даты по умолчанию
    setDefaultDate();

    // Настройка событий (logout, фото, таблицы, submit)
    setupEventListeners();

    // Режим редактирования, если есть параметр ?edit=id
    await checkEditMode();

    // Прикрепление событий для фото (delegation — без onclick в HTML)
    attachPhotoEvents('photoPreview');
});

// Настройка интерфейса пользователя (шапка, админ-элементы)
async function setupUserInterface() {
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

// Установка даты по умолчанию
function setDefaultDate() {
    const orderDateInput = document.getElementById('orderDate');
    if (orderDateInput && !orderDateInput.value) {
        orderDateInput.value = getTodayDate();
    }
}

// Настройка всех event listeners
function setupEventListeners() {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => apiService.logout());
    }

    // Фото: Input и Drag&Drop
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', (e) => handlePhotoSelect(e, uploadTempAndDisplay));
    }
    const uploadArea = document.getElementById('photoUploadArea');
    if (uploadArea) {
        setupDragAndDrop('photoUploadArea', uploadTempAndDisplay);
    }

    // Таблицы: Добавление строк
    const addWorkBtn = document.getElementById('addWorkItemBtn');
    if (addWorkBtn) {
        addWorkBtn.addEventListener('click', addWorkItemRow);
        addWorkItemRow(); // Добавляем первую строку по умолчанию
        setupWorkItemsTableEvents();
        calculateTotalPrice(); 
    }

    // ПЛАТЕЖИ - исправленная инициализация
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', () => addPaymentRow());
        // Инициализируем таблицу платежей при загрузке
        setTimeout(() => {
            renderPaymentsTable([]);
        }, 100);
    }

    // Submit формы
    const form = document.getElementById('createOrderForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitForm();
        });
    }
}

// Проверка режима редактирования
async function checkEditMode() {
    const params = new URLSearchParams(window.location.search);
    const editId = parseInt(params.get('edit'), 10);
    if (editId) {
        editingOrderId = editId;
        await loadOrderForEdit(editId);
        // Обновление UI для edit
        const pageTitle = document.getElementById('pageTitle');
        const submitBtn = document.getElementById('submitBtn');
        if (pageTitle) pageTitle.textContent = 'Редактировать заказ';
        if (submitBtn) submitBtn.textContent = 'Сохранить изменения';
    }
}

// Загрузка данных заказа для редактирования
async function loadOrderForEdit(id) {
    try {
        const order = await apiService.getOrder(id);
        
        originalOrderData = {
            place: order.place,
            inspectionPlace: order.inspectionPlace,
            orderDate: order.orderDate ? new Date(order.orderDate).toISOString().slice(0, 10) : getTodayDate(),
            deceasedFullName: order.deceasedFullName,
            customerFullName: order.customerFullName,
            customerEmail: order.customerEmail,
            phone: order.phone,
            address: order.address,
            monumentType: order.monumentType,
            monumentSize: order.monumentSize,
            additionalInfo: order.additionalInfo,
            workItems: order.workItems || [],
            payments: order.payments || [],
            photoIds: order.photos ? order.photos.map(p => p.id) : [] // СОХРАНИТЬ ID ФОТО
        };
        
        populateForm('createOrderForm', originalOrderData);
        renderWorkItemsTable(order.workItems || []);
        renderPaymentsTable(order.payments || []); // ЗАГРУЖАЕМ ПЛАТЕЖИ
        calculateTotalPrice();
        
        orderPhotos = order.photos || [];
        await renderPhotoGrid(orderPhotos, 'photoPreview', 'edit');
        
    } catch (error) {
        console.error('Load order error:', error);
        showTempMessage('Ошибка загрузки заказа: ' + error.message, 'error');
    }
}

// Сбор данных формы
function collectFormData() {
    const orderDateValue = getFormValue('orderDate');
    
    return {
        place: getFormValue('place'),
        inspectionPlace: getFormValue('inspectionPlace') || '',
        orderDate: orderDateValue ? new Date(orderDateValue).toISOString() : new Date().toISOString(),
        deceasedFullName: getFormValue('deceasedFullName'),
        customerFullName: getFormValue('customerFullName'),
        customerEmail: getFormValue('customerEmail') || '',
        phone: getFormValue('phone'),
        address: getFormValue('address'),
        monumentType: getFormValue('monumentType'),
        monumentSize: getFormValue('monumentSize'),
        additionalInfo: getFormValue('additionalInfo') || '',
        workItems: collectWorkItems(),
        payments: collectPayments(), // ВРЕМЕННО КОММЕНТИРУЕМ ДЛЯ ТЕСТА
        totalPrice: calculateTotalPrice(),
        tempUploadIds: getTempPhotoIds()
    };
}

// Валидация данных
function validateForm(data) {
    if (!data.place) return 'Укажите участок';
    if (!data.deceasedFullName) return 'ФИО усопшего обязательно';
    if (!data.customerFullName) return 'ФИО заказчика обязательно';
    if (data.customerEmail && !isValidEmail(data.customerEmail)) return 'Неверный email';
    if (!data.phone || !isValidPhone(data.phone)) return 'Неверный номер телефона';
    if (!data.address) return 'Адрес обязателен';
    if (!data.monumentType) return 'Тип памятника обязателен';
    if (!data.monumentSize) return 'Размер памятника обязателен';

    // Используем отдельную функцию валидации работ
    // const workItemsError = validateWorkItems(data.workItems);
    // if (workItemsError) return workItemsError;

    return null;
}

// Обработка создания/обновления заказа
async function handleOrderCreation(orderData) {
    try {
        console.log('Отправка заказа:', editingOrderId ? 'UPDATE' : 'CREATE');
        console.log('Данные заказа:', orderData);
        
        let result;
        if (editingOrderId) {
            result = await apiService.updateOrder(editingOrderId, orderData);
            console.log('Заказ обновлен:', result);
        } else {
            result = await apiService.createOrder(orderData);
            console.log('Заказ создан:', result);
        }
        
        // Коммит фото только если есть временные фото
        if (tempUploads.length > 0) {
            console.log('Коммит фото:', tempUploads);
            await apiService.commitPhotos(editingOrderId || result.id, tempUploads);
        }
        
        clearTempPhotos();
        
        const message = editingOrderId ? 'Заказ обновлён' : 'Заказ создан';
        showTempMessage(message, 'success');
        
        setTimeout(() => {
            if (editingOrderId) {
                window.location.href = `view-order.html?id=${editingOrderId}`;
            } else {
                window.location.href = 'orders.html';
            }
        }, 1500);
        
        return result;
    } catch (error) {
        console.error('Order creation error:', error);
        console.error('Error details:', error.data);
        showTempMessage('Ошибка сохранения: ' + error.message, 'error');
        throw error;
    }
}

function hasFormDataChanged(originalData, currentData) {
    // 1. Проверяем основные поля формы
    const fieldsToCompare = [
        'place', 'inspectionPlace', 'deceasedFullName',
        'customerFullName', 'customerEmail', 'phone', 'address',
        'monumentType', 'monumentSize', 'additionalInfo'
    ];
    
    for (const field of fieldsToCompare) {
        const originalValue = String(originalData[field] || '');
        const currentValue = String(currentData[field] || '');
        
        if (originalValue.trim() !== currentValue.trim()) {
            console.log(`Изменено поле: ${field}`, originalValue, '->', currentValue);
            return true;
        }
    }
    
    // 2. Проверяем WorkItems
    const normalizeWorkItem = (item) => ({
        workDescription: String(item.workDescription || '').trim(),
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        note: String(item.note || '').trim()
    });
    
    const originalItems = (originalData.workItems || []).map(normalizeWorkItem);
    const currentItems = (currentData.workItems || []).map(normalizeWorkItem);
    
    // Сравниваем количество и содержание
    if (originalItems.length !== currentItems.length) {
        return true;
    }
    
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
    
    // 3. Проверяем Payments
    const normalizePayment = (payment) => ({
        paymentType: String(payment.paymentType || '').trim(),
        amount: Number(payment.amount) || 0,
        paymentDate: String(payment.paymentDate || '').trim(),
        note: String(payment.note || '').trim()
    });
    
    const originalPayments = (originalData.payments || []).map(normalizePayment);
    const currentPayments = (currentData.payments || []).map(normalizePayment);
    
    if (originalPayments.length !== currentPayments.length) {
        console.log('Изменено количество Payments:', originalPayments.length, '->', currentPayments.length);
        return true;
    }
    
    for (let i = 0; i < originalPayments.length; i++) {
        const originalPayment = originalPayments[i];
        const currentPayment = currentPayments[i];
        
        if (originalPayment.paymentType !== currentPayment.paymentType ||
            originalPayment.amount !== currentPayment.amount ||
            originalPayment.paymentDate !== currentPayment.paymentDate ||
            originalPayment.note !== currentPayment.note) {
            console.log('Изменен Payment:', originalPayment, '->', currentPayment);
            return true;
        }
    }
    
    // 4. Проверяем изменения в фото (удаление существующих)
    // Для этого нужно чтобы originalData содержал массив ID фото
    const originalPhotoIds = originalData.photoIds || [];
    const currentServerPhotoIds = currentData.photoIds || [];
    
    if (originalPhotoIds.length !== currentServerPhotoIds.length) {
        console.log('Удалены фото:', originalPhotoIds.length, '->', currentServerPhotoIds.length);
        return true;
    }
    
    // Проверяем что все оригинальные фото остались
    for (const photoId of originalPhotoIds) {
        if (!currentServerPhotoIds.includes(photoId)) {
            console.log('Удалено фото с ID:', photoId);
            return true;
        }
    }
    
    // 5. Проверяем новые временные фото
    if (currentData.tempUploadIds && currentData.tempUploadIds.length > 0) {
        console.log('Добавлены новые фото:', currentData.tempUploadIds.length);
        return true;
    }
    
    // 6. Глобальный флаг для любых других изменений (например удаление фото через кнопку)
    if (window.photoWasDeleted) {
        console.log('Фото было удалено через кнопку');
        return true;
    }
    
    console.log('Изменений не обнаружено');
    return false;
}


// Основная функция submit
async function submitForm() {
    const data = collectFormData();
    const validationError = validateForm(data);
    if (validationError) {
        showTempMessage(validationError, 'error');
        return;
    }

    // ПРОВЕРКА ИЗМЕНЕНИЙ ДЛЯ РЕДАКТИРОВАНИЯ
    if (editingOrderId && originalOrderData) {
        if (!hasFormDataChanged(originalOrderData, data)) {
            // НЕТ ИЗМЕНЕНИЙ - редирект
            showTempMessage('Нет изменений для сохранения', 'info');
            setTimeout(() => {
                window.location.href = `view-order.html?id=${editingOrderId}`;
            }, 1500);
            return;
        } else {
            // ЕСТЬ ИЗМЕНЕНИЯ - отправляем на сервер БЕЗ автоматического редиректа
            try {
                await handleOrderCreation(data);
                // Редирект будет в handleOrderCreation после успешного сохранения
            } catch (error) {
                // Обработка ошибки
            }
            return;
        }
    }

    // СОЗДАНИЕ НОВОГО ЗАКАЗА
    try {
        await handleOrderCreation(data);
    } catch (error) {
        // Обработка ошибки
    }
}

// ===== ТАБЛИЦЫ: WORK ITEMS =====

// Добавление строки работы
function addWorkItemRow(data = {}) {
    const tableBody = document.querySelector('#workItemsTable tbody');
    if (!tableBody) return;

    const row = tableBody.insertRow();
    row.innerHTML = `
        <td>
            <input type="hidden" name="workItemId" value="${data.id || ''}">
            <input type="text" name="workDescription" value="${data.workDescription || ''}" placeholder="Описание работы">
        </td>
        <td><input type="number" name="price" value="${data.price || ''}" min="0" step="0.01" placeholder="Цена"></td>
        <td><input type="number" name="quantity" value="${data.quantity || 1}" min="1" placeholder="Кол-во"></td>
        <td><input type="text" name="note" value="${data.note || ''}" placeholder="Примечание"></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row">Удалить</button></td>
    `;

    // Добавляем обработчики на ВСЕ поля ввода в строке
    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', calculateTotalPrice);
        input.addEventListener('change', calculateTotalPrice);
    });

    // Удаление строки
    row.querySelector('.remove-row').addEventListener('click', () => {
        row.remove();
        calculateTotalPrice();
    });

    // Сразу пересчитываем сумму после добавления строки
    calculateTotalPrice();
}

// Рендер таблицы работ
function renderWorkItemsTable(items) {
    const tableBody = document.querySelector('#workItemsTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    (items || []).forEach(addWorkItemRow);
    
    // Добавляем глобальные обработчики на всю таблицу
    setupWorkItemsTableEvents();
    calculateTotalPrice();
}

function setupWorkItemsTableEvents() {
    const tableBody = document.querySelector('#workItemsTable tbody');
    if (!tableBody) return;

    // Обработчик для всех изменений в таблице (делегирование событий)
    tableBody.addEventListener('input', (e) => {
        if (e.target.matches('input[name="workDescription"], input[name="price"], input[name="quantity"], input[name="note"]')) {
            calculateTotalPrice();
        }
    });

    tableBody.addEventListener('change', (e) => {
        if (e.target.matches('input[name="price"], input[name="quantity"]')) {
            calculateTotalPrice();
        }
    });
}

// Сбор работ
function collectWorkItems() {
    const rows = document.querySelectorAll('#workItemsTable tbody tr');
    return Array.from(rows)
        .map(row => {
            const idEl = row.querySelector('[name="workItemId"]');
            const descriptionEl = row.querySelector('[name="workDescription"]');
            const priceEl = row.querySelector('[name="price"]');
            const quantityEl = row.querySelector('[name="quantity"]');
            const noteEl = row.querySelector('[name="note"]');
            
            const id = idEl ? parseInt(idEl.value) || 0 : 0;
            const workDescription = (descriptionEl ? descriptionEl.value : '').trim();
            const price = isNaN(parseFloat(priceEl ? priceEl.value : 0)) ? 0 : parseFloat(priceEl ? priceEl.value : 0);
            const quantity = parseInt(quantityEl ? quantityEl.value : '1') || 1;
            const note = (noteEl ? noteEl.value : '').trim();
            
            return { 
                id: id, // Добавляем ID
                workDescription, 
                price, 
                quantity, 
                note 
            };
        });
}

// ===== ТАБЛИЦЫ: PAYMENTS =====

// Добавление строки платежа
function addPaymentRow(data = {}) {
    const tableBody = document.querySelector('#paymentsTable tbody');
    if (!tableBody) return;

    const today = getTodayDate();
    
    // Преобразуем дату из ISO формата в yyyy-MM-dd для input[type="date"]
    let paymentDateValue = data.paymentDate || today;
    if (paymentDateValue && paymentDateValue.includes('T')) {
        // Если дата в ISO формате, извлекаем часть yyyy-MM-dd
        paymentDateValue = paymentDateValue.split('T')[0];
    }
    
    const row = tableBody.insertRow();
    row.innerHTML = `
        <td>
            <input type="hidden" name="paymentId" value="${data.id || ''}">
            <select name="paymentType" class="form-control">
                <option value="">Выберите тип</option>
                <option value="Аванс" ${data.paymentType === 'Аванс' ? 'selected' : ''}>Аванс</option>
                <option value="Доплата" ${data.paymentType === 'Доплата' ? 'selected' : ''}>Доплата</option>
                <option value="Полная оплата" ${data.paymentType === 'Полная оплата' ? 'selected' : ''}>Полная оплата</option>
            </select>
        </td>
        <td>
            <input type="number" name="amount" value="${data.amount || ''}" min="0" step="0.01" 
                   placeholder="0.00" class="form-control">
        </td>
        <td>
            <input type="date" name="paymentDate" value="${paymentDateValue}" 
                   class="form-control">
        </td>
        <td>
            <input type="text" name="note" value="${data.note || ''}" 
                   placeholder="Примечание" class="form-control">
        </td>
        <td>
            <button type="button" class="btn btn-danger btn-sm remove-row">✕</button>
        </td>
    `;

    // Удаление строки
    row.querySelector('.remove-row').addEventListener('click', () => {
        row.remove();
    });
}

// Рендер таблицы платежей
function renderPaymentsTable(payments) {
    const tableBody = document.querySelector('#paymentsTable tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (payments && payments.length > 0) {
        payments.forEach(payment => addPaymentRow(payment));
    } else {
        // Добавляем одну пустую строку по умолчанию
        addPaymentRow();
    }
}

// Сбор платежей
function collectPayments() {
    const rows = document.querySelectorAll('#paymentsTable tbody tr');
    const payments = [];
    
    rows.forEach(row => {
        const typeSelect = row.querySelector('[name="paymentType"]');
        const amountInput = row.querySelector('[name="amount"]');
        const dateInput = row.querySelector('[name="paymentDate"]');
        const noteInput = row.querySelector('[name="note"]');
        
        const paymentType = typeSelect ? typeSelect.value : '';
        const amount = amountInput ? parseFloat(amountInput.value) || 0 : 0;
        const paymentDate = dateInput ? dateInput.value : getTodayDate();
        const note = noteInput ? noteInput.value.trim() : '';
        
        if (paymentType && amount > 0) {
            payments.push({
                paymentType: paymentType,
                amount: amount,
                paymentDate: paymentDate, // оставляем как yyyy-MM-dd
                note: note || ""
            });
        }
    });
    
    return payments;
}

// Расчёт общей суммы
function calculateTotalPrice() {
    const items = collectWorkItems() || [];
    
    // Рассчитываем сумму по ВСЕМ строкам, даже незаполненным
    let total = items.reduce((sum, wi) => {
        const itemTotal = (wi.price || 0) * (wi.quantity || 1);
        return sum + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
    
    if (isNaN(total)) {
        total = 0;
    }
    
    const totalInput = document.getElementById('totalPriceInput');
    if (totalInput) {
        totalInput.value = total.toFixed(2);
    }
    
    // Обновляем отображение итоговой суммы если есть отдельный элемент
    const totalDisplay = document.getElementById('totalPriceDisplay');
    if (totalDisplay) {
        totalDisplay.textContent = formatCurrency(total);
    }
    
    return total;
}

function validateWorkItems(items) {
    if (!items || items.length === 0) return 'Добавьте хотя бы одну работу';
    
    const validItems = items.filter(wi => 
        wi.workDescription && wi.workDescription.length > 0 && wi.price > 0
    );
    
    if (validItems.length === 0) return 'Добавьте хотя бы одну работу (описание + цена > 0)';
    
    for (const wi of validItems) {
        if (!wi.workDescription || wi.workDescription.length === 0) return 'Описание работы обязательно';
        if (wi.price <= 0) return 'Стоимость должна быть больше 0';
        if (wi.quantity < 1) return 'Количество должно быть не менее 1';
    }
    
    return null;
}

// Cleanup temp фото при выходе (если create mode и не сохранено)
window.addEventListener('beforeunload', () => {
    document.querySelectorAll('.photo-img').forEach(img => {
        if (img.src && img.src.startsWith('blob:')) {
            URL.revokeObjectURL(img.src);
        }
            if (typeof cleanupPhotoBlobs === 'function') {
            cleanupPhotoBlobs();
        }
    });
});

// Глобальные для legacy HTML (если нужно, иначе удали)
window.addWorkItemRow = addWorkItemRow;
window.addPaymentRow = addPaymentRow;
window.calculateTotalPrice = calculateTotalPrice;
window.removeRow = function(btn) { btn.closest('tr').remove(); calculateTotalPrice(); };  // Если onclick остался