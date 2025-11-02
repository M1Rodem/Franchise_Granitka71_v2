import { apiService } from './api.js';
import { ModalUtils } from './modal-utils.js';
import { 
    formatDate, 
    formatCurrency, 
    getStatusBadgeClass, 
    getPaymentStatus, 
    getPaymentStatusText, 
    escapeHtml, 
    showTempMessage,
    getUserNameFromOrder,
    formatFileSize  // ДОБАВИТЬ ЭТУ ФУНКЦИЮ
} from './utils.js';
import { renderPhotoGrid, openPhotoPreview, attachPhotoEvents } from './photo-utils.js';

let currentPage = 1;
let totalPages = 1;
const pageSize = 10;
let allArchivedOrders = [];
let filteredOrders = [];
let totalCount = 0;

document.addEventListener('DOMContentLoaded', function() {
    initializeArchivedOrdersPage();
});

function initializeArchivedOrdersPage() {
    const userData = apiService.getCurrentUser();
    if (!userData) {
        window.location.href = 'login.html';
        return;
    }

    setupPageUI(userData);
    setupEventListeners();
    loadArchivedOrders();
}

function setupPageUI(userData) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        // ФИКС: Правильное отображение ФИО
        userNameElement.textContent = userData.fullName || userData.username || 'Пользователь';
    }

    // ФИКС: Показываем пункт "Пользователи" для админов
    if (userData.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = 'block';
        });
    }
}

function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => apiService.logout());
    }

    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            applyFilters();
        });
    }
}

