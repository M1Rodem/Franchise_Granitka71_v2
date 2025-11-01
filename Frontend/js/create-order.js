import { apiService } from './api.js';
import { formatCurrency, getTodayDate, isValidEmail, isValidPhone, populateForm, clearForm, getFormValue, showTempMessage } from './utils.js';
import { setupDragAndDrop, handlePhotoSelect, uploadTempAndDisplay, renderPhotoGrid, tempUploads, clearTempPhotos, attachPhotoEvents, getTempPhotoIds, loadAndCleanupTemp } from './photo-utils.js';

let editingOrderId = null;
let orderPhotos = [];  // Для edit mode
let workItemsCount = 0;  // Счётчик строк работ (не используется явно, но оставим)

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
        addWorkItemRow();
        calculateTotalPrice(); 
    }

    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', addPaymentRow);
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
        populateForm('createOrderForm', {
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
        });

        // Таблицы
        renderWorkItemsTable(order.workItems || []);
        renderPaymentsTable(order.payments || []);
        calculateTotalPrice();

        // Фото для edit (один раз, внутри try)
        orderPhotos = order.photos || [];  // Глобал для хранения
        renderPhotoGrid(orderPhotos, 'photoPreview', 'edit');
        
        showTempMessage('Заказ загружен для редактирования', 'success');  // Опционально: UX
    } catch (error) {
        console.error('Load order error:', error);
        showTempMessage('Ошибка загрузки заказа: ' + error.message, 'error');
        // Опционально: Редирект назад
        // window.location.href = 'orders.html';
    }
}

