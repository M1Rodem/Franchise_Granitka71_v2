import { apiService } from './api.js';
import { formatCurrency, getTodayDate, isValidEmail, isValidPhone, populateForm, clearForm, getFormValue, setFormValue, showTempMessage } from './utils.js';
import { setupDragAndDrop, handlePhotoSelect, uploadTempAndDisplay, renderPhotoGrid } from './photo-utils.js';
import { ModalUtils } from './modal-utils.js';

let editingOrderId = null;
let tempPhotos = [];
let orderPhotos = [];

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const userData = apiService.getCurrentUser();
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = userData.fullName || 'Пользователь';

    // Показать админ-элементы (включая вкладку "Пользователи")
    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = 'block';
        });
    }

    // Дата по умолчанию
    const orderDateInput = document.getElementById('orderDate');
    if (orderDateInput && !orderDateInput.value) {
        orderDateInput.value = getTodayDate();
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => apiService.logout());
    }

    // Фото: Input + Drag&Drop
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', (e) => handlePhotoSelect(e, uploadTempAndDisplay));
    }
    const uploadArea = document.getElementById('photoUploadArea');
    if (uploadArea) {
        setupDragAndDrop('photoUploadArea', uploadTempAndDisplay);
    }

    // Таблицы: WorkItems + Payments
    const addWorkBtn = document.getElementById('addWorkItemBtn');
    if (addWorkBtn) {
        addWorkBtn.addEventListener('click', addWorkItemRow);
        addWorkItemRow();  // Первая строка auto
    }
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', addPaymentRow);
    }

    // Режим edit
    const params = new URLSearchParams(window.location.search);
    const editId = parseInt(params.get('edit'), 10);
    if (editId) {
        editingOrderId = editId;
        await loadOrderForEdit(editId);
        const pageTitle = document.getElementById('pageTitle');
        const submitBtn = document.getElementById('submitBtn');
        if (pageTitle) pageTitle.textContent = 'Редактировать заказ';
        if (submitBtn) submitBtn.textContent = 'Сохранить изменения';
    }

    // Submit
    const form = document.getElementById('createOrderForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitForm();
        });
    }
});

// Загрузка для edit (п.8)
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
            totalPrice: order.totalPrice
        });

        // Таблицы
        renderWorkItemsTable(order.workItems || []);
        renderPaymentsTable(order.payments || []);

        // Фото (п.6: edit mode)
        await loadPhotosForEdit(id);
        renderPhotoGrid(orderPhotos, 'photoPreview', 'edit');  // + remove

        // Auto: Номер/Менеджер
        setFormValue('orderNumber', order.orderNumber || 'Авто');
        setFormValue('managerFullName', order.managerFullName || 'Авто');
    } catch (error) {
        showTempMessage('Ошибка загрузки: ' + error.message, 'error');
    }
}

async function loadPhotosForEdit(orderId) {
    try {
        orderPhotos = await apiService.getOrderPhotos(orderId);
    } catch (error) {
        console.error('Ошибка фото:', error);
        orderPhotos = [];
    }
}

