import { apiService } from '../api/api.js';
import { showTempMessage, escapeHtml, debounce } from '../utils/utils.js';
import { ModalUtils } from '../utils/modal-utils.js';

let currentPage = 1;
let totalPages = 1;
const pageSize = 10;
let allUsers = [];
let totalCount = 0;
let currentEditUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeUsersPage();
});

function initializeUsersPage() {
    const userData = apiService.getCurrentUser();
    if (!userData || userData.role !== 'Admin') {
        window.location.href = 'login.html';
        return;
    }

    setupPageUI(userData);
    setupEventListeners();
    loadUsers();
}

function setupPageUI(userData) {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = userData.fullName || 'Пользователь';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => apiService.logout());
}

function setupEventListeners() {
    // Поиск с debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            currentPage = 1;
            applyFilters();
        }, 300));
    }

    // Пагинация
    document.getElementById('prevPage')?.addEventListener('click', prevPage);
    document.getElementById('nextPage')?.addEventListener('click', nextPage);

    // Кнопка создания пользователя
    document.getElementById('createUserBtn')?.addEventListener('click', showCreateUserModal);
    
    // Сброс фильтров
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);

    // Модальные окна
    setupCreateModal();
    setupEditModal();
}

function setupCreateModal() {
    const modal = document.getElementById('createUserModal');
    const form = document.getElementById('createUserForm');
    
    if (!modal || !form) return;

    // Закрытие модалки
    const closeElements = modal.querySelectorAll('[data-close-modal], .modal-close');
    closeElements.forEach(element => {
        element.addEventListener('click', () => hideCreateUserModal());
    });

    // Закрытие по клику вне модалки
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideCreateUserModal();
        }
    });

    // Валидация логина в реальном времени
    const usernameInput = document.getElementById('createUsername');
    if (usernameInput) {
        usernameInput.addEventListener('input', validateUsernameRealTime);
    }

    // Отправка формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createUser();
    });
}

function setupEditModal() {
    const modal = document.getElementById('editUserModal');
    const form = document.getElementById('editUserForm');
    
    if (!modal || !form) return;

    // Закрытие модалки
    const closeElements = modal.querySelectorAll('[data-close-modal], .modal-close');
    closeElements.forEach(element => {
        element.addEventListener('click', () => hideEditModal());
    });

    // Закрытие по клику вне модалки
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideEditModal();
        }
    });

    // Валидация логина в реальном времени для редактирования
    const editUsernameInput = document.getElementById('editUsername');
    if (editUsernameInput) {
        editUsernameInput.addEventListener('input', validateUsernameRealTime);
    }

    // Отправка формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUserChanges();
    });
}

// Валидация логина в реальном времени
function validateUsernameRealTime(e) {
    const input = e.target;
    const value = input.value;
    const errorElement = input.parentNode.querySelector('.field-error');
    
    // Регулярное выражение для запрещенных символов
    const forbiddenChars = /[\/"\\<>]/;
    
    if (forbiddenChars.test(value)) {
        // Показываем ошибку с анимацией
        if (!errorElement) {
            const error = document.createElement('div');
            error.className = 'field-error';
            error.textContent = 'Логин не может содержать символы / " \\ < >';
            input.parentNode.appendChild(error);
        } else {
            // Если ошибка уже есть, обновляем текст
            errorElement.textContent = 'Логин не может содержать символы / " \\ < >';
        }
        input.classList.add('error');
        input.classList.remove('valid');
    } else if (value.length >= 3) {
        // Валидное значение
        if (errorElement) {
            errorElement.classList.add('hiding');
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.remove();
                }
            }, 200);
        }
        input.classList.remove('error');
        input.classList.add('valid');
    } else {
        // Нет ошибки, но значение еще не валидно
        if (errorElement) {
            errorElement.classList.add('hiding');
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.remove();
                }
            }, 200);
        }
        input.classList.remove('error', 'valid');
    }
}

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    showLoadingState(true);
    
    try {
        const response = await apiService.getUsersPaged({
            page: currentPage,
            pageSize: pageSize,
            search: document.getElementById('searchInput')?.value || ''
        });

        if (response && Array.isArray(response.items)) {
            allUsers = response.items;
            totalCount = response.totalCount;
            totalPages = response.totalPages;
        } else {
            allUsers = [];
            totalCount = 0;
            totalPages = 1;
        }

        renderUsersTable();
        updatePagination();
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        showTempMessage(error.message || 'Ошибка загрузки пользователей', 'error');
        tbody.innerHTML = `<tr><td colspan="6" style="color:#dc3545;">Ошибка загрузки</td></tr>`;
    } finally {
        showLoadingState(false);
    }
}