// Сбор данных формы
function collectFormData() {
    return {
        place: getFormValue('place'),
        inspectionPlace: getFormValue('inspectionPlace'),
        orderDate: getFormValue('orderDate'),
        deceasedFullName: getFormValue('deceasedFullName'),
        customerFullName: getFormValue('customerFullName'),
        customerEmail: getFormValue('customerEmail'),
        phone: getFormValue('phone'),
        address: getFormValue('address'),
        monumentType: getFormValue('monumentType'),
        monumentSize: getFormValue('monumentSize'),
        additionalInfo: getFormValue('additionalInfo'),
        workItems: collectWorkItems(),
        totalPrice: parseFloat(document.getElementById('totalPriceInput')?.value) || calculateTotalPrice(),
        payments: collectPayments(),
        tempUploadIds: getTempPhotoIds()  // Массив ID для коммита
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

    // Work items - ИСПРАВЛЕННАЯ ПРОВЕРКА
    const items = data.workItems || []; // Защита от undefined
    if (!items || items.length === 0) return 'Добавьте хотя бы одну работу (описание + цена > 0)';
    
    for (const wi of items) {
        if (!wi.workDescription || wi.workDescription.length === 0) return 'Описание работы обязательно';
        if (wi.price <= 0) return 'Стоимость > 0';
        if (wi.quantity < 1) return 'Количество ≥ 1';
    }

    return null;
}

// Обработка создания/обновления заказа
async function handleOrderCreation(orderData) {
    try {
        let result;
        if (editingOrderId) {
            result = await apiService.updateOrder(editingOrderId, orderData);
            // Коммит temp фото если есть
            if (tempUploads.length > 0) {
                await apiService.commitPhotos(editingOrderId, tempUploads);
            }
        } else {
            result = await apiService.createOrder(orderData);  // Бэк закоммитит tempUploadIds автоматически
        }
        clearTempPhotos();  // Очистка temp после успеха
        showTempMessage(editingOrderId ? 'Заказ обновлён' : 'Заказ создан', 'success');
        // Редирект или обновление UI
        if (!editingOrderId) {
            clearForm('createOrderForm');
            window.location.href = 'orders.html';  // Или dashboard
        }
        return result;
    } catch (error) {
        console.error('Order creation error:', error);
        showTempMessage('Ошибка сохранения: ' + error.message, 'error');
        throw error;
    }
}

// Основная функция submit
async function submitForm() {
    const data = collectFormData();
    const validationError = validateForm(data);
    if (validationError) {
        showTempMessage(validationError, 'error');
        return;
    }

    try {
        await handleOrderCreation(data);
    } catch (error) {
        // Обработка уже в handleOrderCreation
    }
}

// ===== ТАБЛИЦЫ: WORK ITEMS =====

// Добавление строки работы
function addWorkItemRow(data = {}) {
    const tableBody = document.querySelector('#workItemsTable tbody');
    if (!tableBody) return;

    const row = tableBody.insertRow();
    row.innerHTML = `
        <td><input type="text" name="workDescription" value="${data.workDescription || ''}" placeholder="Описание работы"></td>
        <td><input type="number" name="price" value="${data.price || ''}" min="0" step="0.01" placeholder="Цена"></td>
        <td><input type="number" name="quantity" value="${data.quantity || 1}" min="1" placeholder="Кол-во"></td>
        <td><input type="text" name="note" value="${data.note || ''}" placeholder="Примечание"></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row">Удалить</button></td>
    `;

    // Фикс: Update total на любом input (desc/price/quantity/note — для UX)
    const inputs = row.querySelectorAll('input[name="workDescription"], input[name="price"], input[name="quantity"], input[name="note"]');
    inputs.forEach(input => input.addEventListener('input', calculateTotalPrice));

    // Удаление
    row.querySelector('.remove-row').addEventListener('click', () => {
        row.remove();
        calculateTotalPrice();
    });
}

// Рендер таблицы работ
function renderWorkItemsTable(items) {
    const tableBody = document.querySelector('#workItemsTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    (items || []).forEach(addWorkItemRow);
    calculateTotalPrice();
}

// Сбор работ
function collectWorkItems() {
    const rows = document.querySelectorAll('#workItemsTable tbody tr');
    return Array.from(rows)
        .map(row => {
            const descriptionEl = row.querySelector('[name="workDescription"]');
            const priceEl = row.querySelector('[name="price"]');
            const quantityEl = row.querySelector('[name="quantity"]');
            const noteEl = row.querySelector('[name="note"]');
            
            const workDescription = (descriptionEl ? descriptionEl.value : '').trim();
            const price = isNaN(parseFloat(priceEl ? priceEl.value : 0)) ? 0 : parseFloat(priceEl ? priceEl.value : 0);
            const quantity = parseInt(quantityEl ? quantityEl.value : '1') || 1;
            const note = (noteEl ? noteEl.value : '').trim();
            
            return { workDescription, price, quantity, note };
        })
        .filter(wi => wi.workDescription.length > 0 && wi.price > 0);
}


// ===== ТАБЛИЦЫ: PAYMENTS =====

// Добавление строки платежа
function addPaymentRow(data = {}) {
    const tableBody = document.querySelector('#paymentsTable tbody');
    if (!tableBody) return;

    const row = tableBody.insertRow();
    row.innerHTML = `
        <td><select name="paymentType">
            <option ${data.paymentType === 'Аванс' ? 'selected' : ''}>Аванс</option>
            <option ${data.paymentType === 'Доплата' ? 'selected' : ''}>Доплата</option>
        </select></td>
        <td><input type="number" name="amount" value="${data.amount || ''}" min="0" step="0.01" placeholder="Сумма" required></td>
        <td><input type="date" name="paymentDate" value="${data.paymentDate ? new Date(data.paymentDate).toISOString().slice(0, 10) : ''}" required></td>
        <td><input type="text" name="note" value="${data.note || ''}" placeholder="Примечание"></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row">Удалить</button></td>
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
    payments.forEach(addPaymentRow);
}

// Сбор платежей
function collectPayments() {
    const rows = document.querySelectorAll('#paymentsTable tbody tr');
    return Array.from(rows).map(row => ({
        paymentType: row.querySelector('[name="paymentType"]').value,
        amount: parseFloat(row.querySelector('[name="amount"]').value) || 0,
        paymentDate: row.querySelector('[name="paymentDate"]').value,
        note: row.querySelector('[name="note"]').value.trim()
    })).filter(p => p.amount > 0);  // Только с суммой > 0
}

// Расчёт общей суммы
function calculateTotalPrice(override = null) {
    let total;
    if (override !== null && !isNaN(override)) {
        total = override;
    } else {
        const items = collectWorkItems() || []; // Защита от undefined
        total = items.reduce((sum, wi) => sum + (wi.price * wi.quantity), 0);
    }
    
    if (isNaN(total)) {
        total = 0;
    }
    
    const totalInput = document.getElementById('totalPriceInput');
    if (totalInput) {
        totalInput.value = total.toFixed(2);
    }
    return total;
}

// Cleanup temp фото при выходе (если create mode и не сохранено)
window.addEventListener('beforeunload', async () => {
    if (tempUploads.length > 0 && !editingOrderId) {
        for (const tempId of tempUploads) {
            try {
                await apiService.deleteTempPhoto(tempId);
            } catch (error) {
                console.error('Cleanup temp photo error:', error);
            }
        }
    }
});

// Глобальные для legacy HTML (если нужно, иначе удали)
window.addWorkItemRow = addWorkItemRow;
window.addPaymentRow = addPaymentRow;
window.calculateTotalPrice = calculateTotalPrice;
window.removeRow = function(btn) { btn.closest('tr').remove(); calculateTotalPrice(); };  // Если onclick остался