async function loadArchivedOrders() {
    try {
        showLoadingState(true);

        const response = await apiService.getArchivedOrders({
            page: currentPage,
            pageSize: pageSize
        });


        if (response && Array.isArray(response.items)) {
            allArchivedOrders = response.items;
            filteredOrders = allArchivedOrders;
            totalCount = response.totalCount; 
        } else {
            allArchivedOrders = [];
            filteredOrders = [];
            totalCount = 0;
        }

        renderArchivedOrdersTable();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки архивных заказов:', error);
        showTempMessage('Не удалось загрузить архивные заказы: ' + error.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

async function applyFilters() {
    try {
        showLoadingState(true);
        
        const searchText = document.getElementById('searchInput').value;
        
        // ФИКС: Только поиск по тексту для архива
        const filterParams = {
            page: currentPage,
            pageSize: pageSize
        };
        
        // Добавляем параметры фильтрации
        if (searchText) {
            filterParams.searchQuery = searchText;
        }
        
        // Загружаем данные с сервера с фильтрами
        const response = await apiService.getArchivedOrders(filterParams);
        
        if (response && Array.isArray(response.items)) {
            allArchivedOrders = response.items;
            filteredOrders = allArchivedOrders;
            totalCount = response.totalCount;
        } else {
            allArchivedOrders = [];
            filteredOrders = [];
            totalCount = 0;
        }
        
        renderArchivedOrdersTable();
        
    } catch (error) {
        console.error('❌ Ошибка фильтрации архивных заказов:', error);
        showTempMessage('Ошибка фильтрации: ' + error.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

function renderArchivedOrdersTable() {
    const tbody = document.getElementById('archivedOrdersTableBody');
    if (!tbody) return;

    // ФИКС: используем allArchivedOrders вместо filteredOrders
    const pageOrders = allArchivedOrders; // Все заказы с текущей страницы

    if (pageOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">Архивные заказы не найдены</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = pageOrders.map(order => createArchivedOrderRow(order)).join('');
    }
    
    updatePagination();
}

function createArchivedOrderRow(order) {
    if (!order) return '';

    const orderNumber = order.orderNumber || 'Н/Д';
    const customerFullName = order.customerFullName || 'Н/Д';
    const phone = order.phone || 'Н/Д';
    const deletedAt = formatDate(order.deletedAt || order.updatedAt);
    const daysLeft = calculateDaysLeft(order.deletedAt || order.updatedAt);

    return `
        <tr>
            <td>${escapeHtml(orderNumber)}</td>
            <td>${escapeHtml(customerFullName)}</td>
            <td>${escapeHtml(phone)}</td>
            <td>${deletedAt}</td>
            <td>${daysLeft}</td>
            <td class="actions">
                <button class="btn btn-primary btn-sm" onclick="viewArchivedOrder(${order.id})">Просмотр</button>
                <button class="btn btn-success btn-sm" onclick="restoreArchivedOrder(${order.id})">Восстановить</button>
                <button class="btn btn-danger btn-sm" onclick="permanentDeleteArchivedOrder(${order.id})">Удалить навсегда</button>
            </td>
        </tr>
    `;
}

// ФИКС: Исправленная функция расчета дней
function calculateDaysLeft(deletedAt) {
    if (!deletedAt) return '—';
    
    try {
        const deletionDate = new Date(deletedAt);
        const today = new Date();
        
        // Приводим к началу дня для точного расчета
        deletionDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - deletionDate.getTime();
        const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const daysLeft = 7 - daysPassed; // ФИКС: 7 дней как на бэке
        
        if (daysLeft > 0) {
            return `${daysLeft} дней`;
        } else if (daysLeft === 0) {
            return 'Последний день';
        } else {
            return 'Истёк';
        }
    } catch (error) {
        console.error('Ошибка расчета дней:', error);
        return '—';MapToResponseDto
    }
}

async function viewArchivedOrder(id) {
    try {
        const order = await apiService.getArchivedOrder(id);
        
        // Рассчитываем общую стоимость
        const totalPrice = order.workItems?.reduce((sum, item) => {
            return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }, 0) || 0;
        const paymentStatus = getPaymentStatus(order);
        const statusText = getPaymentStatusText(order);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; 
            width: 100%; height: 100%; 
            background: rgba(0,0,0,0.8); 
            display: flex; justify-content: center; 
            align-items: center; z-index: 10000;
            padding: 20px;
            box-sizing: border-box;
        `;
        
        modal.innerHTML = `
            <div class="modal-content" style="
                background: white; 
                padding: 2rem; 
                border-radius: 12px; 
                max-width: 900px; 
                width: 95%; 
                max-height: 90vh; 
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 1rem;">
                    <div>
                        <h2 style="margin: 0; color: #333; font-size: 1.5rem;">Архивный заказ №${escapeHtml(order.orderNumber)}</h2>
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem; flex-wrap: wrap;">
                            <span class="status-badge ${paymentStatus}" style="
                                padding: 4px 12px;
                                border-radius: 20px;
                                font-size: 0.8rem;
                                font-weight: 500;
                                background: ${paymentStatus === 'paid' ? '#d4edda' : paymentStatus === 'partial' ? '#fff3cd' : '#f8d7da'};
                                color: ${paymentStatus === 'paid' ? '#155724' : paymentStatus === 'partial' ? '#856404' : '#721c24'};
                            ">${escapeHtml(statusText)}</span>
                            <span style="color: #666; font-size: 0.9rem;">Удалён: ${formatDate(order.deletedAt)}</span>
                        </div>
                    </div>
                    <button onclick="this.closest('.modal-overlay').remove()" style="
                        background: none; 
                        border: none; 
                        font-size: 1.5rem; 
                        cursor: pointer;
                        color: #666;
                        padding: 5px;
                        border-radius: 4px;
                    ">✕</button>
                </div>
                
                <!-- Основная информация в две колонки -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.1rem;">Информация о заказе</h3>
                        
                        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                            <p style="margin: 0.5rem 0;"><strong>Участок:</strong> ${escapeHtml(order.place)}</p>
                            <p style="margin: 0.5rem 0;"><strong>Место осмотра:</strong> ${escapeHtml(order.inspectionPlace || '—')}</p>
                            <p style="margin: 0.5rem 0;"><strong>Дата заказа:</strong> ${formatDate(order.orderDate)}</p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                            <p style="margin: 0.5rem 0;"><strong>Тип памятника:</strong> ${escapeHtml(order.monumentType || '—')}</p>
                            <p style="margin: 0.5rem 0;"><strong>Размер:</strong> ${escapeHtml(order.monumentSize || '—')}</p>
                            <p style="margin: 0.5rem 0;"><strong>Доп. информация:</strong> ${escapeHtml(order.additionalInfo || '—')}</p>
                        </div>
                    </div>
                    
                    <div>
                        <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.1rem;">Контакты</h3>
                        
                        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                            <p style="margin: 0.5rem 0;"><strong>Клиент:</strong> ${escapeHtml(order.customerFullName)}</p>
                            <p style="margin: 0.5rem 0;"><strong>Телефон:</strong> ${escapeHtml(order.phone)}</p>
                            <p style="margin: 0.5rem 0;"><strong>Email:</strong> ${escapeHtml(order.customerEmail || '—')}</p>
                            <p style="margin: 0.5rem 0;"><strong>Адрес:</strong> ${escapeHtml(order.address)}</p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                            <p style="margin: 0.5rem 0;"><strong>Усопший:</strong> ${escapeHtml(order.deceasedFullName)}</p>
                            <p style="margin: 0.5rem 0;"><strong>Менеджер:</strong> ${getUserNameFromOrder(order)}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Финансовая информация -->
                <div style="margin-bottom: 2rem;">
                    <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.1rem;">Финансовая информация</h3>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div style="background: #e7f3ff; padding: 1rem; border-radius: 8px;">
                            <h4 style="margin: 0 0 0.5rem 0; color: #0066cc; font-size: 1rem;">Общая стоимость</h4>
                            <p style="margin: 0; font-size: 1.5rem; font-weight: bold; color: #0066cc;">${formatCurrency(totalPrice)}</p>
                        </div>
                        
                        <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px;">
                            <h4 style="margin: 0 0 0.5rem 0; color: #009900; font-size: 1rem;">Статус оплаты</h4>
                            <p style="margin: 0; font-size: 1.1rem; font-weight: bold; color: #009900;">${escapeHtml(statusText)}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Таблицы работ и платежей -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.1rem;">Виды работ</h3>
                        ${renderWorksTableCompact(order.workItems)}
                    </div>
                    
                    <div>
                        <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.1rem;">Платежи</h3>
                        ${renderPaymentsTableCompact(order.payments)}
                    </div>
                </div>
                
                <!-- Фотографии -->
                <div>
                    <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.1rem;">Фотографии</h3>
                    <div id="archivedPhotos" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                        gap: 10px;
                        max-height: 300px;
                        overflow-y: auto;
                        padding: 10px;
                        background: #f8f9fa;
                        border-radius: 8px;
                    "></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        // Рендерим фото в компактном виде
        if (order.photos && order.photos.length > 0) {
            await renderCompactPhotoGrid(order.photos, 'archivedPhotos');
        } else {
            document.getElementById('archivedPhotos').innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Фото отсутствуют</p>';
        }
        
    } catch (err) {
        console.error('Error viewing archived order:', err);
        showTempMessage('Ошибка просмотра: ' + err.message, 'error');
    }
}

// Компактная таблица работ
function renderWorksTableCompact(workItems) {
    if (!workItems || workItems.length === 0) {
        return '<div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center; color: #666;">Нет работ</div>';
    }
    
    const itemsHtml = workItems.slice(0, 3).map(wi => `
        <div style="display: flex; justify-content: between; padding: 0.5rem; border-bottom: 1px solid #eee;">
            <div style="flex: 1;">
                <div style="font-weight: 500;">${escapeHtml(wi.workDescription)}</div>
                <div style="font-size: 0.8rem; color: #666;">${wi.quantity} × ${formatCurrency(wi.price)}</div>
            </div>
            <div style="font-weight: bold;">${formatCurrency(wi.price * wi.quantity)}</div>
        </div>
    `).join('');
    
    const moreItems = workItems.length > 3 ? 
        `<div style="padding: 0.5rem; text-align: center; color: #666; font-size: 0.9rem;">
            + еще ${workItems.length - 3} работ
        </div>` : '';
    
    return `
        <div style="background: #f8f9fa; border-radius: 8px; overflow: hidden;">
            ${itemsHtml}
            ${moreItems}
        </div>
    `;
}

// Компактная таблица платежей
function renderPaymentsTableCompact(payments) {
    if (!payments || payments.length === 0) {
        return '<div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center; color: #666;">Нет платежей</div>';
    }
    
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    
    const paymentsHtml = payments.slice(0, 3).map(p => `
        <div style="display: flex; justify-content: between; padding: 0.5rem; border-bottom: 1px solid #eee;">
            <div style="flex: 1;">
                <div style="font-weight: 500;">${escapeHtml(p.paymentType)}</div>
                <div style="font-size: 0.8rem; color: #666;">${formatDate(p.paymentDate)}</div>
            </div>
            <div style="font-weight: bold; color: #009900;">${formatCurrency(p.amount)}</div>
        </div>
    `).join('');
    
    const morePayments = payments.length > 3 ? 
        `<div style="padding: 0.5rem; text-align: center; color: #666; font-size: 0.9rem;">
            + еще ${payments.length - 3} платежей
        </div>` : '';
    
    return `
        <div style="background: #f8f9fa; border-radius: 8px; overflow: hidden;">
            ${paymentsHtml}
            ${morePayments}
            ${payments.length > 0 ? `
                <div style="padding: 0.75rem; background: #e8f5e8; border-top: 1px solid #d4edda; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>Всего оплачено:</span>
                    <span>${formatCurrency(totalPaid)}</span>
                </div>
            ` : ''}
        </div>
    `;
}

// Расчет общей стоимости заказа
function calculateOrderTotal(order) {
    if (!order || !order.workItems || !Array.isArray(order.workItems)) {
        return order?.totalPrice || 0;
    }
    
    return order.workItems.reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        return sum + (price * quantity);
    }, 0);
}

// Компактный рендер фото (миниатюры) - только информация без изображений
async function renderCompactPhotoGrid(photos, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!photos || photos.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Фото отсутствуют</p>';
        return;
    }

    // Создаем grid контейнер
    container.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 10px;
        max-height: 300px;
        overflow-y: auto;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 8px;
    `;

    // Рендерим фото (максимум 12 для preview)
    const photosToShow = photos.slice(0, 12);
    
    for (const photo of photosToShow) {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.dataset.photoId = photo.id;
        
        photoItem.style.cssText = `
            width: 120px;
            height: 120px;
            cursor: pointer;
            border-radius: 6px;
            overflow: hidden;
            border: 2px solid #ddd;
            transition: all 0.2s ease;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Показываем информацию о фото вместо самого изображения
        photoItem.innerHTML = `
            <div style="color: #666; font-size: 0.7rem; text-align: center; padding: 8px; width: 100%;">
                <div style="font-size: 1.5rem; margin-bottom: 5px;">📷</div>
                <div style="font-weight: bold; margin-bottom: 3px; word-break: break-word;">
                    ${escapeHtml(photo.originalFileName || 'Фото')}
                </div>
                <div style="margin-bottom: 2px;">${formatFileSize(photo.size)}</div>
                <div>${formatDate(photo.uploadedAt)}</div>
            </div>
        `;

        // Добавляем обработчик клика
        photoItem.addEventListener('click', () => {
            showPhotoInfoModal(photo);
        });

        container.appendChild(photoItem);
    }

    // Элемент "еще фото" если их больше 12
    if (photos.length > 12) {
        const morePhotos = document.createElement('div');
        morePhotos.style.cssText = `
            width: 120px;
            height: 120px;
            background: #e9ecef;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-size: 0.8rem;
            font-weight: bold;
            cursor: pointer;
        `;
        morePhotos.textContent = `+${photos.length - 12}`;
        
        morePhotos.addEventListener('click', () => {
            renderAllPhotosCompact(photos, container);
        });
        
        container.appendChild(morePhotos);
    }
}

// Функция для отображения всех фото (при клике на "еще")
async function renderAllPhotosCompact(photos, container) {
    container.innerHTML = '';
    container.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 10px;
        max-height: 400px;
        overflow-y: auto;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 8px;
    `;

    for (const photo of photos) {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.dataset.photoId = photo.id;
        
        photoItem.style.cssText = `
            width: 120px;
            height: 120px;
            cursor: pointer;
            border-radius: 6px;
            overflow: hidden;
            border: 2px solid #ddd;
            transition: all 0.2s ease;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Показываем информацию о фото
        photoItem.innerHTML = `
            <div style="color: #666; font-size: 0.7rem; text-align: center; padding: 8px; width: 100%;">
                <div style="font-size: 1.5rem; margin-bottom: 5px;">📷</div>
                <div style="font-weight: bold; margin-bottom: 3px; word-break: break-word;">
                    ${escapeHtml(photo.originalFileName || 'Фото')}
                </div>
                <div style="margin-bottom: 2px;">${formatFileSize(photo.size)}</div>
                <div>${formatDate(photo.uploadedAt)}</div>
            </div>
        `;

        photoItem.addEventListener('click', () => {
            showPhotoInfoModal(photo);
        });

        container.appendChild(photoItem);
    }
}

// Функция для показа информации о фото в модальном окне
function showPhotoInfoModal(photo) {
    ModalUtils.alert({
        title: 'Информация о фото',
        message: `
            <div style="text-align: left;">
                <p><strong>Название файла:</strong> ${escapeHtml(photo.originalFileName || 'Не указано')}</p>
                <p><strong>Размер:</strong> ${formatFileSize(photo.size)}</p>
                <p><strong>Дата загрузки:</strong> ${formatDate(photo.uploadedAt)}</p>
                <p><strong>ID фото:</strong> ${photo.id}</p>
                <p><strong>Разрешение:</strong> ${photo.width || '?'} × ${photo.height || '?'} px</p>
            </div>
            <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                <small>⚠️ Фото недоступно для просмотра в архивных заказах</small>
            </div>
        `,
        icon: '📷'
    });
}

async function restoreArchivedOrder(id) {
    try {
        const confirmed = await ModalUtils.confirm({
            title: 'Восстановить заказ?',
            message: 'Вернуть в активные заказы?',
            confirmText: 'Да',
            danger: false
        });
        
        if (confirmed) {
            await apiService.restoreArchivedOrder(id);
            showTempMessage('Заказ восстановлен', 'success');
            loadArchivedOrders();
        }
    } catch (error) {
        showTempMessage('Ошибка восстановления: ' + error.message, 'error');
    }
}

async function permanentDeleteArchivedOrder(id) {
    try {
        const confirmed = await ModalUtils.confirm({
            title: 'Удалить навсегда?',
            message: 'Это действие нельзя отменить!',
            confirmText: 'Да',
            danger: true
        });
        
        if (confirmed) {
            await apiService.permanentDeleteArchivedOrder(id);
            showTempMessage('Заказ удалён навсегда', 'success');
            loadArchivedOrders();
        }
    } catch (error) {
        showTempMessage('Ошибка удаления: ' + error.message, 'error');
    }
}

function updatePagination() {
    const totalPages = Math.ceil(totalCount / pageSize); // ФИКС: используем totalCount
    const pageInfo = document.getElementById('pageInfo');

    if (pageInfo) {
        pageInfo.textContent = `Страница ${currentPage} из ${totalPages || 1}`;
    }
    
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    
    if (prevButton) {
        prevButton.disabled = currentPage === 1;
        prevButton.style.opacity = currentPage === 1 ? '0.5' : '1';
        prevButton.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
    }
    
    if (nextButton) {
        nextButton.disabled = currentPage >= totalPages;
        nextButton.style.opacity = currentPage >= totalPages ? '0.5' : '1';
        nextButton.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadArchivedOrders(); // ФИКС: загружаем данные для новой страницы
    } else {
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        loadArchivedOrders(); // ФИКС: загружаем данные для новой страницы
    } else {
    }
}

function showLoadingState(loading) {
    const tbody = document.getElementById('archivedOrdersTableBody');
    if (!tbody) return;
    
    if (loading) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading">Загрузка архивных заказов...</td>
            </tr>
        `;
    }
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    filteredOrders = allArchivedOrders;
    currentPage = 1;
    renderArchivedOrdersTable();
}


window.viewArchivedOrder = viewArchivedOrder;
window.restoreArchivedOrder = restoreArchivedOrder;
window.permanentDeleteArchivedOrder = permanentDeleteArchivedOrder;