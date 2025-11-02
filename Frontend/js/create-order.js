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

    setupNumberInputs();

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
        addPaymentBtn.addEventListener('click', () => addAdditionalPayment());
        // Инициализируем таблицу платежей при загрузке
        setTimeout(() => {
            initializePayments();
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

// Функция блокировки колесика и удаления стрелочек
function setupNumberInputs() {
    // Убираем стрелочки
    const style = document.createElement('style');
    style.textContent = `
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        input[type="number"] {
            -moz-appearance: textfield;
            appearance: textfield;
        }
    `;
    document.head.appendChild(style);
    
    // Блокируем колесико мыши для ВСЕХ числовых полей
    document.addEventListener('wheel', (e) => {
        if (e.target.type === 'number') {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Дополнительная блокировка при фокусе
    document.addEventListener('focusin', (e) => {
        if (e.target.type === 'number') {
            e.target.addEventListener('wheel', preventScroll, { passive: false });
        }
    });
    
    document.addEventListener('focusout', (e) => {
        if (e.target.type === 'number') {
            e.target.removeEventListener('wheel', preventScroll);
        }
    });
    
    function preventScroll(e) {
        e.preventDefault();
    }
    
    // Блокируем колесико для уже существующих полей
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
        input.addEventListener('wheel', preventScroll, { passive: false });
    });
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
            photoIds: order.photos ? order.photos.map(p => p.id) : []
        };
        
        populateForm('createOrderForm', originalOrderData);
        renderWorkItemsTable(order.workItems || []);
        
        // ВАЖНО: рендерим платежи СРАЗУ, без таймеров
        renderPaymentsTable(order.payments || []);
        
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
    
    // РАСЧИТЫВАЕМ актуальную сумму из workItems
    const workItems = collectWorkItems();
    const calculatedTotal = workItems.reduce((sum, item) => {
        return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
    }, 0);
    
    const data = {
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
        workItems: workItems,
        payments: collectPayments(),
        totalPrice: calculatedTotal, // ВАЖНО: отправляем РАССЧИТАННУЮ сумму
        tempUploadIds: getTempPhotoIds()
    };
    
    return data;
}

// Валидация данных
function validateForm(data) {
    // Проверка обязательных полей согласно CreateOrderRequest.cs
    if (!data.place || data.place.trim() === '') return 'Укажите участок';
    if (!data.deceasedFullName || data.deceasedFullName.trim() === '') return 'ФИО усопшего обязательно';
    if (!data.customerFullName || data.customerFullName.trim() === '') return 'ФИО заказчика обязательно';
    if (!data.address || data.address.trim() === '') return 'Адрес обязателен';
    if (!data.phone || data.phone.trim() === '') return 'Телефон обязателен';
    if (!data.monumentType || data.monumentType.trim() === '') return 'Тип памятника обязателен';
    if (!data.monumentSize || data.monumentSize.trim() === '') return 'Размер памятника обязателен';
    
    // Валидация email
    if (data.customerEmail && !isValidEmail(data.customerEmail)) {
        return 'Неверный формат email';
    }
    
    // Валидация телефона
    if (!isValidPhone(data.phone)) {
        return 'Неверный формат телефона';
    }
    
    // Валидация работ
    const workItemsError = validateWorkItems(data.workItems);
    if (workItemsError) return workItemsError;
    
    return null;
}

// Обработка создания/обновления заказа
async function handleOrderCreation(orderData) {
      try {
        
        let result;
        if (editingOrderId) {
            result = await apiService.updateOrder(editingOrderId, orderData);
        } else {
            result = await apiService.createOrder(orderData);
        }
        
        // Коммит фото только если есть временные фото
        if (tempUploads.length > 0) {
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
        console.error('Full error response:', error.data);
        showTempMessage('Ошибка сохранения: ' + (error.data?.message || error.message), 'error');
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
        return true;
    }
    
    for (let i = 0; i < originalPayments.length; i++) {
        const originalPayment = originalPayments[i];
        const currentPayment = currentPayments[i];
        
        if (originalPayment.paymentType !== currentPayment.paymentType ||
            originalPayment.amount !== currentPayment.amount ||
            originalPayment.paymentDate !== currentPayment.paymentDate ||
            originalPayment.note !== currentPayment.note) {
            return true;
        }
    }
    
    // 4. Проверяем изменения в фото (удаление существующих)
    // Для этого нужно чтобы originalData содержал массив ID фото
    const originalPhotoIds = originalData.photoIds || [];
    const currentServerPhotoIds = currentData.photoIds || [];
    
    if (originalPhotoIds.length !== currentServerPhotoIds.length) {
        return true;
    }
    
    // Проверяем что все оригинальные фото остались
    for (const photoId of originalPhotoIds) {
        if (!currentServerPhotoIds.includes(photoId)) {
            return true;
        }
    }
    
    // 5. Проверяем новые временные фото
    if (currentData.tempUploadIds && currentData.tempUploadIds.length > 0) {
        return true;
    }
    
    // 6. Глобальный флаг для любых других изменений (например удаление фото через кнопку)
    if (window.photoWasDeleted) {
        return true;
    }
    
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
        <td>
            <input type="number" name="price" value="${data.price || ''}" min="0" step="0.01" 
                   placeholder="Цена" class="no-spinners">
        </td>
        <td><input type="number" name="quantity" value="${data.quantity || 1}" min="1" placeholder="Кол-во"></td>
        <td><input type="text" name="note" value="${data.note || ''}" placeholder="Примечание"></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row">Удалить</button></td>
    `;

    // Добавляем обработчики
    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', calculateTotalPrice);
        input.addEventListener('change', calculateTotalPrice);
    });

    row.querySelector('.remove-row').addEventListener('click', () => {
        row.remove();
        calculateTotalPrice();
    });

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
function addPaymentRow(data = {}, isAdditionalPayment = false) {
    const tableBody = document.querySelector('#paymentsTable tbody');
    if (!tableBody) return;

    const today = getTodayDate();
    
    let paymentDateValue = data.paymentDate || today;
    if (paymentDateValue && paymentDateValue.includes('T')) {
        paymentDateValue = paymentDateValue.split('T')[0];
    }
    
    let paymentType = data.paymentType;
    if (!paymentType) {
        paymentType = isAdditionalPayment ? 'Доплата' : 'Аванс';
    }
    
    const row = tableBody.insertRow();
    row.innerHTML = `
        <td>
            <input type="hidden" name="paymentId" value="${data.id || ''}">
            <input type="text" name="paymentTypeDisplay" value="${paymentType}" 
                   class="form-control" readonly style="background-color: #f8f9fa;">
            <input type="hidden" name="paymentType" value="${paymentType}">
        </td>
        <td>
            <input type="number" name="amount" value="${data.amount || ''}" min="0" step="0.01" 
                   placeholder="0.00" class="form-control no-spinners">
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
            ${isAdditionalPayment ? 
                '<button type="button" class="btn btn-danger btn-sm remove-row">✕</button>' : 
                '<span class="text-muted">Основной</span>'
            }
        </td>
    `;

    if (isAdditionalPayment) {
        row.querySelector('.remove-row').addEventListener('click', () => {
            row.remove();
        });
    }
}

// Рендер таблицы платежей
function renderPaymentsTable(payments) {
    const tableBody = document.querySelector('#paymentsTable tbody');
    if (!tableBody) {
        console.error('Таблица платежей не найдена!');
        return;
    }
    
    
    tableBody.innerHTML = '';
    
    if (payments && payments.length > 0) {
        
        // Просто рендерим все платежи в том порядке, в котором они пришли
        payments.forEach((payment, index) => {
            // Первый платеж - аванс, остальные - доплаты
            const isAdditionalPayment = index > 0;
            addPaymentRow(payment, isAdditionalPayment);
        });
        
    } else {
        addPaymentRow({}, false);
    }
    
    // Сразу проверяем результат
    const renderedRows = document.querySelectorAll('#paymentsTable tbody tr');
}

// Сбор платежей
function collectPayments() {
    const rows = document.querySelectorAll('#paymentsTable tbody tr');
    const payments = [];
    
    rows.forEach(row => {
        const typeInput = row.querySelector('input[name="paymentType"]');
        const amountInput = row.querySelector('[name="amount"]');
        const dateInput = row.querySelector('[name="paymentDate"]');
        const noteInput = row.querySelector('[name="note"]');
        
        const paymentType = typeInput ? typeInput.value : 'Аванс';
        const amount = amountInput ? parseFloat(amountInput.value) || 0 : 0;
        const paymentDate = dateInput ? dateInput.value : getTodayDate();
        const note = noteInput ? noteInput.value.trim() : '';
        
        // Преобразуем дату в ISO формат для бэка
        let isoDate;
        try {
            isoDate = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
        } catch {
            isoDate = new Date().toISOString();
        }
        
        payments.push({
            paymentType: paymentType,
            amount: amount,
            paymentDate: isoDate,
            note: note || ""
        });
    });
    
    return payments;
}

// функция инициализации платежей
function initializePayments() {
    const tableBody = document.querySelector('#paymentsTable tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Всегда добавляем строку для аванса по умолчанию
    addPaymentRow({}, false); // isAdditionalPayment = false
    
    // Обновляем текст кнопки
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.textContent = 'Добавить доплату';
        addPaymentBtn.title = 'Добавить дополнительный платеж';
    }
}

// функция для добавления ДОПЛАТЫ
function addAdditionalPayment() {
    addPaymentRow({}, true);
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
    
    for (let i = 0; i < items.length; i++) {
        const wi = items[i];
        if (!wi.workDescription || wi.workDescription.trim() === '') {
            return `Работа #${i + 1}: описание обязательно`;
        }
        if (wi.price <= 0) {
            return `Работа #${i + 1}: стоимость должна быть больше 0`;
        }
        if (wi.quantity < 1) {
            return `Работа #${i + 1}: количество должно быть не менее 1`;
        }
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