// create-order.js
import { PageManager } from './page-manager.js';
import { apiService } from './api.js';
import { formatCurrency, getTodayDate, isValidEmail, isValidPhone, 
    populateForm,  getFormValue, showTempMessage, } from './utils.js';
import { setupDragAndDrop, handlePhotoSelect, uploadTempAndDisplay, 
    renderPhotoGrid, tempUploads, clearTempPhotos, attachPhotoEvents, 
    getTempPhotoIds, loadAndCleanupTemp } from './photo-utils.js';

export class CreateOrderManager {
    constructor(pageManager) {
        this.pageManager = pageManager;
        this.editingOrderId = null;
        this.orderPhotos = [];
        this.originalOrderData = null;
        this.workItemsCount = 0;
        
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        // Основные элементы формы
        this.form = document.getElementById('createOrderForm');
        this.pageTitle = document.getElementById('pageTitle');
        this.submitBtn = document.getElementById('submitBtn');
        
        // Элементы для работы с фото
        this.photoInput = document.getElementById('photoInput');
        this.uploadArea = document.getElementById('photoUploadArea');
        this.photoPreview = document.getElementById('photoPreview');
        
        // Элементы таблиц
        this.addWorkBtn = document.getElementById('addWorkItemBtn');
        this.addPaymentBtn = document.getElementById('addPaymentBtn');
        this.workItemsTable = document.querySelector('#workItemsTable tbody');
        this.paymentsTable = document.querySelector('#paymentsTable tbody');
        
        // Элементы отображения
        this.totalPriceInput = document.getElementById('totalPriceInput');
        this.totalPriceDisplay = document.getElementById('totalPriceDisplay');
        this.orderDateInput = document.getElementById('orderDate');
    }

    async initialize() {
        await loadAndCleanupTemp();
        await this.setupUserInterface();
        this.setDefaultDate();
        this.setupNumberInputs();
        await this.checkEditMode();
        
        // Прикрепление событий для фото
        if (this.photoPreview) {
            attachPhotoEvents('photoPreview');
        }
    }

