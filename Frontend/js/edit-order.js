let editingOrderId = null;
let tempPhotos = [];
let orderPhotos = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
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

    // Получаем ID заказа из URL
    const params = new URLSearchParams(window.location.search);
    const orderId = parseInt(params.get('id'), 10);
    
    if (!orderId) {
        showMessage(document.getElementById('formError'), 'Не указан ID заказа для редактирования');
        return;
    }

    editingOrderId = orderId;

    try {
        await loadOrderForEdit(orderId);
    } catch (error) {
        showMessage(document.getElementById('formError'), 'Не удалось загрузить заказ для редактирования');
        console.error('Ошибка загрузки заказа:', error);
    }

    // Инициализация формы и обработчиков (аналогично create-order.js)
    initializeForm();
});

function initializeForm() {
    const form = document.getElementById('editOrderForm');
    const errorEl = document.getElementById('formError');
    const successEl = document.getElementById('formSuccess');
    
    // Инициализация обработчиков как в create-order.js
    // (код инициализации работы с фото, работами, платежами)
    
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

                const result = await apiService.updateOrder(editingOrderId, orderData);
                
                // Коммитим временные фото
                if (tempPhotos.length > 0) {
                    const tempIds = tempPhotos.map(p => p.id);
                    await apiService.commitPhotos(editingOrderId, tempIds);
                    tempPhotos = [];
                }

                showMessage(successEl, 'Изменения сохранены');
                setTimeout(() => {
                    window.location.href = `view-order.html?id=${editingOrderId}`;
                }, 1000);
                
            } catch (err) {
                console.error('Error updating order:', err);
                showMessage(errorEl, err.message || 'Ошибка при сохранении');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
}