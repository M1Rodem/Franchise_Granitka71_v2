import { apiService } from '../api/api.js';
import { showTempMessage, escapeHtml } from '../utils/utils.js';
import { ModalUtils } from '../utils/modal-utils.js';

let currentEditUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userData = apiService.getCurrentUser();
    if (!token || !userData || userData.role !== 'Admin') {
        window.location.href = 'login.html';
        return;
    }

    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = userData.fullName || 'Пользователь';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => apiService.logout());

    setupCreateForm();
    setupEditModal();
    loadUsers();
});

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Загрузка...</td></tr>`;
    try {
        const users = await apiService.getUsers();
        if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">Пользователи не найдены</td></tr>`;
            return;
        }
        tbody.innerHTML = users.map(renderUserRow).join('');
    } catch (e) {
        console.error('Ошибка загрузки:', e);
        tbody.innerHTML = `<tr><td colspan="6" style="color:#dc3545;">Ошибка загрузки пользователей</td></tr>`;
        showTempMessage(e.message || 'Ошибка загрузки', 'error');
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
            <button class="btn btn-outline btn-sm" onclick="openEditModal(${u.id})">Редактировать</button>
            <button class="btn ${toggleClass} btn-sm" onclick="toggleBlock(${u.id}, ${u.isBlocked})">${toggleText}</button>
            <button class="btn btn-primary btn-sm" onclick="changeRole(${u.id}, '${nextRole}')">Сделать ${nextRole}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Удалить</button>
        </td>
    </tr>`;
}

function setupCreateForm() {
    const form = document.getElementById('createUserForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            username: document.getElementById('newUsername').value.trim(),
            password: document.getElementById('newPassword').value,
            fullName: document.getElementById('newFullName').value.trim(),
            role: document.getElementById('newRole').value
        };

        const validationError = validateCreateUser(payload);
        if (validationError) {
            showTempMessage(validationError, 'error');
            return;
        }

        try {
            await apiService.createUser(payload);
            showTempMessage('Пользователь создан', 'success');
            form.reset();
            loadUsers();
        } catch (e) {
            showTempMessage(e.message || 'Не удалось создать пользователя', 'error');
        }
    });
}

function setupEditModal() {
    const modal = document.getElementById('editUserModal');
    if (!modal) {
        console.warn('Edit modal not found');
        return;
    }

    const closeBtn = modal.querySelector('[data-close-modal]');
    const modalClose = modal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const form = document.getElementById('editUserForm');
    const modalOverlay = modal.querySelector('.modal-overlay');

    // Закрытие модалки
    if (closeBtn) closeBtn.addEventListener('click', () => hideEditModal());
    if (modalClose) modalClose.addEventListener('click', () => hideEditModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => hideEditModal());
    if (modalOverlay) {
        modalOverlay.addEventListener('click', () => hideEditModal());
    }

    // Закрытие по клику на оверлей
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideEditModal();
    });

    // Отправка формы
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveUserChanges();
        });
    }
}

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

        // Показываем модалку
        showEditModal();
        
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        showTempMessage('Ошибка загрузки данных пользователя', 'error');
    }
}

function showEditModal() {
    const modal = document.getElementById('editUserModal');
    modal.style.display = 'flex';
}

function hideEditModal() {
    const modal = document.getElementById('editUserModal');
    modal.style.display = 'none';
    currentEditUserId = null;
}

async function saveUserChanges() {
    if (!currentEditUserId) return;

    const payload = {
        username: document.getElementById('editUsername').value.trim(),
        fullName: document.getElementById('editFullName').value.trim()
    };

    const newPassword = document.getElementById('editPassword').value.trim();
    if (newPassword) {
        if (newPassword.length < 6) {
            showTempMessage('Пароль должен содержать минимум 6 символов', 'error');
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

function validateCreateUser(payload) {
    if (!payload.username || !payload.password || !payload.fullName) {
        return 'Заполните обязательные поля';
    }
    if (payload.password.length < 6) {
        return 'Пароль должен быть не менее 6 символов';
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

// Глобальные для onclick в HTML
window.openEditModal = openEditModal;
window.deleteUser = deleteUser;
window.toggleBlock = toggleBlock;
window.changeRole = changeRole;