async function applyFilters() {
    await loadUsers();
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (allUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">Пользователи не найдены</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = allUsers.map(renderUserRow).join('');
        
        setTimeout(() => {
            document.querySelectorAll('.orders-table td').forEach((td, index) => {
                const headerText = document.querySelectorAll('.orders-table th')[index % 6]?.textContent;
                if (headerText) {
                    td.setAttribute('data-label', headerText);
                }
            });
        }, 100);
        
        attachUserEvents();
    }
}

function renderUserRow(u) {
    const status = u.isBlocked ? 'Заблокирован' : 'Активен';
    const statusClass = u.isBlocked ? 'status-blocked' : 'status-active';
    const toggleText = u.isBlocked ? 'Разблокировать' : 'Заблокировать';
    const toggleClass = u.isBlocked ? 'btn-success' : 'btn-danger';
    const nextRole = u.role === 'Admin' ? 'Manager' : 'Admin';
    const roleClass = u.role.toLowerCase();
    
    return `
    <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.fullName)}</td>
        <td><span class="status-badge role-${roleClass}">${u.role}</span></td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td class="actions">
            <button class="btn btn-outline btn-sm btn-edit-user" data-user-id="${u.id}">Редактировать</button>
            <button class="btn ${toggleClass} btn-sm btn-toggle-block" data-user-id="${u.id}" data-is-blocked="${u.isBlocked}">${toggleText}</button>
            <button class="btn btn-primary btn-sm btn-change-role" data-user-id="${u.id}" data-next-role="${nextRole}">Сделать ${nextRole}</button>
            <button class="btn btn-danger btn-sm btn-delete-user" data-user-id="${u.id}">Удалить</button>
        </td>
    </tr>`;
}

function attachUserEvents() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
        const target = e.target;
        const userId = parseInt(target.dataset.userId);
        
        if (target.classList.contains('btn-edit-user')) {
            openEditModal(userId);
        } else if (target.classList.contains('btn-toggle-block')) {
            const isBlocked = target.dataset.isBlocked === 'true';
            toggleBlock(userId, isBlocked);
        } else if (target.classList.contains('btn-change-role')) {
            const nextRole = target.dataset.nextRole;
            changeRole(userId, nextRole);
        } else if (target.classList.contains('btn-delete-user')) {
            deleteUser(userId);
        }
    });
}