// Submit (create/update + commit photos)
async function submitForm() {
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Сохранение...';

    try {
        const orderData = collectFormData();
        const validationError = validateForm(orderData);
        if (validationError) {
            showTempMessage(validationError, 'error');
            return;
        }

        const result = await handleOrderCreation(orderData);
        showTempMessage(`Заказ ${editingOrderId ? 'обновлен' : 'создан'} успешно!`, 'success');
        window.location.href = `view-order.html?id=${result.id || editingOrderId}`;
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showTempMessage('Ошибка сохранения: ' + (error.message || 'Неизвестная ошибка'), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function collectFormData() {
    const form = document.getElementById('createOrderForm');
    const formData = new FormData(form);

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
        totalPrice: calculateTotalPrice(),
        workItems: collectWorkItems(),
        payments: collectPayments(),
        tempUploadIds: tempPhotos.map(p => p.id)
    };
}

function validateForm(data) {
    if (!data.place) return 'Укажите участок';
    if (!data.orderDate) return 'Укажите дату';
    if (!data.deceasedFullName) return 'ФИО усопшего обязательно';
    if (!data.customerFullName) return 'ФИО заказчика обязательно';
    if (!data.phone || !isValidPhone(data.phone)) return 'Неверный номер телефона';
    if (!data.address) return 'Адрес обязателен';
    if (!data.monumentType) return 'Тип памятника обязателен';
    if (!data.monumentSize) return 'Размер памятника обязателен';

    // Work items
    const items = data.workItems || [];
    if (items.length === 0) return 'Добавьте хотя бы одну работу';
    for (const wi of items) {
        if (!wi.workDescription) return 'Описание работы обязательно';
        if (wi.price <= 0) return 'Стоимость > 0';
        if (wi.quantity < 1) return 'Количество ≥ 1';
    }

    return null;
}

async function handleOrderCreation(orderData) {
    let result;
    if (editingOrderId) {
        result = await apiService.updateOrder(editingOrderId, orderData);
        if (tempPhotos.length > 0) {
            await apiService.commitPhotos(editingOrderId, tempPhotos.map(p => p.id));
        }
    } else {
        result = await apiService.createOrder(orderData);
        if (tempPhotos.length > 0) {
            await apiService.commitPhotos(result.id, tempPhotos.map(p => p.id));
        }
    }
    tempPhotos = [];
    return result;
}

// Таблицы (work/payments — сохранены, но с utils)
function addWorkItemRow(data = {}) {
    const tableBody = document.querySelector('#workItemsTable tbody');
    if (!tableBody) return;

    const row = tableBody.insertRow();
    row.innerHTML = `
        <td><input type="text" name="workDescription" value="${data.workDescription || ''}" placeholder="Вид работы" required></td>
        <td><input type="number" name="price" value="${data.price || ''}" min="0" step="0.01" placeholder="Стоимость" required onchange="calculateTotalPrice()"></td>
        <td><input type="number" name="quantity" value="${data.quantity || 1}" min="1" placeholder="Кол-во" required onchange="calculateTotalPrice()"></td>
        <td><input type="text" name="note" value="${data.note || ''}" placeholder="Примечание"></td>
        <td class="total-cell">${formatCurrency((data.price || 0) * (data.quantity || 1))}</td>
        <td><button type="button" onclick="removeRow(this)">Удалить</button></td>
    `;
    calculateTotalPrice();
}

function renderWorkItemsTable(items) {
    const tableBody = document.querySelector('#workItemsTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    items.forEach(addWorkItemRow);
}

function collectWorkItems() {
    const rows = document.querySelectorAll('#workItemsTable tbody tr');
    return Array.from(rows).map(row => ({
        workDescription: row.querySelector('[name="workDescription"]').value,
        price: parseFloat(row.querySelector('[name="price"]').value) || 0,
        quantity: parseInt(row.querySelector('[name="quantity"]').value) || 1,
        note: row.querySelector('[name="note"]').value
    })).filter(wi => wi.workDescription);
}

function addPaymentRow(data = {}) {
    const tableBody = document.querySelector('#paymentsTable tbody');
    if (!tableBody) return;

    const row = tableBody.insertRow();
    row.innerHTML = `
        <td><select name="paymentType"><option ${data.paymentType === 'Аванс' ? 'selected' : ''}>Аванс</option><option ${data.paymentType === 'Доплата' ? 'selected' : ''}>Доплата</option></select></td>
        <td><input type="number" name="amount" value="${data.amount || ''}" min="0" step="0.01" placeholder="Сумма" required></td>
        <td><input type="date" name="paymentDate" value="${data.paymentDate ? new Date(data.paymentDate).toISOString().slice(0,10) : ''}" required></td>
        <td><input type="text" name="note" value="${data.note || ''}" placeholder="Примечание"></td>
        <td><button type="button" onclick="removeRow(this)">Удалить</button></td>
    `;
}

function renderPaymentsTable(payments) {
    const tableBody = document.querySelector('#paymentsTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    payments.forEach(addPaymentRow);
}

function collectPayments() {
    const rows = document.querySelectorAll('#paymentsTable tbody tr');
    return Array.from(rows).map(row => ({
        paymentType: row.querySelector('[name="paymentType"]').value,
        amount: parseFloat(row.querySelector('[name="amount"]').value) || 0,
        paymentDate: row.querySelector('[name="paymentDate"]').value,
        note: row.querySelector('[name="note"]').value
    })).filter(p => p.amount > 0);
}

function removeRow(btn) {
    btn.closest('tr').remove();
    calculateTotalPrice();
}

function calculateTotalPrice() {
    const items = collectWorkItems();
    const total = items.reduce((sum, wi) => sum + (wi.price * wi.quantity), 0);
    const totalEl = document.getElementById('totalPrice');
    if (totalEl) totalEl.textContent = formatCurrency(total);
    return total;
}

// Глобальные для onclick в HTML (legacy)
window.removeRow = removeRow;
window.calculateTotalPrice = calculateTotalPrice;
window.addWorkItemRow = addWorkItemRow;
window.addPaymentRow = addPaymentRow;