    bindEvents() {
        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('userData');
                window.location.href = 'login.html';
            });
        }

        // Фото: Input и Drag&Drop
        if (this.photoInput) {
            this.photoInput.addEventListener('change', (e) => 
                handlePhotoSelect(e, uploadTempAndDisplay));
        }
        
        if (this.uploadArea) {
            setupDragAndDrop('photoUploadArea', uploadTempAndDisplay);
        }

        // Таблицы: Добавление строк
        if (this.addWorkBtn) {
            this.addWorkBtn.addEventListener('click', () => this.addWorkItemRow());
            this.addWorkItemRow(); // Первая строка по умолчанию
            this.setupWorkItemsTableEvents();
            this.calculateTotalPrice();
        }

        // Платежи
        if (this.addPaymentBtn) {
            this.addPaymentBtn.addEventListener('click', () => this.addAdditionalPayment());
            this.initializePayments();
        }

        // Submit формы
        if (this.form) {
            this.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitForm();
            });
        }
    }

    async setupUserInterface() {
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

    setDefaultDate() {
        if (this.orderDateInput && !this.orderDateInput.value) {
            this.orderDateInput.value = getTodayDate();
        }
    }

    setupNumberInputs() {
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
        
        // Блокируем колесико мыши
        const preventScroll = (e) => e.preventDefault();
        
        document.addEventListener('wheel', (e) => {
            if (e.target.type === 'number') {
                e.preventDefault();
            }
        }, { passive: false });
        
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
        
        // Блокируем колесико для существующих полей
        const numberInputs = document.querySelectorAll('input[type="number"]');
        numberInputs.forEach(input => {
            input.addEventListener('wheel', preventScroll, { passive: false });
        });
    }

    async checkEditMode() {
        const params = new URLSearchParams(window.location.search);
        const editId = parseInt(params.get('edit'), 10);
        if (editId) {
            this.editingOrderId = editId;
            await this.loadOrderForEdit(editId);
            this.updateUIForEdit();
        }
    }

    updateUIForEdit() {
        if (this.pageTitle) this.pageTitle.textContent = 'Редактировать заказ';
        if (this.submitBtn) this.submitBtn.textContent = 'Сохранить изменения';
    }

    async loadOrderForEdit(id) {
        try {
            const order = await apiService.getOrder(id);
            
            this.originalOrderData = {
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
            
            populateForm('createOrderForm', this.originalOrderData);
            this.renderWorkItemsTable(this.originalOrderData.workItems);
            this.renderPaymentsTable(this.originalOrderData.payments);
            this.calculateTotalPrice();
            
            this.orderPhotos = order.photos || [];
            await renderPhotoGrid(this.orderPhotos, 'photoPreview', { mode: 'edit' });
            
        } catch (error) {
            console.error('Load order error:', error);
            showTempMessage('Ошибка загрузки заказа: ' + error.message, 'error');
        }
    }

    collectFormData() {
        const orderDateValue = getFormValue('orderDate');
        
        const workItems = this.collectWorkItems();
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
            payments: this.collectPayments(),
            totalPrice: calculatedTotal,
            tempUploadIds: getTempPhotoIds()
        };
        
        return data;
    }

    validateForm(data) {
        if (!data.place || data.place.trim() === '') return 'Укажите участок';
        if (!data.deceasedFullName || data.deceasedFullName.trim() === '') return 'ФИО и даты усопшего обязательно';
        if (!data.customerFullName || data.customerFullName.trim() === '') return 'ФИО заказчика обязательно';
        if (!data.address || data.address.trim() === '') return 'Адрес обязателен';
        if (!data.phone || data.phone.trim() === '') return 'Телефон обязателен';
        if (!data.monumentType || data.monumentType.trim() === '') return 'Тип памятника обязателен';
        if (!data.monumentSize || data.monumentSize.trim() === '') return 'Размер памятника обязателен';
        
        if (data.customerEmail && !isValidEmail(data.customerEmail)) {
            return 'Неверный формат email';
        }
        
        if (!isValidPhone(data.phone)) {
            return 'Неверный формат телефона';
        }
        
        const workItemsError = this.validateWorkItems(data.workItems);
        if (workItemsError) return workItemsError;
        
        return null;
    }

    async handleOrderCreation(orderData) {
        try {
            let result;
            if (this.editingOrderId) {
                result = await apiService.updateOrder(this.editingOrderId, orderData);
            } else {
                result = await apiService.createOrder(orderData);
            }
            
            if (tempUploads.length > 0) {
                await apiService.commitPhotos(this.editingOrderId || result.id, tempUploads);
            }
            
            clearTempPhotos();
            
            const message = this.editingOrderId ? 'Заказ обновлён' : 'Заказ создан';
            showTempMessage(message, 'success');
            
            setTimeout(() => {
                if (this.editingOrderId) {
                    window.location.href = `view-order.html?id=${this.editingOrderId}`;
                } else {
                    window.location.href = 'orders.html';
                }
            }, 1500);
            
            return result;
        } catch (error) {
            console.error('Order creation error:', error);
            showTempMessage('Ошибка сохранения: ' + (error.data?.message || error.message), 'error');
            throw error;
        }
    }

    hasFormDataChanged(originalData, currentData) {
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
        
        const normalizeWorkItem = (item) => ({
            workDescription: String(item.workDescription || '').trim(),
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            note: String(item.note || '').trim()
        });
        
        const originalItems = (originalData.workItems || []).map(normalizeWorkItem);
        const currentItems = (currentData.workItems || []).map(normalizeWorkItem);
        
        if (originalItems.length !== currentItems.length) return true;
        
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
        
        const normalizePayment = (payment) => ({
            paymentType: String(payment.paymentType || '').trim(),
            amount: Number(payment.amount) || 0,
            paymentDate: String(payment.paymentDate || '').trim(),
            note: String(payment.note || '').trim()
        });
        
        const originalPayments = (originalData.payments || []).map(normalizePayment);
        const currentPayments = (currentData.payments || []).map(normalizePayment);
        
        if (originalPayments.length !== currentPayments.length) return true;
        
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
        
        const originalPhotoIds = originalData.photoIds || [];
        const currentServerPhotoIds = currentData.photoIds || [];
        
        if (originalPhotoIds.length !== currentServerPhotoIds.length) return true;
        
        for (const photoId of originalPhotoIds) {
            if (!currentServerPhotoIds.includes(photoId)) return true;
        }
        
        if (currentData.tempUploadIds && currentData.tempUploadIds.length > 0) return true;
        
        if (window.photoWasDeleted) return true;
        
        return false;
    }

    async submitForm() {
        const data = this.collectFormData();
        const validationError = this.validateForm(data);
        if (validationError) {
            showTempMessage(validationError, 'error');
            return;
        }

        if (this.editingOrderId && this.originalOrderData) {
            if (!this.hasFormDataChanged(this.originalOrderData, data)) {
                showTempMessage('Нет изменений для сохранения', 'info');
                setTimeout(() => {
                    window.location.href = `view-order.html?id=${this.editingOrderId}`;
                }, 1500);
                return;
            }
        }

        try {
            await this.handleOrderCreation(data);
        } catch (error) {
            // Ошибка уже обработана в handleOrderCreation
        }
    }

    // ===== WORK ITEMS METHODS =====

    addWorkItemRow(data = {}) {
        if (!this.workItemsTable) return;

        const row = this.workItemsTable.insertRow();
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

        const inputs = row.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.calculateTotalPrice());
            input.addEventListener('change', () => this.calculateTotalPrice());
        });

        row.querySelector('.remove-row').addEventListener('click', () => {
            row.remove();
            this.calculateTotalPrice();
        });

        this.calculateTotalPrice();
    }

    renderWorkItemsTable(items) {
        if (!this.workItemsTable) return;
        this.workItemsTable.innerHTML = '';
        (items || []).forEach(item => this.addWorkItemRow(item));
        this.setupWorkItemsTableEvents();
        this.calculateTotalPrice();
    }

    setupWorkItemsTableEvents() {
        if (!this.workItemsTable) return;

        this.workItemsTable.addEventListener('input', (e) => {
            if (e.target.matches('input[name="workDescription"], input[name="price"], input[name="quantity"], input[name="note"]')) {
                this.calculateTotalPrice();
            }
        });

        this.workItemsTable.addEventListener('change', (e) => {
            if (e.target.matches('input[name="price"], input[name="quantity"]')) {
                this.calculateTotalPrice();
            }
        });
    }

    collectWorkItems() {
        if (!this.workItemsTable) return [];
        
        const rows = this.workItemsTable.querySelectorAll('tr');
        return Array.from(rows).map(row => {
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
                id: id,
                workDescription, 
                price, 
                quantity, 
                note 
            };
        });
    }

    // ===== PAYMENTS METHODS =====

    addPaymentRow(data = {}, isAdditionalPayment = false) {
        if (!this.paymentsTable) return;

        const today = getTodayDate();
        let paymentDateValue = data.paymentDate || today;
        if (paymentDateValue && paymentDateValue.includes('T')) {
            paymentDateValue = paymentDateValue.split('T')[0];
        }
        
        let paymentType = data.paymentType;
        if (!paymentType) {
            paymentType = isAdditionalPayment ? 'Доплата' : 'Аванс';
        }
        
        const row = this.paymentsTable.insertRow();
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

    renderPaymentsTable(payments) {
        if (!this.paymentsTable) {
            console.error('Таблица платежей не найдена!');
            return;
        }
        
        this.paymentsTable.innerHTML = '';
        
        if (payments && payments.length > 0) {
            payments.forEach((payment, index) => {
                const isAdditionalPayment = index > 0;
                this.addPaymentRow(payment, isAdditionalPayment);
            });
        } else {
            this.addPaymentRow({}, false);
        }
    }

    initializePayments() {
        if (!this.paymentsTable) return;
        
        this.paymentsTable.innerHTML = '';
        this.addPaymentRow({}, false);
        
        if (this.addPaymentBtn) {
            this.addPaymentBtn.textContent = 'Добавить доплату';
            this.addPaymentBtn.title = 'Добавить дополнительный платеж';
        }
    }

    addAdditionalPayment() {
        this.addPaymentRow({}, true);
    }

    collectPayments() {
        if (!this.paymentsTable) return [];
        
        const rows = this.paymentsTable.querySelectorAll('tr');
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

    // ===== UTILITY METHODS =====

    calculateTotalPrice() {
        const items = this.collectWorkItems() || [];
        
        let total = items.reduce((sum, wi) => {
            const itemTotal = (wi.price || 0) * (wi.quantity || 1);
            return sum + (isNaN(itemTotal) ? 0 : itemTotal);
        }, 0);
        
        if (isNaN(total)) total = 0;
        
        if (this.totalPriceInput) {
            this.totalPriceInput.value = total.toFixed(2);
        }
        
        if (this.totalPriceDisplay) {
            this.totalPriceDisplay.textContent = formatCurrency(total);
        }
        
        return total;
    }

    validateWorkItems(items) {
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

    // Cleanup
    destroy() {
        document.querySelectorAll('.photo-img').forEach(img => {
            if (img.src && img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src);
            }
        });
    }
}

// Инициализация через PageManager
document.addEventListener('DOMContentLoaded', () => {
    PageManager.initialize('create-order', async () => {
        const createOrderManager = new CreateOrderManager(PageManager);
        await createOrderManager.initialize();
        
        // Сохраняем ссылку для возможного доступа извне
        window.createOrderManager = createOrderManager;
    });
});

// Cleanup при выходе
window.addEventListener('beforeunload', () => {
    if (window.createOrderManager) {
        window.createOrderManager.destroy();
    }
});

// Глобальные функции для legacy HTML
window.addWorkItemRow = function() {
    if (window.createOrderManager) window.createOrderManager.addWorkItemRow();
};
window.addPaymentRow = function() {
    if (window.createOrderManager) window.createOrderManager.addAdditionalPayment();
};
window.calculateTotalPrice = function() {
    if (window.createOrderManager) window.createOrderManager.calculateTotalPrice();
};
window.removeRow = function(btn) { 
    btn.closest('tr').remove(); 
    if (window.createOrderManager) window.createOrderManager.calculateTotalPrice();
};