function showLoadingState(loading) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (loading) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading">Загрузка пользователей...</td>
            </tr>
        `;
    }
}

function updatePagination() {
    const pageInfo = document.getElementById('pageInfo');
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');

    if (pageInfo) {
        pageInfo.textContent = `Страница ${currentPage} из ${totalPages || 1}`;
    }
    
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
        loadUsers();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadUsers();
    }
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    currentPage = 1;
    loadUsers();
}

// Модальное окно создания пользователя
function showCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.getElementById('createUsername').value = '';
        document.getElementById('createPassword').value = '';
        document.getElementById('createFullName').value = '';
        document.getElementById('createRole').value = 'Manager';
        
        // Очищаем возможные ошибки валидации
        clearValidationErrors();
    }
}

function hideCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        clearValidationErrors();
    }
}

// Очистка ошибок валидации
function clearValidationErrors() {
    document.querySelectorAll('.field-error').forEach(error => {
        error.classList.add('hiding');
        setTimeout(() => {
            if (error.parentNode) {
                error.remove();
            }
        }, 200);
    });
    document.querySelectorAll('.error, .valid').forEach(input => {
        input.classList.remove('error', 'valid');
    });
}

async function createUser() {
    const payload = {
        username: document.getElementById('createUsername').value.trim(),
        password: document.getElementById('createPassword').value,
        fullName: document.getElementById('createFullName').value.trim(),
        role: document.getElementById('createRole').value
    };

    const validationError = validateCreateUser(payload);
    if (validationError) {
        showTempMessage(validationError, 'error');
        return;
    }

    try {
        await apiService.createUser(payload);
        showTempMessage('Пользователь создан', 'success');
        hideCreateUserModal();
        await loadUsers();
    } catch (e) {
        showTempMessage(e.message || 'Не удалось создать пользователя', 'error');
    }
}

// Модальное окно редактирования пользователя
async function openEditModal(userId) {
    try {
        // Получаем список всех пользователей и находим нужного
        const users = await apiService.getUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            showTempMessage('Пользователь не найден', 'error');
            return;
        }

        currentEditUserId = userId;
        
        // Заполняем форму данными
        document.getElementById('editUsername').value = user.username || '';
        document.getElementById('editFullName').value = user.fullName || '';
        document.getElementById('editPassword').value = '';
        document.getElementById('currentRole').textContent = user.role;
        document.getElementById('editUserModalTitle').textContent = `Редактировать: ${user.username}`;

        // Очищаем ошибки валидации
        clearValidationErrors();

        // Показываем модалку
        showEditModal();
        
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        showTempMessage('Ошибка загрузки данных пользователя', 'error');
    }
}

function showEditModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function hideEditModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        currentEditUserId = null;
        clearValidationErrors();
    }
}

async function saveUserChanges() {
    if (!currentEditUserId) return;

    const payload = {
        username: document.getElementById('editUsername').value.trim(),
        fullName: document.getElementById('editFullName').value.trim()
    };

    // Проверяем валидацию логина
    const usernameValidation = validateUsername(payload.username);
    if (usernameValidation) {
        showTempMessage(usernameValidation, 'error');
        return;
    }

    const newPassword = document.getElementById('editPassword').value.trim();
    if (newPassword) {
        if (newPassword.length < 8) {
            showTempMessage('Пароль должен содержать минимум 8 символов', 'error');
            return;
        }
        payload.password = newPassword;
    }

    if (!payload.username || !payload.fullName) {
        showTempMessage('Заполните обязательные поля', 'error');
        return;
    }

    try {
        await apiService.updateUser(currentEditUserId, payload);
        showTempMessage('Пользователь обновлён', 'success');
        hideEditModal();
        await loadUsers();
    } catch (e) {
        showTempMessage(e.message || 'Не удалось обновить пользователя', 'error');
    }
}

// Валидация логина
function validateUsername(username) {
    const forbiddenChars = /[\/"\\<>]/;
    
    if (forbiddenChars.test(username)) {
        return 'Логин не может содержать символы / " \\ < >';
    }
    
    if (username.length < 3) {
        return 'Логин должен содержать минимум 3 символа';
    }
    
    if (username.length > 50) {
        return 'Логин не может превышать 50 символов';
    }
    
    return null;
}

function validateCreateUser(payload) {
    if (!payload.username || !payload.password || !payload.fullName) {
        return 'Заполните обязательные поля';
    }
    
    // Валидация логина
    const usernameValidation = validateUsername(payload.username);
    if (usernameValidation) {
        return usernameValidation;
    }
    
    if (payload.password.length < 8) {
        return 'Пароль должен быть не менее 8 символов';
    }
    
    if (!['Admin', 'Manager'].includes(payload.role)) {
        return 'Неверная роль';
    }
    
    return null;
}

async function deleteUser(id) {
    const confirmed = await ModalUtils.confirm({
        title: 'Удалить пользователя?',
        message: 'Это действие необратимо.',
        confirmText: 'Удалить',
        danger: true
    });
    if (!confirmed) return;

    try {
        await apiService.deleteUser(id);
        showTempMessage('Пользователь удалён', 'success');
        await loadUsers();
    } catch (e) {
        showTempMessage(e.message || 'Не удалось удалить пользователя', 'error');
    }
}

async function toggleBlock(id, isBlocked) {
    const action = isBlocked ? 'разблокировать' : 'заблокировать';
    const confirmed = await ModalUtils.confirm({
        title: `${action} пользователя?`,
        message: `Пользователь будет ${action}.`,
        confirmText: action.charAt(0).toUpperCase() + action.slice(1),
        danger: !isBlocked
    });
    if (!confirmed) return;

    try {
        if (isBlocked) {
            await apiService.unblockUser(id);
        } else {
            await apiService.blockUser(id);
        }
        showTempMessage(`Пользователь ${action}`, 'success');
        await loadUsers();
    } catch (e) {
        showTempMessage(e.message || `Не удалось ${action} пользователя`, 'error');
    }
}

async function changeRole(id, role) {
    const confirmed = await ModalUtils.confirm({
        title: `Изменить роль на ${role}?`,
        message: `Роль пользователя будет изменена на ${role}.`,
        confirmText: 'Изменить'
    });
    if (!confirmed) return;

    try {
        await apiService.changeUserRole(id, role);
        showTempMessage(`Роль изменена на ${role}`, 'success');
        await loadUsers();
    } catch (e) {
        showTempMessage(e.message || 'Не удалось изменить роль', 'error');
    }
}